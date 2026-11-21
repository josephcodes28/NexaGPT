/* NexaGPT Website Engine V3
 * Gemini primary with bounded retry and Groq fallback.
 * Accepts both {action, brief} and {description, projectName, revision, existingFiles}.
 * Returns the existing normalized + legacy file contract.
 */
const GEMINI_MODEL = 'gemini-3.8-flash';
const GROQ_MODEL = 'openai/gpt-oss-120b';
const MAX_BRIEF = 14000;
const MAX_FILE = 250000;
const GEMINI_TIMEOUT_MS = 18000;
const GROQ_TIMEOUT_MS = 22000;

const schema = {
  type: 'OBJECT',
  properties: {
    projectName: { type: 'STRING' },
    summary: { type: 'STRING' },
    indexHtml: { type: 'STRING' },
    styleCss: { type: 'STRING' },
    scriptJs: { type: 'STRING' },
    features: { type: 'ARRAY', items: { type: 'STRING' } }
  },
  required: ['projectName', 'summary', 'indexHtml', 'styleCss', 'scriptJs', 'features']
};

function respond(res, status, data) {
  if (typeof res.status === 'function') return res.status(status).json(data);
  res.statusCode = status;
  res.setHeader?.('Content-Type', 'application/json; charset=utf-8');
  return res.end(JSON.stringify(data));
}

function imageLibrary(brief) {
  const text = brief.toLowerCase();
  const photos = text.match(/restaurant|food|cafe|café|bakery|bar|grill|pizza|menu/)
    ? [
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1800&q=85',
      'https://images.unsplash.com/photo-1546549032-9571cd6b27df?auto=format&fit=crop&w=1400&q=85',
      'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=1400&q=85',
      'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1400&q=85',
      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1400&q=85'
    ]
    : text.match(/fashion|cloth|boutique|dress|apparel|shoe|jewel/)
    ? [
      'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1800&q=85',
      'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1400&q=85',
      'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1400&q=85'
    ]
    : text.match(/hotel|resort|travel|hospitality/)
    ? [
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1800&q=85',
      'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1400&q=85'
    ]
    : text.match(/real estate|property|house|home|apartment/)
    ? [
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1800&q=85',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=85'
    ]
    : [
      'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1800&q=85',
      'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1400&q=85'
    ];
  return photos.map((url, i) => `${i + 1}. ${url}`).join('\n');
}

function buildPrompt({ projectName, brief, revision, existingFiles }) {
  const photos = imageLibrary(brief);
  const revisionMode = Boolean(revision && existingFiles);
  return `You are NexaGPT's senior product designer and frontend engineering team. Build a client-ready, premium-quality website. This is a real deliverable, not a wireframe, tutorial, starter template, or generic demo.

PROJECT: ${projectName}
CLIENT BRIEF:
${brief}

${revisionMode ? `EXISTING PROJECT FILES (preserve and improve these):\n${JSON.stringify(existingFiles)}\nUSER REVISION:\n${revision}` : ''}

VISUAL PHOTOGRAPHY LIBRARY — use these real image URLs in the page (do not replace them with blank boxes, gradients, emoji, or made-up URLs):
${photos}
Use at least 3 suitable photographs for a multi-section business website when 3 or more are supplied. Use the first as a strong hero image or hero background. Use additional images in gallery, menu/product cards, or supporting sections. Use descriptive alt text and responsive object-fit/cropping. Do not place text inside images.

DESIGN QUALITY REQUIREMENTS:
- First identify the business type, target audience, and conversion goal from the brief.
- Create a distinctive art direction appropriate to that business; do not use the same generic template for every business.
- Strong visual hierarchy, intentional typography, balanced whitespace, premium color palette, clear grid, polished buttons, subtle hover/focus states, and a visually rich hero section.
- The first screen must immediately communicate the business, value proposition, and primary call to action.
- Use real image URLs supplied above. Avoid emoji as icons; use inline SVG icons or simple CSS shapes.
- Build complete useful sections requested by the user, such as About, Services/Menu, Gallery, testimonials only if supplied, Contact, location, opening hours, and reservation/contact form.
- Make the mobile navigation functional. Every internal navigation link must use a real in-page anchor such as href="#about" and must point to an existing element id. Never use href="/", href="/about", href="/gallery", or other root-relative paths for internal sections.
- Keep the entire website self-contained in these three files. No frameworks, no build tools, no remote JavaScript libraries, no external CSS frameworks.
- Use semantic accessible HTML, keyboard-friendly controls, visible focus states, responsive mobile-first CSS, and no horizontal overflow.
- Implement menu open/close, smooth section navigation, and any simple front-end interactions in scriptJs. Ensure menu closes after a section link is tapped on mobile.
- Forms must validate required fields and show an honest preview-only confirmation unless a real backend endpoint is explicitly provided. Never pretend a reservation, order, payment, or message was actually sent.
- Do not invent company facts, addresses, phone numbers, awards, ratings, reviews, prices, or testimonials. If missing, use clearly editable neutral copy or omit the claim.
- Avoid generic filler, lorem ipsum, repeated cards, empty sections, and excessive gradients.

TECHNICAL CONTRACT:
- Return a complete HTML5 document in indexHtml, linking only to style.css and script.js (the renderer combines the files for preview).
- Return all CSS in styleCss and all browser JavaScript in scriptJs.
- Ensure all navigation anchors match actual section IDs exactly.
- Ensure the mobile menu button has aria-expanded and toggles the menu correctly.
- Ensure no generated code tries to navigate to the NexaGPT host app or uses window.top, parent, or top-level navigation.
- Return ONLY valid JSON with exactly these fields: projectName (string), summary (string), indexHtml (string), styleCss (string), scriptJs (string), features (array of strings). Do not use Markdown fences or add explanations outside the JSON object.`;
}

