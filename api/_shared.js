/*
 * NexaGPT shared server helpers
 * Gemini is the primary provider. Groq is an automatic text-generation fallback.
 *
 * Required Vercel environment variables:
 *   GEMINI_API_KEY
 *   GROQ_API_KEY                 (recommended fallback)
 *
 * Optional:
 *   GEMINI_MODEL                 default: gemini-2.5-flash
 *   GROQ_MODEL                   default: llama-3.3-70b-versatile
 *   GROQ_VISION_MODEL            optional; only needed for image requests if Gemini is down
 */

export function send(res, status, data) {
  return res.status(status).json(data);
}

export function clean(value, max = 12000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function parseJson(text, fallback = null) {
  if (typeof text !== "string") return fallback;
  const source = text.trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  try { return JSON.parse(source); } catch {}
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start < 0 || end <= start) return fallback;
  try { return JSON.parse(source.slice(start, end + 1)); } catch {}
  return fallback;
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function isRetryable(error) {
  return [408, 409, 425, 429, 500, 502, 503, 504].includes(error?.status) ||
    error?.name === "TimeoutError" ||
    error?.name === "AbortError";
}

async function callGeminiOnce(prompt, { json, images, maxOutputTokens }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    const error = new Error("GEMINI_API_KEY is not configured.");
    error.status = 401;
    throw error;
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const parts = [{ text: String(prompt || "") }];

  for (const image of images.slice(0, 3)) {
    if (!image || typeof image.data !== "string" || !image.type) continue;
    const base64 = image.data.includes(",") ? image.data.split(",")[1] : image.data;
    if (base64) parts.push({ inline_data: { mime_type: image.type, data: base64 } });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0.65,
          maxOutputTokens,
          ...(json ? { responseMimeType: "application/json" } : {})
        }
      }),
      signal: AbortSignal.timeout(48000)
    }
  );

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body?.error?.message || `Gemini request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }

  const result = body?.candidates?.[0]?.content?.parts
    ?.map(part => typeof part.text === "string" ? part.text : "")
    .join("")
    .trim();

  if (!result) {
    const error = new Error(
      `Gemini returned no usable text (${body?.promptFeedback?.blockReason || body?.candidates?.[0]?.finishReason || "empty response"}).`
    );
    error.status = 502;
    throw error;
  }
  return result;
}

async function callGroq(prompt, { json, images, maxOutputTokens }) {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    const error = new Error(
      "Gemini is temporarily overloaded, and GROQ_API_KEY is not configured. Add a Groq API key in Vercel → Project Settings → Environment Variables to enable automatic backup."
    );
    error.status = 503;
    throw error;
  }

  if (images.length) {
    const visionModel = process.env.GROQ_VISION_MODEL;
    if (!visionModel) {
      const error = new Error(
        "Gemini is temporarily unavailable. This request includes images, but GROQ_VISION_MODEL is not configured for image-capable fallback."
      );
      error.status = 503;
      throw error;
    }
  }

  const model = images.length
    ? process.env.GROQ_VISION_MODEL
    : (process.env.GROQ_MODEL || "llama-3.3-70b-versatile");

  const content = images.length
    ? [
        { type: "text", text: String(prompt || "") },
        ...images.slice(0, 3).filter(i => i?.data && i?.type).map(i => ({
          type: "image_url",
          image_url: {
            url: i.data.startsWith("data:") ? i.data : `data:${i.type};base64,${i.data}`
          }
        }))
      ]
    : String(prompt || "");

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content }],
      temperature: 0.65,
      max_tokens: Math.min(Math.max(maxOutputTokens, 1024), 16384),
      ...(json ? { response_format: { type: "json_object" } } : {})
    }),
    signal: AbortSignal.timeout(48000)
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body?.error?.message || `Groq backup request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }

  const result = body?.choices?.[0]?.message?.content;
  if (typeof result !== "string" || !result.trim()) {
    const error = new Error("Groq backup returned an empty response.");
    error.status = 502;
    throw error;
  }
  return result.trim();
}

/**
 * Existing engines continue calling callGemini(...).
 * This function now retries temporary Gemini failures, then automatically
 * switches to Groq when GROQ_API_KEY is present.
 */
export async function callGemini(prompt, {
  json = false,
  images = [],
  maxOutputTokens = 16384
} = {}) {
  const safeImages = Array.isArray(images) ? images : [];
  let geminiError;

  if (process.env.GEMINI_API_KEY) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await callGeminiOnce(prompt, {
          json,
          images: safeImages,
          maxOutputTokens
        });
      } catch (error) {
        geminiError = error;
        if (!isRetryable(error) || attempt === 1) break;
        await sleep(attempt === 0 ? 1200 : 2200);
      }
    }
  } else {
    geminiError = new Error("GEMINI_API_KEY is not configured.");
    geminiError.status = 401;
  }

  // Do not hide authentication/configuration mistakes behind a provider switch.
  const shouldUseFallback =
    Boolean(process.env.GROQ_API_KEY) &&
    (isRetryable(geminiError) || geminiError?.status === 401);

  if (shouldUseFallback) {
    try {
      return await callGroq(prompt, {
        json,
        images: safeImages,
        maxOutputTokens
      });
    } catch (groqError) {
      throw new Error(
        `Gemini failed: ${geminiError?.message || "unavailable"}. Groq backup also failed: ${groqError?.message || "unknown error"}.`
      );
    }
  }

  if (geminiError?.status === 429 || [500, 502, 503, 504].includes(geminiError?.status)) {
    throw new Error(
      "Gemini is temporarily overloaded. NexaGPT tried again, but no backup provider is configured. Add GROQ_API_KEY in Vercel to enable automatic fallback, then redeploy."
    );
  }

  if (geminiError?.name === "TimeoutError" || geminiError?.name === "AbortError") {
    throw new Error(
      "Gemini took too long to respond. Add GROQ_API_KEY in Vercel to enable automatic backup, or try again shortly."
    );
  }

  throw new Error(geminiError?.message || "AI provider request failed.");
}

export function response(res, status, data) {
  return res.status(status).json(data);
}

export function normalizeHistory(history = []) {
  return Array.isArray(history)
    ? history.slice(-12).map(item => ({
        role: item?.role === "assistant" ? "assistant" : "user",
        content: clean(item?.content || item?.text, 4000)
      })).filter(item => item.content)
    : [];
}
