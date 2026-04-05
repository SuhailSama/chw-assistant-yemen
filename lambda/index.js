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
import { CognitoJwtVerifier } from "aws-jwt-verify";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

const ssm = new SSMClient({ region: "me-south-1" });
const cognito = new CognitoIdentityProviderClient({ region: "me-south-1" });
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION || "eu-west-1" });
const ddb = DynamoDBDocumentClient.from(ddbClient);
const VISITS_TABLE = process.env.VISITS_TABLE;
const REFERRALS_TABLE = process.env.REFERRALS_TABLE;

const jwtVerifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID,
  tokenUse: "id",
  clientId: process.env.COGNITO_CLIENT_ID,
});

const verifyToken = async (event) => {
  const auth = event.headers?.authorization || event.headers?.Authorization || "";
  const token = auth.replace("Bearer ", "");
  if (!token) return null;
  try { return await jwtVerifier.verify(token); } catch { return null; }
};

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

const isAdmin = async (event) => {
  const payload = await verifyToken(event);
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
  const rawPath = event.requestContext?.http?.path || "";
  const path = rawPath.replace(/^\/prod/, ""); // strip stage prefix

  if (method === "OPTIONS") return json(200, {});

  // ── AI Proxy ─────────────────────────────────────────────
  if (path === "/v1/messages" && method === "POST") {
    const caller = await verifyToken(event);
    if (!caller) return json(401, { error: "Authentication required" });
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
      // Gemini OpenAI-compat endpoint may return array on error
      const gData = Array.isArray(data) ? data[0] : data;
      if (gData.error) {
        console.error("Gemini API error:", JSON.stringify(gData.error));
        return json(res.status, { error: gData.error.message || "AI provider error" });
      }
      if (gData.choices?.[0]?.message) {
        return json(200, { content: [{ type: "text", text: gData.choices[0].message.content }] });
      }
      console.error("Unexpected Gemini response:", JSON.stringify(data));
      return json(502, { error: "Invalid response from AI provider" });
    } catch (err) {
      console.error("Lambda Error:", err);
      return json(500, { error: err.message });
    }
  }

  // ── Data API Routes (authenticated users) ──────────────────
  // GET /api/visits
  if (path === "/api/visits" && method === "GET") {
    const caller = await verifyToken(event);
    if (!caller) return json(401, { error: "Authentication required" });
    const groups = caller["cognito:groups"] || [];
    const isSupervisor = groups.includes("Supervisor") || groups.includes("Admin");
    const chwUsername = isSupervisor && event.queryStringParameters?.chw
      ? event.queryStringParameters.chw
      : (caller["cognito:username"] || caller.sub);
    try {
      const result = await ddb.send(new QueryCommand({
        TableName: VISITS_TABLE,
        KeyConditionExpression: "chwUsername = :u",
        ExpressionAttributeValues: { ":u": chwUsername },
        ScanIndexForward: false,
      }));
      return json(200, { visits: result.Items || [] });
    } catch (err) { return json(500, { error: err.message }); }
  }

  // POST /api/visits
  if (path === "/api/visits" && method === "POST") {
    const caller = await verifyToken(event);
    if (!caller) return json(401, { error: "Authentication required" });
    try {
      const body = JSON.parse(event.body || "{}");
      const visitId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const item = {
        chwUsername: caller["cognito:username"] || caller.sub,
        visitId,
        createdAt: new Date().toISOString(),
        ...body,
      };
      await ddb.send(new PutCommand({ TableName: VISITS_TABLE, Item: item }));
      return json(201, { visitId });
    } catch (err) { return json(500, { error: err.message }); }
  }

  // GET /api/referrals
  if (path === "/api/referrals" && method === "GET") {
    const caller = await verifyToken(event);
    if (!caller) return json(401, { error: "Authentication required" });
    const groups = caller["cognito:groups"] || [];
    const isSupervisor = groups.includes("Supervisor") || groups.includes("Admin");
    const chwUsername = isSupervisor && event.queryStringParameters?.chw
      ? event.queryStringParameters.chw
      : (caller["cognito:username"] || caller.sub);
    try {
      const result = await ddb.send(new QueryCommand({
        TableName: REFERRALS_TABLE,
        KeyConditionExpression: "chwUsername = :u",
        ExpressionAttributeValues: { ":u": chwUsername },
        ScanIndexForward: false,
      }));
      return json(200, { referrals: result.Items || [] });
    } catch (err) { return json(500, { error: err.message }); }
  }

  // POST /api/referrals
  if (path === "/api/referrals" && method === "POST") {
    const caller = await verifyToken(event);
    if (!caller) return json(401, { error: "Authentication required" });
    try {
      const body = JSON.parse(event.body || "{}");
      const referralId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const item = {
        chwUsername: caller["cognito:username"] || caller.sub,
        referralId,
        createdAt: new Date().toISOString(),
        ...body,
      };
      await ddb.send(new PutCommand({ TableName: REFERRALS_TABLE, Item: item }));
      return json(201, { referralId });
    } catch (err) { return json(500, { error: err.message }); }
  }

  // GET /api/supervisor/summary — Supervisor/Admin only
  if (path === "/api/supervisor/summary" && method === "GET") {
    const caller = await verifyToken(event);
    if (!caller) return json(401, { error: "Authentication required" });
    const groups = caller["cognito:groups"] || [];
    if (!groups.includes("Supervisor") && !groups.includes("Admin")) return json(403, { error: "Supervisor access required" });
    try {
      const [visitsResult, referralsResult] = await Promise.all([
        ddb.send(new ScanCommand({ TableName: VISITS_TABLE })),
        ddb.send(new ScanCommand({ TableName: REFERRALS_TABLE })),
      ]);
      const allVisits = visitsResult.Items || [];
      const allReferrals = referralsResult.Items || [];
      const urgentCount = allReferrals.filter(r => r.urgency === "urgent").length;
      const byCHW = {};
      for (const v of allVisits) {
        byCHW[v.chwUsername] = byCHW[v.chwUsername] || { visits: 0, referrals: 0 };
        byCHW[v.chwUsername].visits++;
      }
      for (const r of allReferrals) {
        byCHW[r.chwUsername] = byCHW[r.chwUsername] || { visits: 0, referrals: 0 };
        byCHW[r.chwUsername].referrals++;
      }
      return json(200, {
        totalVisits: allVisits.length,
        totalReferrals: allReferrals.length,
        urgentCount,
        byCHW,
      });
    } catch (err) { return json(500, { error: err.message }); }
  }

  // ── Admin Routes (Admin group only) ──────────────────────
  if (!await isAdmin(event)) return json(403, { error: "Admin access required" });

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