function isRetryable(status) {
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function callGemini(prompt, apiKey) {
  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.75 }
      })
    },
    GEMINI_TIMEOUT_MS
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.message || `Gemini returned HTTP ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  const raw = (data?.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
  if (!raw) throw new Error('Gemini returned an empty result.');
  return JSON.parse(raw);
}

async function callGroq(prompt, apiKey) {
  const response = await fetchWithTimeout(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: 'You are a senior website designer and frontend engineer. Follow the user prompt exactly. Output one valid JSON object only. Do not use Markdown fences.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.65,
        max_tokens: 12000
      })
    },
    GROQ_TIMEOUT_MS
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.message || `Groq returned HTTP ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  const raw = data?.choices?.[0]?.message?.content?.trim();
  if (!raw) throw new Error('Groq returned an empty result.');
  return JSON.parse(raw);
}



// Reliable restaurant photography is injected server-side after generation.
// This prevents the model from returning a visually empty gallery even when it
// ignores the photography instructions in the prompt.
const RESTAURANT_GALLERY_IMAGES = [
  {
    url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1100&q=85',
    alt: 'Fresh colorful salad bowl with vegetables and greens',
    caption: 'Fresh ingredients'
  },
  {
    url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=1100&q=85',
    alt: 'Freshly baked pizza topped with vegetables and cheese',
    caption: 'Made to enjoy'
  },
  {
    url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1100&q=85',
    alt: 'Grilled food served fresh',
    caption: 'From the grill'
  },
  {
    url: 'https://images.unsplash.com/photo-1546549032-9571cd6b27df?auto=format&fit=crop&w=1100&q=85',
    alt: 'Restaurant dish beautifully plated and ready to serve',
    caption: 'Beautifully served'
  },
  {
    url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1100&q=85',
    alt: 'A table filled with a variety of prepared dishes',
    caption: 'A table to share'
  },
  {
    url: 'https://images.unsplash.com/photo-1499028344343-cd173ffc68a9?auto=format&fit=crop&w=1100&q=85',
    alt: 'Freshly prepared burger with sides',
    caption: 'Customer favorites'
  }
];

function isRestaurantBrief(brief) {
  return /restaurant|food|cafe|café|bakery|bistro|grill|pizzeria|pizza|dining|eatery|food\s*shop/i.test(brief);
}

function makeRestaurantGallery() {
  const cards = RESTAURANT_GALLERY_IMAGES.map((photo, index) => `
    <figure class="nexagpt-food-gallery-card">
      <img src="${photo.url}" alt="${photo.alt}" loading="lazy" decoding="async" referrerpolicy="no-referrer">
      <figcaption>${photo.caption}</figcaption>
    </figure>`).join('');
  return `<div class="nexagpt-food-gallery-grid" aria-label="Food photo gallery">${cards}\n  </div>`;
}

