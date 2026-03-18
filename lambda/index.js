// AWS Lambda — AI API Proxy (Anthropic & Gemini)
// Deploy to Lambda + expose via API Gateway (HTTP API)
// Set environment variable: ANTHROPIC_API_KEY (optional)
// Set environment variable: GEMINI_API_KEY (your key)
// Set environment variable: ALLOWED_ORIGIN (e.g., your CloudFront domain)

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

export const handler = async (event) => {
  // ── CORS preflight ──────────────────────────────────────
  if (event.requestContext?.http?.method === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(), body: "" };
  }

  // ── Parse request ───────────────────────────────────────
  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { return respond(400, { error: "Invalid JSON" }); }

  const { model, messages } = body;
  const isGemini = model?.startsWith("gemini");
  
  const targetUrl = isGemini ? GEMINI_URL : ANTHROPIC_URL;
  const apiKey = isGemini ? process.env.GEMINI_API_KEY : process.env.ANTHROPIC_API_KEY;

  try {
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": isGemini ? `Bearer ${apiKey}` : undefined,
        "x-api-key": !isGemini ? apiKey : undefined,
        ...(!isGemini ? { "anthropic-version": "2023-06-01" } : {}),
      },
      body: JSON.stringify({ 
        model, 
        messages: isGemini ? messages.map(m => ({ role: m.role, content: m.content })) : messages 
      }),
    });

    const data = await res.json();
    
    // Map Gemini response to Anthropic's expected format
    const responseBody = isGemini ? { content: [{ type: "text", text: data.choices[0].message.content }] } : data;
    
    return respond(res.status, responseBody);
  } catch (err) {
    console.error("Upstream error:", err);
    return respond(502, { error: "Failed to reach API" });
  }
};

function respond(statusCode, body) { return { statusCode, headers: corsHeaders(), body: JSON.stringify(body) }; }
function corsHeaders() { return { "Access-Control-Allow-Origin": ALLOWED_ORIGIN, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Content-Type": "application/json" }; }
