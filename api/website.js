
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

/*
 * Correct AI responses that contain escaped line breaks
 * throughout a source file instead of actual line breaks.
 *
 * Avoid changing normal JavaScript strings unnecessarily.
 */
function normalizeGeneratedCode(value) {
  if (typeof value !== "string") return "";

  const escapedNewlines = (value.match(/\\n/g) || []).length;
  const actualNewlines = (value.match(/\n/g) || []).length;

  if (
    escapedNewlines >= 3 &&
    escapedNewlines > actualNewlines * 2
  ) {
    return value
      .replace(/\\r\\n/g, "\n")
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\n");
  }

  return value;
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

  const html = normalizeGeneratedCode(
    cleanGeneratedText(files.html || files["index.html"])
  );

  const css = normalizeGeneratedCode(
    cleanGeneratedText(files.css || files["style.css"])
  );

  const js = normalizeGeneratedCode(
    cleanGeneratedText(files.js || files["script.js"])
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
      "The generated website is too large. Please shorten the project description."
    );
  }

  if (
    !/<html[\s>]/i.test(html) &&
    !/<!doctype html/i.test(html)
  ) {
    throw new Error("The generated HTML document is incomplete.");
  }

  if (!/<\/html\s*>/i.test(html)) {
    throw new Error("The generated HTML document is missing its closing tag.");
  }

  return { html, css, js };
}

/* ---------------- GENERATION PROMPT ---------------- */

function buildPrompt(briefText) {
  return `
You are Joseph AI's professional website development engine.

Your job is to create a polished, complete and responsive website
suitable for a real paying client.

PROJECT DETAILS:
${briefText}

OUTPUT FORMAT:

Return exactly one valid JSON object with these three properties:

{
  "html": "Complete HTML document",
  "css": "Complete CSS stylesheet",
  "js": "Complete JavaScript file"
}

All three properties must contain complete source code.

GENERAL DESIGN REQUIREMENTS:

1. Build a professional website that matches the actual business.
2. Do not produce a generic or unfinished template.
3. Create a distinctive visual identity using the requested colours and style.
4. Use polished typography, spacing, layout, cards, buttons and visual hierarchy.
5. Make the first screen attractive and give it a clear headline and call to action.
6. Make the website work on mobile phones, tablets and desktop screens.
7. Use semantic HTML and accessible labels.
8. Include the sections and features requested by the user.
9. Use tasteful animations and useful hover and focus states.
10. Use vanilla JavaScript only.
11. Do not include hidden tracking, analytics or malicious code.
12. Do not invent business contact details, addresses, reviews, awards or factual claims.
13. Use clearly labelled placeholders when information is missing.
14. Do not pretend that a frontend-only feature has a working backend.

IMPORTANT NAVIGATION REQUIREMENTS:

1. Every internal navigation link must use a section ID.
2. Examples:
   href="#home"
   href="#about"
   href="#menu"
   href="#gallery"
   href="#contact"

3. Every internal link must point to an element that actually exists.
4. Do not use "/" or the website root for internal navigation.
5. Do not use links that point to Joseph AI or another unrelated website.
6. Do not use JavaScript to navigate the parent window.
7. Do not use window.top, window.parent or parent.document.
8. Internal navigation must stay within the generated website.
9. Add smooth scrolling where appropriate.
10. Mobile navigation must open and close correctly.
11. Mobile navigation must close after a navigation link is selected.
12. Ensure the mobile menu button has a working click handler and correct aria-expanded state.

IMAGE REQUIREMENTS:

1. Use relevant, direct image URLs from reliable public image sources.
2. Prefer stable images hosted on images.unsplash.com when appropriate.
3. Do not use source.unsplash.com or random image-search endpoints.
4. Do not invent image URLs.
5. Do not use broken local image paths.
6. Every image must have meaningful alt text.
7. Add sensible width, height and object-fit styling.
8. Add an image error handler or fallback presentation so a failed image does not leave a broken-image icon.
9. Gallery images must have consistent sizing and responsive layouts.
10. Do not let an image error break the rest of the website.

HTML REQUIREMENTS:

1. Return a complete HTML5 document.
2. Include charset, viewport and useful SEO metadata.
3. Link to style.css.
4. Load script.js near the end of the body.
5. Use unique IDs for all page sections.
6. Ensure every button has an appropriate type.
7. Ensure all navigation targets exist.
8. Do not place the entire stylesheet or JavaScript inside the HTML.
9. Do not include scripts that load Joseph AI or unrelated application files.
10. Do not include absolute links to the Joseph AI application.

CSS REQUIREMENTS:

1. Return a complete stylesheet.
2. Include mobile and desktop responsive breakpoints.
3. Style every section and visible control.
4. Ensure gallery images use aspect-ratio and object-fit correctly.
5. Include visible keyboard focus states.
6. Avoid unfinished or unstyled sections.
7. Avoid hiding the entire page with opacity or animation.
8. Respect reduced-motion preferences.

JAVASCRIPT REQUIREMENTS:

1. Return a complete JavaScript file.
2. Use vanilla JavaScript only.
3. Wait for DOMContentLoaded when necessary.
4. Check that optional elements exist before attaching event listeners.
5. Implement mobile navigation.
6. Implement internal section navigation without leaving the generated website.
7. Implement gallery interactions only when gallery elements exist.
8. Never access or modify the parent Joseph AI application.
9. Never use window.top or window.parent.
10. Do not claim that forms have been sent or saved when there is no backend.
11. Frontend-only forms must clearly explain that they are demonstrations or provide an honest contact alternative.
12. Every visible interactive control must have a meaningful action.

SECURITY AND QUALITY:

- No hidden data collection.
- No fake payment processing.
- No fake login.
- No fake database.
- No fake order confirmation.
- No fake contact-message delivery.
- No unrelated external scripts.
- No broken navigation links.
- No placeholder buttons pretending to work.

FINAL OUTPUT:

Return only valid JSON.
Include exactly the three string properties:
html, css and js.

Do not include Markdown fences.
Do not include explanations outside the JSON.
`;
}

/* ---------------- PROVIDER REQUEST HELPER ---------------- */

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
        "Provider returned an unreadable response."
      );
    }

    if (!response.ok) {
      const message =
        data?.error?.message ||
        data?.error ||
        `Provider returned HTTP ${response.status}.`;

      throw new Error(
        `HTTP ${response.status}: ${String(message).slice(0, 400)}`
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
          temperature: 0.65,
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
              "You are Joseph AI's professional website development engine. Return only valid JSON with complete html, css and js string properties. Follow every navigation, image, accessibility and security requirement in the user's prompt."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.65,
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

  // Try Gemini first.
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
        fallbackUsed: false,
        note:
          "Frontend files generated. Real database, login, payment and order services require separate backend integrations."
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
        "Gemini unavailable. Switching to Groq."
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
          "Gemini was unavailable, so Groq generated the website. Real backend services require separate integrations."
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
          