function ensureRestaurantGallery(project, brief) {
  if (!isRestaurantBrief(brief)) return project;
  let html = String(project.indexHtml || '');
  let css = String(project.styleCss || '');
  const galleryMarkup = makeRestaurantGallery();
  const gallerySectionPattern = /<section\b[^>]*>[\s\S]*?<\/section>/gi;
  const sections = [...html.matchAll(gallerySectionPattern)];
  const gallerySection = sections.find(match => {
    const openingTag = (match[0].match(/^<section\b[^>]*>/i) || [''])[0];
    return /\bid\s*=\s*(["'])[^"']*gallery[^"']*\1/i.test(openingTag) ||
      /\bclass\s*=\s*(["'])[^"']*gallery[^"']*\1/i.test(openingTag) ||
      /aria-label\s*=\s*(["'])[^"']*gallery[^"']*\1/i.test(openingTag);
  });

  if (gallerySection) {
    const currentSection = gallerySection[0];
    // Keep the generated heading and layout, but guarantee real image elements.
    if (!/nexagpt-food-gallery-grid/.test(currentSection)) {
      const updatedSection = currentSection.replace(/<\/section>\s*$/i, `${galleryMarkup}\n</section>`);
      html = html.replace(currentSection, updatedSection);
    }
  } else {
    // If the model used a non-section wrapper for #gallery, release that ID so
    // the guaranteed gallery below becomes the valid navigation destination.
    html = html.replace(/(<(?!section\b)[a-z][a-z0-9:-]*\b[^>]*?)\s+id\s*=\s*(["'])gallery\2/i, '$1 data-nexagpt-original-gallery="true"');
    const newSection = `<section id="gallery" class="nexagpt-food-gallery-section" aria-label="Food gallery">
      <div class="nexagpt-food-gallery-heading"><p class="eyebrow">A taste of our kitchen</p><h2>Fresh from our kitchen</h2><p>Take a look at dishes made to be enjoyed.</p></div>
      ${galleryMarkup}
    </section>`;
    if (/<\/main>/i.test(html)) html = html.replace(/<\/main>/i, `${newSection}\n</main>`);
    else if (/<\/body>/i.test(html)) html = html.replace(/<\/body>/i, `${newSection}\n</body>`);
    else html += newSection;
  }

  const galleryCss = `\n\n/* NexaGPT guaranteed restaurant gallery images */
.nexagpt-food-gallery-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(12px,2vw,24px);width:100%;margin:28px auto 0}
.nexagpt-food-gallery-card{position:relative;overflow:hidden;margin:0;min-width:0;aspect-ratio:4/3;border-radius:16px;background:#eee;box-shadow:0 8px 24px rgba(0,0,0,.10)}
.nexagpt-food-gallery-card img{display:block;width:100%;height:100%;object-fit:cover;transition:transform .45s ease}
.nexagpt-food-gallery-card:hover img{transform:scale(1.045)}
.nexagpt-food-gallery-card figcaption{position:absolute;left:0;right:0;bottom:0;padding:28px 14px 13px;color:#fff;font-weight:600;font-size:.92rem;background:linear-gradient(transparent,rgba(0,0,0,.68))}
.nexagpt-food-gallery-heading{text-align:center;max-width:680px;margin:0 auto 12px}
.nexagpt-food-gallery-section{padding:clamp(48px,7vw,88px) clamp(18px,5vw,64px)}
@media(max-width:760px){.nexagpt-food-gallery-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.nexagpt-food-gallery-card{border-radius:12px}}
@media(max-width:420px){.nexagpt-food-gallery-grid{grid-template-columns:1fr}.nexagpt-food-gallery-card{aspect-ratio:16/10}}
`;
  if (!css.includes('NexaGPT guaranteed restaurant gallery images')) css += galleryCss;
  return { ...project, indexHtml: html, styleCss: css };
}

function validateProject(project, projectName) {
  if (!project || typeof project !== 'object') throw new Error('The website model returned invalid project data.');
  const html = project.indexHtml;
  const css = project.styleCss;
  const js = project.scriptJs;
  for (const [name, value] of [['index.html', html], ['style.css', css], ['script.js', js]]) {
    if (typeof value !== 'string' || !value.trim()) throw new Error(`The website model did not return a complete ${name} file.`);
    if (value.length > MAX_FILE) throw new Error(`Generated ${name} is too large.`);
  }
  return {
    success: true,
    projectName: String(project.projectName || projectName),
    summary: String(project.summary || 'Website created.'),
    note: String(project.summary || 'Your website preview is ready.'),
    files: { html, css, js, indexHtml: html, styleCss: css, scriptJs: js },
    provider: 'Gemini',
    model: GEMINI_MODEL,
    features: Array.isArray(project.features) ? project.features.filter(x => typeof x === 'string').slice(0, 30) : []
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return respond(res, 405, { success: false, error: 'Only POST requests are supported.' });
  }
  const startedAt = Date.now();
  try {
    const geminiKey = process.env.GEMINI_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;
    if (!geminiKey && !groqKey) {
      return respond(res, 500, { success: false, error: 'Website generation is not configured. Add GEMINI_API_KEY or GROQ_API_KEY in Vercel.' });
    }
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const brief = String(body.description || body.brief || body.prompt || '').trim();
    const projectName = String(body.projectName || 'Website project').trim().slice(0, 160);
    const revision = String(body.revision || '').trim();
    const existingFiles = body.existingFiles && typeof body.existingFiles === 'object' ? body.existingFiles : null;
    if (!brief) return respond(res, 400, { success: false, error: 'Describe the website you want NexaGPT to create.' });
    if (brief.length > MAX_BRIEF) return respond(res, 400, { success: false, error: 'The website brief is too long. Shorten it and try again.' });
    const prompt = buildPrompt({ projectName, brief, revision, existingFiles });

    let project = null;
    let provider = '';
    let geminiError = null;

    if (geminiKey) {
      try {
        project = await callGemini(prompt, geminiKey);
        provider = 'Gemini';
      } catch (error) {
        geminiError = error;
        console.error('[NexaGPT Website Engine] Gemini failed:', error?.status || error?.name, error?.message);
        // A single short retry for a provider overload response. Do not retry permanent 4xx errors.
        if (error?.status === 503) {
          await new Promise(resolve => setTimeout(resolve, 1200));
          try {
            project = await callGemini(prompt, geminiKey);
            provider = 'Gemini';
          } catch (retryError) {
            geminiError = retryError;
            console.error('[NexaGPT Website Engine] Gemini retry failed:', retryError?.status || retryError?.name, retryError?.message);
          }
        }
      }
    }

    if (!project && groqKey && (!geminiKey || isRetryable(geminiError?.status) || !geminiError?.status || geminiError?.name === 'AbortError')) {
      try {
        project = await callGroq(prompt, groqKey);
        provider = 'Groq (backup)';
      } catch (groqError) {
        console.error('[NexaGPT Website Engine] Groq fallback failed:', groqError?.status || groqError?.name, groqError?.message);
        return respond(res, 502, {
          success: false,
          error: 'Both website AI providers are temporarily unavailable or could not complete the request. Please try again shortly.',
          details: {
            gemini: geminiError?.status ? `HTTP ${geminiError.status}` : (geminiError ? geminiError.message : 'Not used'),
            groq: groqError?.status ? `HTTP ${groqError.status}` : groqError.message
          }
        });
      }
    }

    if (!project && geminiError) {
      const status = geminiError?.status || 502;
      const message = status === 503
        ? 'Gemini is overloaded and no working Groq backup is configured. Add GROQ_API_KEY to Vercel, then redeploy.'
        : status === 429
          ? 'Gemini has reached a usage limit and no working Groq backup is configured. Add GROQ_API_KEY to Vercel, then redeploy.'
          : 'The website AI could not complete the request. Check the Vercel function log for details.';
      return respond(res, status >= 500 ? 503 : status, { success: false, error: message });
    }

    if (!project) return respond(res, 503, { success: false, error: 'No website AI provider is currently available. Check your Vercel API keys.' });
    project = ensureRestaurantGallery(project, brief);
    const result = validateProject(project, projectName);
    result.provider = provider;
    result.model = provider === 'Gemini' ? GEMINI_MODEL : GROQ_MODEL;
    result.generationTimeMs = Date.now() - startedAt;
    return respond(res, 200, result);
  } catch (error) {
    console.error('[NexaGPT Website Engine] Unexpected error:', error);
    const timedOut = error?.name === 'AbortError';
    return respond(res, timedOut ? 504 : 502, {
      success: false,
      error: timedOut ? 'Website generation timed out. Please try again with a shorter brief.' : 'The website engine could not validate the generated project. Please try again.'
    });
  }
}
