// AWS Lambda — Anthropic API Proxy
// Deploy to Lambda + expose via API Gateway (HTTP API)
// Set environment variable: ANTHROPIC_API_KEY = your key
// Set environment variable: ALLOWED_ORIGIN = your CloudFront/Amplify domain

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*"; // restrict in production

export const handler = async (event) => {
 // ── CORS preflight ──────────────────────────────────────
 if (event.requestContext?.http?.method === "OPTIONS") {
 return {
 statusCode: 200,
 headers: corsHeaders(),
 body: "",
 };
 }

 // ── Parse request ───────────────────────────────────────
 let body;
 try {
 body = JSON.parse(event.body || "{}");
 } catch {
 return respond(400, { error: "Invalid JSON body" });
 }

 // ── Validate required fields ────────────────────────────
 const { model, max_tokens, messages } = body;
 if (!model || !messages || !Array.isArray(messages)) {
 return respond(400, { error: "Missing required fields: model, messages" });
 }

 // ── Rate limiting (basic — use WAF or DynamoDB for production) ─
 // TODO: Integrate with API Gateway usage plans for per-user throttling

 // ── Forward to Anthropic ────────────────────────────────
 try {
 const res = await fetch(ANTHROPIC_URL, {
 method: "POST",
 headers: {
 "Content-Type": "application/json",
 "x-api-key": process.env.ANTHROPIC_API_KEY,
 "anthropic-version": "2023-06-01",
 },
 body: JSON.stringify({ model, max_tokens: max_tokens || 1000, messages }),
 });

 const data = await res.json();

 // Log usage for monitoring (CloudWatch)
 console.log(JSON.stringify({
 level: "INFO",
 input_tokens: data.usage?.input_tokens,
 output_tokens: data.usage?.output_tokens,
 model,
 status: res.status,
 }));

 return respond(res.status, data);
 } catch (err) {
 console.error("Upstream error:", err);
 return respond(502, { error: "Failed to reach Anthropic API" });
 }
};

function respond(statusCode, body) {
 return {
 statusCode,
 headers: corsHeaders(),
 body: JSON.stringify(body),
 };
}

function corsHeaders() {
 return {
 "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
 "Access-Control-Allow-Methods": "POST, OPTIONS",
 "Access-Control-Allow-Headers": "Content-Type",
 "Content-Type": "application/json",
 };
}
