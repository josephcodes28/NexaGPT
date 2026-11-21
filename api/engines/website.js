import { callGemini, parseJson, clean } from "../_shared.js";

function fallbackDomain(message) {
  const match = String(message || "").match(/\b(barber|salon|fashion|restaurant|hotel|church|real estate|portfolio|school|education|healthcare|travel|e-?commerce)\b/i);
  return match ? match[0] : "the business or project described";
}

function normalizeConcept(concept, index) {
  return {
    ...concept,
    id: concept?.id || `concept-${index + 1}`,
    kind: "website",
    title: clean(concept?.title, 100) || `Design direction ${index + 1}`,
    description: clean(concept?.description, 700),
    designBrief: clean(concept?.designBrief || concept?.description, 1200),
    structure: Array.isArray(concept?.structure) ? concept.structure.slice(0, 12) : [],
    features: Array.isArray(concept?.features) ? concept.features.slice(0, 12) : [],
    previewHtml: clean(concept?.previewHtml, 9000)
  };
}

export async function handleWebsite(ctx) {
  const brief = clean(ctx.message, 9000);
  const chosen = ctx.selection;

  if (!chosen) {
    const prompt = `You are NexaGPT's senior website strategist and art director.
Understand this exact request. Do not force it into a generic business template.

USER REQUEST:
${brief}

Return JSON only:
{
 "domain":"specific business/domain",
 "audience":"target audience",
 "purpose":"main conversion goal",
 "concepts":[
  {
   "id":"concept-1",
   "title":"distinct concept name",
   "description":"short explanation of the customer experience",
   "designBrief":"specific visual identity, typography, layout, imagery and interaction direction",
   "structure":["section 1","section 2"],
   "features":["feature 1","feature 2"],
   "previewHtml":"a small self-contained visual website mockup fragment"
  }
 ]
}

Provide EXACTLY five genuinely different concepts. Each must differ in layout, visual identity and customer experience, not merely colours.
The concepts must fit the actual request. Include domain-specific sections and workflows.
For previewHtml, provide a small visual mockup fragment with inline CSS, no JavaScript, no external assets, no external URLs and no forms. Keep it under 1300 characters. Use realistic visual blocks, typography and layout so a user can compare the concepts visually.
Do not invent real company facts, contact details, addresses or customer testimonials.`;

    const raw = await callGemini(prompt, { json: true, maxOutputTokens: 10000 });
    const data = parseJson(raw, null);

    if (!Array.isArray(data?.concepts) || data.concepts.length < 5) {
      throw new Error("The website art director did not return five complete design concepts. Please try again.");
    }

    const concepts = data.concepts.slice(0, 5).map(normalizeConcept);

    return {
      reply: `I understand your ${data.domain || fallbackDomain(brief)} website request. I've prepared five different design directions. Compare their visual previews and choose the one you want me to build.`,
      domain: clean(data.domain, 120) || fallbackDomain(brief),
      audience: clean(data.audience, 500),
      purpose: clean(data.purpose, 500),
      concepts
    };
  }

  const selected = normalizeConcept(chosen, 0);
  const prompt = `You are a senior frontend engineer and visual designer.
Build a complete, polished, responsive FRONTEND website. Generate all three files in full.

ORIGINAL USER REQUEST:
${brief}

USER'S SELECTED DESIGN:
${selected.title}
${selected.designBrief}
Structure: ${JSON.stringify(selected.structure)}
Features: ${JSON.stringify(selected.features)}

Return JSON only with exactly these keys:
{
 "projectName":"...",
 "summary":"...",
 "indexHtml":"complete HTML document",
 "styleCss":"complete CSS stylesheet",
 "scriptJs":"complete JavaScript file",
 "features":["..."]
}

Requirements:
- Build the selected design, not a different design.
- Make the website distinctive, professional and suitable for the exact business.
- Mobile-first responsive layout with desktop/tablet breakpoints.
- HTML must link to style.css and script.js.
- Include accessible labels, semantic HTML, keyboard-friendly controls and visible focus states.
- Add meaningful frontend interactions appropriate to the business (menus, tabs, filters, gallery, FAQ, form validation, etc.).
- Use realistic sample content but clearly mark business-specific placeholders for the owner to edit.
- Do not invent real phone numbers, addresses, prices, reviews or business claims.
- Do not claim real payment, booking, database, authentication or backend integrations.
- Do not use external JavaScript libraries or remote scripts.
- Keep code complete; do not use ellipses, TODOs or omitted sections.
- Return valid JSON and escape newlines correctly.`;

  const raw = await callGemini(prompt, { json: true, maxOutputTokens: 16384 });
  const data = parseJson(raw, null);

  const html = clean(data?.indexHtml, 90000);
  const css = clean(data?.styleCss, 90000);
  const js = clean(data?.scriptJs, 90000);

  if (!html || !css || !js) {
    throw new Error("The website model did not return all three complete files. Try again; your selected concept has not been lost.");
  }

  return {
    reply: `I've created the ${clean(data.projectName, 120) || "website"} frontend using your selected design. Preview it, test its frontend interactions and download the files.`,
    artifact: {
      type: "website",
      title: clean(data.projectName, 120) || "Website",
      summary: clean(data.summary, 1000),
      files: { html, css, js },
      features: Array.isArray(data.features) ? data.features.slice(0, 20) : [],
      selectedConcept: selected.title
    }
  };
}
