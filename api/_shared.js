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

  try {
    return JSON.parse(source);
  } catch {}

  // Recover a JSON object if the model added a short sentence around it.
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start < 0 || end <= start) return fallback;

  try {
    return JSON.parse(source.slice(start, end + 1));
  } catch {
    return fallback;
  }
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function callGemini(prompt, { json = false, images = [], maxOutputTokens = 16384 } = {}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY is not configured. Add it in Vercel → Project Settings → Environment Variables.");
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const parts = [{ text: String(prompt || "") }];

  for (const image of images.slice(0, 3)) {
    if (!image || typeof image.data !== "string" || !image.type) continue;
    const base64 = image.data.includes(",") ? image.data.split(",")[1] : image.data;
    if (base64) parts.push({ inline_data: { mime_type: image.type, data: base64 } });
  }

  let lastError;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
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
          signal: AbortSignal.timeout(70000)
        }
      );

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = body?.error?.message || `Gemini request failed (${response.status}).`;
        const error = new Error(message);
        error.status = response.status;
        throw error;
      }

      const text = body?.candidates?.[0]?.content?.parts
        ?.map(part => typeof part.text === "string" ? part.text : "")
        .join("")
        .trim();

      if (!text) {
        const reason = body?.promptFeedback?.blockReason ||
          body?.candidates?.[0]?.finishReason ||
          "The model returned an empty response.";
        throw new Error(`Gemini did not return usable text: ${reason}`);
      }

      return text;
    } catch (error) {
      lastError = error;
      const retryable = error.status === 429 ||
        [500, 502, 503, 504].includes(error.status) ||
        error.name === "TimeoutError" ||
        error.name === "AbortError";

      if (!retryable || attempt === 1) break;
      await sleep(900);
    }
  }

  if (lastError?.status === 429) {
    throw new Error("Gemini is temporarily busy or rate-limited. Please wait briefly and try again.");
  }
  if (lastError?.name === "TimeoutError" || lastError?.name === "AbortError") {
    throw new Error("Gemini took too long to respond. Try a shorter request or try again shortly.");
  }
  throw new Error(lastError?.message || "Gemini request failed.");
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
