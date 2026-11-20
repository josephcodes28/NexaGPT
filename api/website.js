
"use strict";

/*
 * JOSEPH AI V2 — WEBSITE GENERATION ENGINE
 *
 * Primary provider: Google Gemini
 * Backup provider: Groq
 *
 * Generates:
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
  res.setHeader(
    "Content-Type",
    "application/json; charset=utf-8"
  );

  return res.end(JSON.stringify(data));
}

function cleanGeneratedText(value) {
  if (typeof value !== "string") return "";

  return value
    .replace(/^```(?:json|html|css|javascript|js)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function normalizeGeneratedCode(value) {
  if (typeof value !== "string") return "";

  const escapedNewlines = (value.match(/\\n/g) || []).length;
  const actualNewlines = (value.match(/\n/g) || []).length;

  if (escapedNewlines >= 3 && actualNewlines <= 1) {
    return value
      .replace(/\\r\\n/g, "\n")
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\n")
      .replace(/\\t/g, "  ");
  }

  return value;
}

function extractJSON(value) {
  if (typeof value !== "string") {
    throw new Error("The AI returned an empty response.");
  }

  const cleaned = cleanGeneratedText(value);

  try {
    return JSON.parse(cleaned);
  } catch (_) {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace <= firstBrace) {
      throw new Error("The AI response was not valid JSON.");
    }

    return JSON.parse(
      cleaned.slice(firstBrace, lastBrace + 1)
    );
  }
}

function validateFiles(data) {
  if (!data || typeof data !== "object") {
    throw new Error("The AI did not return a valid project.");
  }

  const html = normalizeGeneratedCode(data.html);
  const css = normalizeGeneratedCode(data.css);
  const js = normalizeGeneratedCode(data.js);

  if (!html || !css || !js) {
    throw new Error(
      "The AI must return all three files: HTML, CSS, and JavaScript."
    );
  }

  if (
    html.length > MAX_FILE_LENGTH ||
    css.length > MAX_FILE_LENGTH ||
    js.length > MAX_FILE_LENGTH
  ) {
    throw new Error(
      "The generated project is too large. Please simplify the project brief."
    );
  }

  if (!/<html[\s>]/i.test(html) || !/<\/html>/i.test(html)) {
    throw new Error(
      "The generated HTML document is incomplete."
    );
  }

  if (!/<body[\s>]/i.test(html) || !/<\/body>/i.test(html)) {
    throw new Error(
      "The generated HTML is missing its body section."
    );
  }

  return { html, css, js };
}

function buildPrompt(briefText) {
  return `
You are Joseph AI's professional website development engine.

Your task is to create a complete, polished, responsive FRONTEND WEBSITE
based on the user's project brief.

THE USER'S BRIEF IS THE SOURCE OF TRUTH.

USER PROJECT BRIEF:
${briefText}

==================================================
1. FOLLOW THE USER'S INSTRUCTIONS
==================================================

- Read the entire brief before writing code.
- Follow the requested business type, project name, audience, sections,
  features, visual style, colors, and reference details.
- Do not replace the requested project with a generic template.
- Do not silently remove requested sections or features.
- Do not invent business addresses, phone numbers, email addresses,
  prices, testimonials, awards, certifications, or company history.
- If information is missing, use neutral editable content instead of
  pretending that invented information is real.
- Use the requested brand name consistently.
- Make the website look like a real professional business website,
  not a coding exercise or a basic demo.

==================================================
2. PROFESSIONAL DESIGN QUALITY
==================================================

Create a polished, modern, visually impressive website.

Use:
- Strong visual hierarchy.
- Professional typography.
- Consistent spacing and alignment.
- Attractive section layouts.
- Clear calls to action.
- Responsive cards and grids.
- Good contrast and readable text.
- Thoughtful colors based on the user's brief.
- Subtle transitions and hover effects where appropriate.
- Professional mobile and desktop layouts.

Avoid:
- Plain unstyled HTML.
- Excessive empty space.
- Random colors.
- Tiny text.
- Overcrowded sections.
- Generic layouts that ignore the business type.
- Fake 3D effects that make the website difficult to use.
- Unnecessary animations that slow down the page.

The first screen should communicate what the business offers and
provide a clear next action.

==================================================
3. RESPONSIVE DESIGN
==================================================

The website must work on:
- Small Android phones.
- Larger mobile phones.
- Tablets.
- Desktop screens.

Requirements:
- Include a correct viewport meta tag.
- Use flexible layouts and responsive CSS.
- Prevent horizontal overflow.
- Make navigation usable on mobile.
- Ensure buttons are easy to tap.
- Make images scale correctly.
- Keep text readable at small screen sizes.

==================================================
4. NAVIGATION MUST WORK
==================================================

Every navigation link must have a valid destination.

For a one-page website:
- Use section links such as #home, #about, #services, #gallery,
  #menu, and #contact.
- Every referenced section ID must actually exist.
- Do not create links to sections that do not exist.
- Navigation must scroll to the correct section.
- A mobile menu button must open and close the menu.
- Selecting a mobile navigation link must close the menu.

IMPORTANT PREVIEW SAFETY:
- Never use href="/" or href="/index.html" for internal navigation.
- Never use href="index.html" for internal navigation.
- Never use target="_top" or target="_parent".
- Never navigate the parent page or the website hosting the preview.
- Never use window.top, window.parent, or parent.location.
- Do not use window.location or location.href to navigate between
  sections. Use normal #section anchor links.
- Do not create links that escape the generated website preview.
- External links must only be used when the brief requires them or
  provides the destination.

==================================================
5. BUTTONS AND INTERACTIVE FEATURES
==================================================

Every visible button must do something meaningful.

Examples:
- Mobile menu buttons must open and close the menu.
- WhatsApp buttons must open the correct WhatsApp conversation
  when the user supplied a contact number.
- Phone buttons must use tel: with a supplied phone number.
- Email buttons must use mailto: with a supplied email address.
- Section buttons must navigate to real sections.
- Gallery controls must work if included.
- Tabs, accordions, and other interactive controls must work
  if included.

Do not create decorative buttons that do nothing.

Do not invent contact details.

If a contact number is supplied:
- Preserve the correct country code.
- For a Nigerian number beginning with 0, convert it to country code
  234 and remove the leading 0.
- Remove spaces and punctuation from the WhatsApp number.
- Use https://wa.me/ followed by the normalized digits.

Do not invent a WhatsApp number if none was provided.

==================================================
6. IMAGES AND GALLERIES
==================================================

Images must not break the website.

- Use only stable, direct image URLs when you are confident they are valid.
- Prefer known static images hosted on images.unsplash.com.
- Never use source.unsplash.com.
- Never use random image URLs or fabricated image paths.
- Do not use URLs that require a special API key.
- Do not use an image URL if you are unsure it exists.
- Do not create a gallery full of broken image links.
- Add meaningful alt text to images.
- Use object-fit: cover where appropriate.
- Give image containers sensible dimensions and responsive behavior.

If a suitable reliable image URL is not known:
- Use a visually attractive CSS background, gradient, or designed
  placeholder instead of a broken image.
- Keep the layout professional even without external images.

For gallery images, ensure the image itself is styled correctly.
Do not apply padding-bottom aspect-ratio tricks directly to img elements.
Use a wrapper with aspect-ratio and place the image inside it.

==================================================
7. FORMS AND BUSINESS FUNCTIONALITY
==================================================

This generation stage creates a frontend website only.

- Do not pretend a form has been sent to a server.
- Do not display fake booking confirmations.
- Do not claim an order was saved or paid for.
- Do not pretend customer accounts or databases exist.
- Do not create fake payment processing.
- Do not claim that a booking, order, or message was received
  unless a real service is connected.

If a form is requested but no backend is available:
- Provide honest frontend behavior.
- Where appropriate, use a supplied email address or WhatsApp number
  to let the customer contact the business.
- Otherwise show a clear message explaining that submission
  needs a backend connection.

Do not invent API endpoints or pretend they work.

==================================================
8. CODE QUALITY
==================================================

HTML:
- Return a complete HTML5 document.
- Include semantic elements.
- Include title, description, and viewport metadata.
- Use correct IDs and accessible labels.
- Link style.css and script.js using relative filenames.

CSS:
- Return the complete stylesheet.
- Include responsive breakpoints.
- Avoid conflicting or incomplete selectors.
- Ensure images and cards display correctly.
- Include visible focus states for keyboard accessibility.

JavaScript:
- Return complete working JavaScript.
- Use defensive checks before accessing optional elements.
- Avoid uncaught errors when an optional element is missing.
- Use event listeners for interactions.
- Do not use inline JavaScript event attributes.
- Do not use eval or dynamically execute arbitrary code.
- Do not manipulate the parent page or escape the preview.

Make sure the HTML, CSS, and JavaScript work together.

==================================================
9. OUTPUT FORMAT — STRICT
==================================================

Return ONLY one valid JSON object.

It must have exactly these three string properties:

{
  "html": "complete HTML document",
  "css": "complete CSS stylesheet",
  "js": "complete JavaScript file"
}

Rules:
- Do not use Markdown code fences.
- Do not include explanations outside the JSON.
- Do not add extra properties.
- Escape JSON strings correctly.
- Do not omit any of the three files.
- Do not shorten the code with comments such as
  "rest of code here" or "add your styles here".
- Return complete usable code, not pseudocode.

Before responding, internally check:
1. Does the website match the user's brief?
2. Are all requested sections present?
3. Do all internal navigation links point to existing IDs?
4. Do the visible buttons have working behavior?
5. Is the mobile menu functional?
6. Are image URLs stable, or are safe placeholders used?
7. Does the CSS support mobile and desktop?
8. Does the JavaScript avoid errors when optional elements are absent?
9. Does the site avoid navigating outside its preview?
10. Are all three files complete?

Now generate the complete website.
`;
}

async function fetchJSON(url, options, timeoutMs) {
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    timeoutMs
  );

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    const raw = await response.text();

    let data;

    try {
      data = JSON.parse(raw);
    } catch (_) {
      throw new Error(
        `Provider returned an unreadable response (HTTP ${response.status}).`
      );
    }

    if (!response.ok) {
      const message =
        data?.error?.message ||
        data?.message ||
        `Provider request failed (HTTP ${response.status}).`;

      throw new Error(message);
    }

    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Provider request timed out.");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function generateWithGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const model =
    process.env.GEMINI_MODEL ||
    "gemini-3.5-flash-lite";

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const data = await fetchJSON(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.35,
          maxOutputTokens: 12000
        }
      })
    },
    GEMINI_TIMEOUT
  );

  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("") || "";

  if (!text) {
    throw new Error(
      "Gemini returned no website code."
    );
  }

  const files = validateFiles(extractJSON(text));

  return {
    files,
    provider: "Gemini",
    model
  };
}

async function generateWithGroq(prompt) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured.");
  }

  const model =
    process.env.GROQ_WEBSITE_MODEL ||
    GROQ_DEFAULT_MODEL;

  const data = await fetchJSON(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are a professional website developer. Follow the user's brief and return only the exact JSON object requested."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: {
          type: "json_object"
        },
        temperature: 0.35,
        max_completion_tokens: 12000
      })
    },
    GROQ_TIMEOUT
  );

  const text =
    data?.choices?.[0]?.message?.content || "";

  if (!text) {
    throw new Error(
      "Groq returned no website code."
    );
  }

  const files = validateFiles(extractJSON(text));

  return {
    files,
    provider: "Groq",
    model
  };
}

function getErrorMessage(error) {
  if (!error) return "Unknown provider error.";

  return String(error.message || error)
    .replace(/https?:\/\/\S+/g, "[provider URL]")
    .slice(0, 500);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");

    return sendJSON(res, 405, {
      success: false,
      error: "Method not allowed. Use POST."
    });
  }

  const body = req.body || {};

  if (body.action !== "generate") {
    return sendJSON(res, 400, {
      success: false,
      error: "Unsupported action."
    });
  }

  const brief = body.brief;

  if (
    typeof brief !== "string" ||
    !brief.trim()
  ) {
    return sendJSON(res, 400, {
      success: false,
      error: "Please describe the website you want to build."
    });
  }

  const briefText = brief.trim();

  if (briefText.length > MAX_BRIEF_LENGTH) {
    return sendJSON(res, 413, {
      success: false,
      error:
        `Your project brief is too long. Keep it under ${MAX_BRIEF_LENGTH} characters.`
    });
  }

  if (
    !process.env.GEMINI_API_KEY &&
    !process.env.GROQ_API_KEY
  ) {
    return sendJSON(res, 500, {
      success: false,
      error:
        "Website generation is not configured. Add GEMINI_API_KEY or GROQ_API_KEY in Vercel environment variables."
    });
  }

  const prompt = buildPrompt(briefText);

  let geminiError = null;
  let groqError = null;

  // Try Gemini first.
  if (process.env.GEMINI_API_KEY) {
    try {
      const result = await generateWithGemini(prompt);

      return sendJSON(res, 200, {
        success: true,
        files: result.files,
        provider: result.provider,
        model: result.model,
        fallbackUsed: false,
        note: "Website generated successfully."
      });
    } catch (error) {
      geminiError = getErrorMessage(error);
    }
  }

  // Use Groq if Gemini is unavailable or fails.
  if (process.env.GROQ_API_KEY) {
    try {
      const result = await generateWithGroq(prompt);

      return sendJSON(res, 200, {
        success: true,
        files: result.files,
        provider: result.provider,
        model: result.model,
        fallbackUsed: true,
        note:
          "Website generated successfully using the backup provider."
      });
    } catch (error) {
      groqError = getErrorMessage(error);
    }
  }

  return sendJSON(res, 502, {
    success: false,
    error: "Joseph AI could not generate the website.",
    details: {
      gemini: geminiError || "Not attempted.",
      groq: groqError || "Not attempted."
    }
  });
    }
    
