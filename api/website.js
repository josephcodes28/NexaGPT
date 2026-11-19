
"use strict";

/*
 * JOSEPH AI V2 — WEBSITE GENERATION ENGINE
 *
 * Primary provider: Google Gemini
 * Backup provider: Groq
 *
 * Output:
 * - index.html
 * - style.css
 * - script.js
 *
 * Runtime: Vercel Node.js
 */

const MAX_BRIEF_LENGTH = 12000;
const MAX_FILE_LENGTH = 100000;

const GEMINI_TIMEOUT = 24000;
const GROQ_TIMEOUT = 26000;

const GROQ_DEFAULT_MODEL = "openai/gpt-oss-120b";

function sendJSON(res, status, data) {
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.end(JSON.stringify(data));
}

function cleanGeneratedText(value) {
  if (typeof value !== "string") return "";

  return value
    .replace(/^```(?:json|html|css|javascript|js)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractJSON(text) {
  const cleaned = cleanGeneratedText(text);

  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace <= firstBrace) {
      throw new Error("The AI did not return valid JSON.");
    }

    return JSON.parse(
      cleaned.slice(firstBrace, lastBrace + 1)
    );
  }
}

function validateFiles(data) {
  if (!data || typeof data !== "object") {
    throw new Error("The AI returned an invalid website response.");
  }

  const files = data.files || data;

  const html = cleanGeneratedText(
    files.html || files["index.html"]
  );

  const css = cleanGeneratedText(
    files.css || files["style.css"]
  );

  const js = cleanGeneratedText(
    files.js || files["script.js"]
  );

  if (!html || !css || !js) {
    throw new Error(
      "The AI did not generate all three website files."
    );
  }

  if (
    html.length > MAX_FILE_LENGTH ||
    css.length > MAX_FILE_LENGTH ||
    js.length > MAX_FILE_LENGTH
  ) {
    throw new Error(
      "The generated website is too large. Try a shorter description."
    );
  }

  if (
    !/<html[\s>]/i.test(html) &&
    !/<!doctype html/i.test(html)
  ) {
    throw new Error("The generated HTML document is incomplete.");
  }

  return { html, css, js };
}

function buildPrompt(briefText) {
  return `
You are Joseph AI's professional website development engine.

Create a complete, polished, modern, responsive FRONTEND website using the project details below.

PROJECT DETAILS:
${briefText}

YOUR TASK:
Return exactly one valid JSON object with these three string properties:

{
  "html": "Complete HTML document",
  "css": "Complete CSS stylesheet",
  "js": "Complete JavaScript file"
}

WEBSITE QUALITY REQUIREMENTS:

1. Build a professional website suitable for a real paying client.
2. Create a strong visual identity based on the requested business, style and colours.
3. Use polished spacing, typography, visual hierarchy, attractive sections, buttons, cards and navigation.
4. Make the first screen especially attractive, with a strong headline and useful call to action.
5. Make the website responsive on mobile, tablet and desktop.
6. Use semantic HTML and accessible labels, keyboard-friendly controls and sensible contrast.
7. Include the requested sections and features wherever possible.
8. Implement working frontend interactions using vanilla JavaScript.
9. Make mobile navigation work.
10. Add hover, focus and active states.
11. Use tasteful CSS effects and animations.
12. Use relevant public image URLs only when needed. Never invent local image paths.
13. Do not use external JavaScript libraries or frameworks.
14. Do not include tracking, hidden data collection or malicious code.
15. Never invent phone numbers, email addresses, addresses, reviews, awards or factual claims.
16. Use clearly labelled editable placeholders for missing business information.
17. Never pretend that payments, registration, database storage, bookings or order processing work without real backend integrations.
18. Keep all code complete, readable and organized.
19. Avoid generic templates. Match the design to the actual business.
20. Make every visible frontend control work where possible.

HTML REQUIREMENTS:
- Complete HTML5 document.
- Include viewport and useful SEO metadata.
- Link to style.css.
- Load script.js near the end of the body.
- Do not put all CSS or JavaScript inside the HTML.
- Do not use Markdown fences.

CSS REQUIREMENTS:
- Complete stylesheet.
- Responsive breakpoints.
- Finished visual styling.
- Mobile-first layout where appropriate.

JAVASCRIPT REQUIREMENTS:
- Complete JavaScript file.
- Vanilla JavaScript only.
- Avoid errors when optional elements are absent.
- Do not invent backend functionality.

OUTPUT RULES:
- Return only valid JSON.
- Include all three properties: html, css and js.
- All three properties must contain complete code strings.
- Do not add explanations outside the JSON.
`;
}

async function fetchJSON(url, options, timeoutMs) {
  const controller = new AbortController();

  const timeoutId = setTimeout(
    () => controller.abort(),
    timeoutMs
  );

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error(
        `Provider returned an unreadable response (HTTP ${response.status}).`
      );
    }

    if (!response.ok) {
      const message =
        data?.error?.message ||
        data?.error ||
        `Provider returned HTTP ${response.status}.`;

      throw new Error(
        `HTTP ${response.status}: ${String(message).slice(0, 500)}`
      );
    }

    return data;

  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Provider request timed out.");
    }

    throw error;

  } finally {
    clearTimeout(timeoutId);
  }
}

/* ---------------- GEMINI PRIMARY ---------------- */

async function generateWithGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Gemini API key is not configured.");
  }

  const model =
    process.env.GEMINI_MODEL ||
    "gemini-3.5-flash-lite";

  const endpoint =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(model) +
    ":generateContent";

  const result = await fetchJSON(
    endpoint,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json",
          maxOutputTokens: 12000
        }
      })
    },
    GEMINI_TIMEOUT
  );

  const generatedText =
    result?.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim() || "";

  if (!generatedText) {
    throw new Error("Gemini returned an empty response.");
  }

  const parsed = extractJSON(generatedText);
  const files = validateFiles(parsed);

  return {
    files,
    provider: "Gemini",
    model
  };
}

/* ---------------- GROQ BACKUP ---------------- */

async function generateWithGroq(prompt) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("Groq API key is not configured.");
  }

  const model =
    process.env.GROQ_WEBSITE_MODEL ||
    GROQ_DEFAULT_MODEL;

  const endpoint =
    "https://api.groq.com/openai/v1/chat/completions";

  const result = await fetchJSON(
    endpoint,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are Joseph AI's professional website development engine. Generate complete website files. Return only valid JSON with html, css and js string properties."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_completion_tokens: 12000,
        response_format: {
          type: "json_object"
        }
      })
    },
    GROQ_TIMEOUT
  );

  const generatedText =
    result?.choices?.[0]?.message?.content || "";

  if (
    typeof generatedText !== "string" ||
    !generatedText.trim()
  ) {
    throw new Error("Groq returned an empty response.");
  }

  const parsed = extractJSON(generatedText);
  const files = validateFiles(parsed);

  return {
    files,
    provider: "Groq",
    model
  };
}

/* ---------------- MAIN API HANDLER ---------------- */

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");

    return sendJSON(res, 405, {
      success: false,
      error: "Only POST requests are supported."
    });
  }

  const body = req.body || {};

  if (body.action !== "generate") {
    return sendJSON(res, 400, {
      success: false,
      error: "Unsupported action. Use action: generate."
    });
  }

  const brief = body.brief;

  if (
    !brief ||
    typeof brief !== "object" ||
    Array.isArray(brief)
  ) {
    return sendJSON(res, 400, {
      success: false,
      error: "Please provide your website project details."
    });
  }

  let briefText;

  try {
    briefText = JSON.stringify(brief);
  } catch {
    return sendJSON(res, 400, {
      success: false,
      error: "The website description could not be read."
    });
  }

  if (briefText.length > MAX_BRIEF_LENGTH) {
    return sendJSON(res, 400, {
      success: false,
      error: "Your website description is too long. Please shorten it."
    });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  if (!geminiKey && !groqKey) {
    return sendJSON(res, 500, {
      success: false,
      error:
        "Website Builder is not configured. Add GEMINI_API_KEY or GROQ_API_KEY to Vercel."
    });
  }

  const prompt = buildPrompt(briefText);

  let primaryError = null;
  let backupError = null;

  // Try Gemini first when its key is available.
  if (geminiKey) {
    try {
      const result = await generateWithGemini(prompt);

      console.log(
        "Website generated successfully using Gemini:",
        result.model
      );

      return sendJSON(res, 200, {
        success: true,
        files: result.files,
        provider: result.provider,
        model: result.model,
        note:
          "Frontend website files generated successfully. Real database, login, payment and order services require separate backend integrations."
      });

    } catch (error) {
      primaryError = error.message;

      console.error(
        "Gemini Website Builder failed:",
        primaryError
      );
    }
  } else {
    primaryError = "Gemini API key is not configured.";
  }

  // Automatically try Groq if Gemini fails.
  if (groqKey) {
    try {
      console.log(
        "Gemini unavailable. Switching to Groq Website Builder."
      );

      const result = await generateWithGroq(prompt);

      console.log(
        "Website generated successfully using Groq:",
        result.model
      );

      return sendJSON(res, 200, {
        success: true,
        files: result.files,
        provider: result.provider,
        model: result.model,
        fallbackUsed: true,
        note:
          "Gemini was unavailable, so Groq generated the website instead. These are frontend files; real backend services require separate integrations."
      });

    } catch (error) {
      backupError = error.message;

      console.error(
        "Groq Website Builder failed:",
        backupError
      );
    }
  } else {
    backupError = "Groq API key is not configured.";
  }

  return sendJSON(res, 502, {
    success: false,
    error:
      "Both website generation providers failed. Please try again later.",
    details: {
      gemini: primaryError,
      groq: backupError
    }
  });
      }
      
