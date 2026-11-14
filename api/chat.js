
"use strict";

/*
 * JOSEPH AI V2
 * MAIN AI CHAT BACKEND
 *
 * Provider: Google Gemini API
 * Runtime: Vercel Node.js
 */

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/";

const DEFAULT_MODEL = "gemini-2.5-flash";

const SYSTEM_INSTRUCTION = `
You are Joseph AI, an intelligent AI assistant and digital worker.

Your responsibilities:
1. Answer questions clearly and accurately.
2. Explain difficult things in simple steps when needed.
3. Help users build professional websites, applications and games.
4. Help with content creation, research and legitimate online work.
5. Give practical advice and identify weak or unrealistic ideas honestly.
6. Never invent facts, job listings, completed actions or research results.
7. Never claim to have performed an action that you have not performed.
8. Ask for clarification when essential information is missing.
9. Respect user instructions and protect private information.
10. Be professional, helpful and honest.

You are the Brain of Joseph AI.
`;

function sendJSON(res, status, data) {
  return res.status(status).json(data);
}

function cleanText(value, maxLength = 12000) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .slice(-20)
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const role =
        item.role === "assistant" || item.role === "model"
          ? "model"
          : item.role === "user"
            ? "user"
            : null;

      const text = cleanText(
        item.content || item.text || item.message,
        5000
      );

      if (!role || !text) return null;

      return {
        role,
        parts: [{ text }]
      };
    })
    .filter(Boolean);
}

function extractReply(data) {
  const candidates = data?.candidates || [];

  for (const candidate of candidates) {
    const parts = candidate?.content?.parts || [];

    const reply = parts
      .map((part) => part.text || "")
      .join("")
      .trim();

    if (reply) return reply;
  }

  return "";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");

    return sendJSON(res, 405, {
      success: false,
      error: "Only POST requests are supported."
    });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return sendJSON(res, 503, {
        success: false,
        error:
          "Gemini is not configured yet. Add GEMINI_API_KEY to your Vercel environment variables."
      });
    }

    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body || {};

    const message = cleanText(
      body.message || body.prompt,
      12000
    );

    if (!message) {
      return sendJSON(res, 400, {
        success: false,
        error: "Please enter a message."
      });
    }

    const model = cleanText(
      process.env.GEMINI_MODEL || DEFAULT_MODEL,
      100
    );

    const history = normalizeHistory(
      body.conversation
    );

    // The current message is sent separately.
    // Avoid sending it twice if it is already in history.
    const previousMessages = history.filter(
      (item, index) =>
        !(
          index === history.length - 1 &&
          item.role === "user" &&
          item.parts[0].text === message
        )
    );

    const contents = [
      ...previousMessages,
      {
        role: "user",
        parts: [{ text: message }]
      }
    ];

    const controller = new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      45000
    );

    let geminiResponse;

    try {
      geminiResponse = await fetch(
        `${GEMINI_API_URL}${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: SYSTEM_INSTRUCTION }]
            },
            contents,
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 4096
            }
          }),
          signal: controller.signal
        }
      );
    } finally {
      clearTimeout(timeout);
    }

    const result = await geminiResponse.json().catch(
      () => ({})
    );

    if (!geminiResponse.ok) {
      const providerMessage =
        result?.error?.message ||
        "The AI provider could not complete the request.";

      console.error(
        "Gemini API error:",
        geminiResponse.status,
        providerMessage
      );

      if (geminiResponse.status === 401 ||
          geminiResponse.status === 403) {
        return sendJSON(res, 502, {
          success: false,
          error:
            "Gemini rejected the API credentials. Check your Vercel GEMINI_API_KEY setting."
        });
      }

      if (geminiResponse.status === 429) {
        return sendJSON(res, 503, {
          success: false,
          error:
            "Gemini request limit reached. Please wait and try again."
        });
      }

      if (geminiResponse.status === 404) {
        return sendJSON(res, 502, {
          success: false,
          error:
            `Gemini model "${model}" was not found or is unavailable. Check GEMINI_MODEL.`
        });
      }

      return sendJSON(res, 502, {
        success: false,
        error:
          "Gemini could not complete the request. Please try again.",
        providerStatus: geminiResponse.status
      });
    }

    const reply = extractReply(result);

    if (!reply) {
      return sendJSON(res, 502, {
        success: false,
        error:
          "Gemini returned no readable response. Please try a different message."
      });
    }

    return sendJSON(res, 200, {
      success: true,
      reply,
      text: reply,
      model,
      sources: []
    });

  } catch (error) {
    console.error("Joseph AI chat error:", error);

    if (error.name === "AbortError") {
      return sendJSON(res, 504, {
        success: false,
        error:
          "The AI request took too long. Please try again."
      });
    }

    return sendJSON(res, 500, {
      success: false,
      error:
        "Joseph AI encountered a server error. Please try again."
    });
  }
  }
  
