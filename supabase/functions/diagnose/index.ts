// AI proxy: keeps the Gemini key server-side and only serves signed-in staff.
import { createClient, type User } from "npm:@supabase/supabase-js@2";

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-3.5-flash-lite";
const MAX_PROMPT_CHARS = 8000;
const ROLES = ["CHW", "Supervisor", "Admin"];

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

async function getCaller(req: Request): Promise<User | null> {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  const banned = (data.user as User & { banned_until?: string }).banned_until;
  if (banned && new Date(banned) > new Date()) return null;
  return data.user;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const caller = await getCaller(req);
  if (!caller) return json(401, { error: "Authentication required" });
  const meta = caller.app_metadata || {};
  if (!ROLES.includes(meta.role) || meta.must_change_password) return json(403, { error: "Access denied" });

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return json(503, { error: "خدمة التشخيص غير مهيأة بعد — GEMINI_API_KEY مفقود" });

  let messages: { role: string; content: string }[];
  try {
    const body = await req.json();
    messages = (body.messages || []).map((m: { role?: string; content?: unknown }) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content ?? ""),
    }));
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }
  const size = messages.reduce((n, m) => n + m.content.length, 0);
  if (!messages.length || size === 0) return json(400, { error: "messages required" });
  if (size > MAX_PROMPT_CHARS) return json(413, { error: "Prompt too long" });

  try {
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: MODEL, messages }),
    });
    const raw = await res.json();
    const data = Array.isArray(raw) ? raw[0] : raw;
    if (res.status === 429) return json(429, { error: "تم بلوغ الحد اليومي المجاني للتشخيص — حاول لاحقاً" });
    if (data?.error) {
      console.error("Gemini error:", JSON.stringify(data.error));
      return json(res.status >= 400 ? res.status : 502, { error: data.error.message || "AI provider error" });
    }
    const text = data?.choices?.[0]?.message?.content;
    if (!text) {
      console.error("Unexpected Gemini response:", JSON.stringify(raw).slice(0, 500));
      return json(502, { error: "Invalid response from AI provider" });
    }
    return json(200, { content: [{ type: "text", text }] });
  } catch (err) {
    console.error("diagnose failed:", err);
    return json(500, { error: "AI request failed" });
  }
});
