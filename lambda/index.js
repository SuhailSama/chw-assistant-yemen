import { SSMClient, GetParametersCommand } from "@aws-sdk/client-ssm";
import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  AdminCreateUserCommand,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  AdminListGroupsForUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const ssm = new SSMClient({});
const cognito = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION || "me-south-1" });
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;

let cachedKeys = null;
const getApiKeys = async () => {
  if (cachedKeys) return cachedKeys;
  const { Parameters } = await ssm.send(new GetParametersCommand({
    Names: [process.env.ANTHROPIC_KEY_PARAM, process.env.GEMINI_KEY_PARAM],
    WithDecryption: true,
  }));
  cachedKeys = {
    anthropic: Parameters.find(p => p.Name === process.env.ANTHROPIC_KEY_PARAM)?.Value,
    gemini: Parameters.find(p => p.Name === process.env.GEMINI_KEY_PARAM)?.Value,
  };
  return cachedKeys;
};

const decodeJwt = (token) => {
  try {
    return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
  } catch { return null; }
};

const isAdmin = (event) => {
  const auth = event.headers?.authorization || event.headers?.Authorization || "";
  const payload = decodeJwt(auth.replace("Bearer ", ""));
  return (payload?.["cognito:groups"] || []).includes("Admin");
};

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

const json = (statusCode, body) => ({ statusCode, headers: HEADERS, body: JSON.stringify(body) });

export const handler = async (event) => {
  const method = event.requestContext?.http?.method;
  const path   = event.requestContext?.http?.path;

  if (method === "OPTIONS") return json(200, {});

  // ── AI Proxy ─────────────────────────────────────────────
  if (path === "/v1/messages" && method === "POST") {
    try {
      const body = JSON.parse(event.body || "{}");
      const { model, messages } = body;
      const isGemini = model?.startsWith("gemini");
      const keys = await getApiKeys();
      const apiKey = isGemini ? keys.gemini : keys.anthropic;
      const cleanModel = model.replace("models/", "");

      const res = await fetch(
        isGemini
          ? "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
          : "https://api.anthropic.com/v1/messages",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(isGemini
              ? { Authorization: `Bearer ${apiKey}` }
              : { "x-api-key": apiKey, "anthropic-version": "2023-06-01" }),
          },
          body: JSON.stringify({
            model: cleanModel,
            messages: isGemini
              ? messages.map(m => ({ role: m.role || "user", content: m.content }))
              : messages,
          }),
        }
      );

      const data = await res.json();
      if (!isGemini) return json(res.status, data);
      if (data.choices?.[0]?.message) {
        return json(200, { content: [{ type: "text", text: data.choices[0].message.content }] });
      }
      console.error("Unexpected Gemini response:", JSON.stringify(data));
      return json(502, { error: "Invalid response from AI provider" });
    } catch (err) {
      console.error("Lambda Error:", err);
      return json(500, { error: err.message });
    }
  }

  // ── Admin Routes (Admin group only) ──────────────────────
  if (!isAdmin(event)) return json(403, { error: "Admin access required" });

  // GET /admin/users — list all users with their groups
  if (path === "/admin/users" && method === "GET") {
    try {
      const { Users = [] } = await cognito.send(new ListUsersCommand({ UserPoolId: USER_POOL_ID, Limit: 60 }));
      const usersWithGroups = await Promise.all(
        Users.map(async (u) => {
          const { Groups = [] } = await cognito.send(
            new AdminListGroupsForUserCommand({ UserPoolId: USER_POOL_ID, Username: u.Username })
          );
          return {
            username: u.Username,
            status: u.UserStatus,
            enabled: u.Enabled,
            created: u.UserCreateDate,
            group: Groups[0]?.GroupName || "—",
          };
        })
      );
      return json(200, { users: usersWithGroups });
    } catch (err) {
      return json(500, { error: err.message });
    }
  }

  // POST /admin/users — create a new user
  if (path === "/admin/users" && method === "POST") {
    try {
      const { username, tempPassword, group } = JSON.parse(event.body || "{}");
      if (!username || !tempPassword || !group) return json(400, { error: "username, tempPassword, group required" });
      await cognito.send(new AdminCreateUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: username,
        TemporaryPassword: tempPassword,
        MessageAction: "SUPPRESS",
      }));
      await cognito.send(new AdminAddUserToGroupCommand({
        UserPoolId: USER_POOL_ID, Username: username, GroupName: group,
      }));
      return json(200, { message: "تم إنشاء المستخدم بنجاح" });
    } catch (err) {
      return json(500, { error: err.message });
    }
  }

  // PUT /admin/users/{username}/group — change user's group
  if (path?.startsWith("/admin/users/") && path.endsWith("/group") && method === "PUT") {
    try {
      const username = decodeURIComponent(path.split("/")[3]);
      const { newGroup, oldGroup } = JSON.parse(event.body || "{}");
      if (oldGroup && oldGroup !== "—") {
        await cognito.send(new AdminRemoveUserFromGroupCommand({
          UserPoolId: USER_POOL_ID, Username: username, GroupName: oldGroup,
        }));
      }
      await cognito.send(new AdminAddUserToGroupCommand({
        UserPoolId: USER_POOL_ID, Username: username, GroupName: newGroup,
      }));
      return json(200, { message: "تم تحديث الصلاحية" });
    } catch (err) {
      return json(500, { error: err.message });
    }
  }

  // PUT /admin/users/{username}/toggle — enable or disable user
  if (path?.startsWith("/admin/users/") && path.endsWith("/toggle") && method === "PUT") {
    try {
      const username = decodeURIComponent(path.split("/")[3]);
      const { enabled } = JSON.parse(event.body || "{}");
      const Cmd = enabled ? AdminDisableUserCommand : AdminEnableUserCommand;
      await cognito.send(new Cmd({ UserPoolId: USER_POOL_ID, Username: username }));
      return json(200, { message: enabled ? "تم تعطيل المستخدم" : "تم تفعيل المستخدم" });
    } catch (err) {
      return json(500, { error: err.message });
    }
  }

  return json(404, { error: "Not found" });
};
