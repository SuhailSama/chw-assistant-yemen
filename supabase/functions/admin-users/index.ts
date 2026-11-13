// User management. Accounts are admin-created; roles and the temp-password
// flag live in app_metadata, which only this function (secret key) can write.
import { createClient, type User } from "npm:@supabase/supabase-js@2";

const EMAIL_DOMAIN = "chw-assistant.local";
const ROLES = ["CHW", "Supervisor", "Admin"];
const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;
const FAR_FUTURE = "876000h";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

function secretKey(): string {
  try {
    const key = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default;
    if (key) return key;
  } catch { /* fall through to the legacy key */ }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
}

const admin = createClient(Deno.env.get("SUPABASE_URL")!, secretKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

type AuthUser = User & { banned_until?: string };

const isBanned = (u: AuthUser) => !!u.banned_until && new Date(u.banned_until) > new Date();
const usernameOf = (u: AuthUser) => u.app_metadata?.username || (u.email || "").split("@")[0];
const validPassword = (p: unknown) =>
  typeof p === "string" && p.length >= 8 && p.length <= 72 && /[a-z]/.test(p) && /\d/.test(p);

async function getCaller(req: Request): Promise<AuthUser | null> {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user || isBanned(data.user)) return null;
  return data.user;
}

async function allUsers(): Promise<AuthUser[]> {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return data.users;
}

async function findUser(username: string): Promise<AuthUser> {
  const email = `${String(username).toLowerCase()}@${EMAIL_DOMAIN}`;
  const user = (await allUsers()).find((u) => u.email === email);
  if (!user) throw new Error("المستخدم غير موجود");
  return user;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const caller = await getCaller(req);
  if (!caller) return json(401, { error: "Authentication required" });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON body" }); }

  try {
    // Any signed-in user: replace the temporary password with their own.
    if (body.action === "set-password") {
      if (!validPassword(body.newPassword)) {
        return json(400, { error: "كلمة المرور ضعيفة — يجب 8 أحرف على الأقل وتشمل أرقاماً" });
      }
      const { error } = await admin.auth.admin.updateUserById(caller.id, {
        password: body.newPassword as string,
        app_metadata: { ...caller.app_metadata, must_change_password: false },
      });
      if (error) throw error;
      return json(200, { message: "تم تغيير كلمة المرور" });
    }

    const meta = caller.app_metadata || {};
    if (meta.role !== "Admin" || meta.must_change_password) return json(403, { error: "Admin access required" });

    if (body.action === "list") {
      const users = (await allUsers()).map((u) => ({
        username: usernameOf(u),
        status: u.app_metadata?.must_change_password ? "FORCE_CHANGE_PASSWORD" : "CONFIRMED",
        enabled: !isBanned(u),
        created: u.created_at,
        group: u.app_metadata?.role || "—",
      }));
      return json(200, { users });
    }

    if (body.action === "create") {
      const username = String(body.username || "").trim().toLowerCase();
      const group = String(body.group || "");
      if (!USERNAME_RE.test(username)) {
        return json(400, { error: "اسم المستخدم: 3-32 حرفاً إنجليزياً صغيراً أو أرقاماً أو . _ -" });
      }
      if (!ROLES.includes(group)) return json(400, { error: "صلاحية غير صالحة" });
      if (!validPassword(body.tempPassword)) {
        return json(400, { error: "كلمة المرور ضعيفة — يجب 8 أحرف على الأقل وتشمل أرقاماً" });
      }
      const { error } = await admin.auth.admin.createUser({
        email: `${username}@${EMAIL_DOMAIN}`,
        password: body.tempPassword as string,
        email_confirm: true,
        app_metadata: { username, role: group, must_change_password: true },
      });
      if (error) throw error;
      return json(200, { message: "تم إنشاء المستخدم بنجاح" });
    }

    if (body.action === "set-group") {
      const newGroup = String(body.newGroup || "");
      if (!ROLES.includes(newGroup)) return json(400, { error: "صلاحية غير صالحة" });
      const user = await findUser(String(body.username || ""));
      const { error } = await admin.auth.admin.updateUserById(user.id, {
        app_metadata: { ...user.app_metadata, role: newGroup },
      });
      if (error) throw error;
      return json(200, { message: "تم تحديث الصلاحية" });
    }

    if (body.action === "toggle") {
      // `enabled` is the user's current state, so true means "disable now".
      const user = await findUser(String(body.username || ""));
      const { error } = await admin.auth.admin.updateUserById(user.id, {
        ban_duration: body.enabled ? FAR_FUTURE : "none",
      });
      if (error) throw error;
      return json(200, { message: body.enabled ? "تم تعطيل المستخدم" : "تم تفعيل المستخدم" });
    }

    return json(400, { error: "Unknown action" });
  } catch (err) {
    console.error("admin-users failed:", err);
    return json(500, { error: (err as Error).message || "Server error" });
  }
});
