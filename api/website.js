/* NexaGPT Website Engine V2
 * Accepts both the older {action, brief} contract and the newer
 * {description, projectName, revision, existingFiles} contract.
 * Returns both legacy and normalized file keys for compatibility.
 */
const MODEL = 'gemini-3.8-flash';
const MAX_BRIEF = 14000;
const MAX_FILE = 250000;
const TIMEOUT_MS = 55000;

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
Use at least 3 suitable photographs for a multi-section business website. Use the first as a strong hero image or hero background. Use additional images in gallery, menu/product cards, or supporting sections. Use descriptive alt text and responsive object-fit/cropping. Do not place text inside images.

DESIGN QUALITY REQUIREMENTS:
- First identify the business type, target audience, and conversion goal from the brief.
- Create a distinctive art direction appropriate to that business; do not use the same generic template for every business.
- Strong visual hierarchy, intentional typography, balanced whitespace, premium color palette, clear grid, polished buttons, subtle hover/focus states, and a visually rich hero section.
- The first screen must immediately communicate the business, value proposition, and primary call to action.
- Use real image URLs supplied above. Avoid emoji as icons; use inline SVG icons or simple CSS shapes.
- Build complete useful sections requested by the user, such as About, Services/Menu, Gallery, testimonials only if supplied, Contact, location, opening hours, and reservation/contact form.
- Make the mobile navigation functional. Every internal navigation link must use a real in-page anchor such as href="#about" and must point to an existing element id. Never use href="/", href="/about", href="/gallery", or other root-relative paths for internal sections.
- Keep the entire website self-contained in these three files. No frameworks, no build tools, no remote JavaScript libraries, no dependencies, no external CSS frameworks.
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
- Return ONLY valid JSON matching the required schema. No Markdown fences, no explanations outside JSON.`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return respond(res, 405, { success: false, error: 'Only POST requests are supported.' });
  }
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return respond(res, 500, { success: false, error: 'Website generation is not configured: GEMINI_API_KEY is missing.' });
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const brief = String(body.description || body.brief || body.prompt || '').trim();
    const projectName = String(body.projectName || 'Website project').trim().slice(0, 160);
    const revision = String(body.revision || '').trim();
    const existingFiles = body.existingFiles && typeof body.existingFiles === 'object' ? body.existingFiles : null;
    if (!brief) return respond(res, 400, { success: false, error: 'Describe the website you want NexaGPT to create.' });
    if (brief.length > MAX_BRIEF) return respond(res, 400, { success: false, error: 'The website brief is too long. Shorten it and try again.' });
    const prompt = buildPrompt({ projectName, brief, revision, existingFiles });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let response;
    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.85 }
        }),
        signal: controller.signal
      });
    } finally { clearTimeout(timer); }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = data?.error?.message || `Gemini returned HTTP ${response.status}.`;
      console.error('[NexaGPT Website Engine]', response.status, detail);
      return respond(res, response.status === 429 ? 429 : 502, { success: false, error: response.status === 429 ? 'The website AI has reached its current usage limit. Try again after the quota resets.' : 'The website engine could not generate the project. Check the Vercel function log for the provider error.' });
    }
    const raw = (data?.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
    if (!raw) return respond(res, 502, { success: false, error: 'The website model returned an empty result.' });
    let project;
    try { project = JSON.parse(raw); } catch { return respond(res, 502, { success: false, error: 'The website model returned invalid project data. Please retry.' }); }
    const html = project.indexHtml;
    const css = project.styleCss;
    const js = project.scriptJs;
    for (const [name, value] of [['index.html', html], ['style.css', css], ['script.js', js]]) {
      if (typeof value !== 'string' || !value.trim()) return respond(res, 502, { success: false, error: `The website model did not return a complete ${name} file.` });
      if (value.length > MAX_FILE) return respond(res, 502, { success: false, error: `Generated ${name} is too large.` });
    }
    const files = { html, css, js, indexHtml: html, styleCss: css, scriptJs: js };
    return respond(res, 200, {
      success: true,
      projectName: String(project.projectName || projectName),
      summary: String(project.summary || 'Website created.'),
      note: String(project.summary || 'Your website preview is ready.'),
      files,
      provider: 'Gemini',
      model: MODEL,
      features: Array.isArray(project.features) ? project.features.filter(x => typeof x === 'string').slice(0, 30) : []
    });
  } catch (error) {
    console.error('[NexaGPT Website Engine] Unexpected error:', error);
    return respond(res, error?.name === 'AbortError' ? 504 : 500, { success: false, error: error?.name === 'AbortError' ? 'Website generation timed out. Try a shorter brief.' : 'The website engine encountered an unexpected error.' });
  }
}
