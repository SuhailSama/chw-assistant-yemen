import { SSMClient, GetParametersCommand } from "@aws-sdk/client-ssm";

const ssm = new SSMClient({});
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

export const handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  if (event.requestContext?.http?.method === "OPTIONS") return { statusCode: 200, headers };

  try {
    const body = JSON.parse(event.body || "{}");
    const { model, messages } = body;
    const isGemini = model?.startsWith("gemini");

    const keys = await getApiKeys();
    const apiKey = isGemini ? keys.gemini : keys.anthropic;

    // Remove 'models/' prefix if present, as OpenAI-compat endpoint doesn't want it
    const cleanModel = model.replace("models/", "");

    const res = await fetch(isGemini ? "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions" : "https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": isGemini ? `Bearer ${apiKey}` : undefined,
        "x-api-key": !isGemini ? apiKey : undefined,
        ...(!isGemini ? { "anthropic-version": "2023-06-01" } : {})
      },
      body: JSON.stringify({
        model: cleanModel,
        messages: isGemini ? messages.map(m => ({ role: m.role || "user", content: m.content })) : messages
      })
    });

    const data = await res.json();

    if (!isGemini) {
      return { statusCode: res.status, headers, body: JSON.stringify(data) };
    }

    if (data.choices && data.choices[0] && data.choices[0].message) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ content: [{ type: "text", text: data.choices[0].message.content }] })
        };
    } else {
        console.error("DEBUG - Unexpected Gemini Response:", JSON.stringify(data));
        return { statusCode: 502, headers, body: JSON.stringify({ error: "Invalid response from AI provider", details: data }) };
    }

  } catch (err) {
    console.error("Lambda Error:", err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
