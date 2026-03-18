// AWS Lambda — Anthropic API Proxy
// Deploy to Lambda + expose via API Gateway (HTTP API)
// Set environment variable: ANTHROPIC_API_KEY = your key
// Set environment variable: ALLOWED_ORIGIN = your CloudFront/Amplify domain
// Set environment variable: ARABICAI_API_KEY = your Arabic.ai key
// Set environment variable: ARABICAI_API_URL = your Arabic.ai endpoint

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

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

  const { provider, model, max_tokens, messages } = body;
  if (!model || !messages || !Array.isArray(messages)) {
    return respond(400, { error: "Missing required fields: model, messages" });
  }

  // ── Provider Routing ────────────────────────────────────
  const useArabicAI = provider === "arabicai" && process.env.ARABICAI_API_KEY && process.env.ARABICAI_API_URL;
  const targetUrl = useArabicAI ? process.env.ARABICAI_API_URL : ANTHROPIC_URL;
  const apiKey = useArabicAI ? process.env.ARABICAI_API_KEY : process.env.ANTHROPIC_API_KEY;

  console.log(`Using provider: ${useArabicAI ? "Arabic.ai" : "Anthropic"}`);

  try {
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        ...(useArabicAI ? {} : { "anthropic-version": "2023-06-01" }),
      },
      body: JSON.stringify({ 
        model, 
        max_tokens: max_tokens || 1000, 
        messages 
      }),
    });

    const data = await res.json();
    let formattedResponse = data;

    // Map Arabic.ai response to Anthropic content block format if needed
    if (useArabicAI) {
        // Assume Arabic.ai returns { content: "text" } or similar, map to { content: [{ type: "text", text: "..." }] }
        const text = data.content || data.response || (typeof data === 'string' ? data : JSON.stringify(data));
        formattedResponse = {
            content: [{ type: "text", text: text }]
        };
    }

    return respond(res.status, formattedResponse);
  } catch (err) {
    console.error("Upstream error:", err);
    return respond(502, { error: "Failed to reach provider API" });
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
