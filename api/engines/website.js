import { callGemini, parseJson, clean } from "../_shared.js";

function fallbackDomain(message) {
  const match = String(message || "").match(/\b(barber|salon|fashion|restaurant|hotel|church|real estate|portfolio|school|education|healthcare|travel|e-?commerce|construction|architecture|gym|clinic|law firm|automotive)\b/i);
  return match ? match[0] : "the business or project described";
}

function requestedStyle(message) {
  const text = String(message || "").toLowerCase();
  if (/\b(3d|three[- ]dimensional|immersive| WebGL|three\.js)\b/i.test(text)) return "3D / immersive";
  if (/\b(photo|photography|picture|image|gallery|portfolio gallery)\b/i.test(text)) return "photo-led / gallery";
  if (/\b(minimal|clean|minimalist)\b/i.test(text)) return "minimal / clean";
  if (/\b(luxury|premium|elegant)\b/i.test(text)) return "luxury / premium";
  return "choose the most suitable visual style; include varied colour palettes across the five concepts";
}

function normalizeConcept(concept, index) {
  return {
    ...concept,
    id: concept?.id || `concept-${index + 1}`,
    kind: "website",
    title: clean(concept?.title, 100) || `Design direction ${index + 1}`,
    description: clean(concept?.description, 700),
    designBrief: clean(concept?.designBrief || concept?.description, 1600),
    structure: Array.isArray(concept?.structure) ? concept.structure.slice(0, 16) : [],
    features: Array.isArray(concept?.features) ? concept.features.slice(0, 16) : [],
    previewHtml: clean(concept?.previewHtml, 9000)
  };
}

export async function handleWebsite(ctx) {
  const brief = clean(ctx.message, 9000);
  const chosen = ctx.selection;
  const websiteType = ctx.task?.websiteType || "website";
  if (websiteType === "backend" || websiteType === "fullstack") {
    return { reply: websiteType === "backend"
      ? "I understood that you want a BACKEND-only system (server/API, database and business logic), not a frontend website. The current website engine does not yet generate or test backend-only projects, so I will not give you a frontend and pretend it is a backend. This capability still needs to be implemented."
      : "I understood that you want a FULL-STACK website (frontend plus a real backend, database and business logic). The current website engine currently generates frontend files only, so I will not claim that a frontend prototype is a complete full-stack system. Full-stack generation still needs to be implemented." };
  }

  if (!chosen) {
    const stylePreference = requestedStyle(brief);
    const prompt = `You are NexaGPT's senior website strategist, UX architect and art director.
Understand the exact request and design for that specific industry. Never force every business into the same template.

USER REQUEST:
${brief}

WEBSITE SCOPE: ${websiteType.toUpperCase()} (this engine currently proceeds only with frontend generation).\nSTYLE REQUEST DETECTED: ${stylePreference}

Return JSON only:
{
 "domain":"specific business/domain",
 "audience":"target audience",
 "purpose":"main conversion goal",
 "concepts":[
  {
   "id":"concept-1",
   "title":"distinct concept name",
   "description":"short explanation of customer experience",
   "designBrief":"specific visual identity, palette, typography, layout, imagery and interactions",
   "structure":["navigation/menu items and sections"],
   "features":["domain-specific features"],
   "previewHtml":"small self-contained visual website mockup fragment"
  }
 ]
}

Provide EXACTLY five genuinely different concepts. Make their layouts, visual identities, colour palettes, typography, imagery and customer journeys noticeably different. Do not merely recolour one template. Use suitable combinations of light, dark, vivid, muted, warm, cool, neutral or bold palettes as appropriate. If the user asks for 3D, all five concepts should clearly use an immersive 3D direction; if they ask for normal photos/gallery, use a polished photo-led design and do not force 3D. If no style is specified, include a sensible range of visual approaches, with at least one photo-led concept and one distinctive immersive/3D-inspired concept where appropriate for the business.

EVERY concept must include a real, visible, business-specific navigation/menu in its design preview and planned structure. Include Home, About, and Contact where suitable, then industry-specific links. A barber/salon may need Services, Barbers/Team, Gallery, Pricing, Booking and Contact. A hotel may need Rooms, Amenities, Gallery, Offers, Reservations and Contact. A fashion store must include Shop, Collections, product categories, product details, Cart/Bag, Orders and Contact. A restaurant must include Menu, Food Gallery, About, Reservations/Order and Contact. A construction company may need Services, Projects/Portfolio, Process, About, Request a Quote and Contact. Adapt menus to the actual business, not these examples alone.

For previewHtml, provide a small visual mockup fragment with inline CSS, no JavaScript, no external assets, no external URLs and no forms. Show the navigation visually. Keep it under 1300 characters. Do not invent real company facts, contact details, addresses, prices or testimonials.`;

    const raw = await callGemini(prompt, { json: true, maxOutputTokens: 12000 });
    const data = parseJson(raw, null);

    if (!Array.isArray(data?.concepts) || data.concepts.length < 5) {
      throw new Error("The website art director did not return five complete design concepts. Please try again.");
    }

    const concepts = data.concepts.slice(0, 5).map(normalizeConcept);
    return {
      reply: `I understand your ${clean(data.domain, 120) || fallbackDomain(brief)} website request. I've prepared five different design directions with their own colours, layouts and business-specific menus. Compare the previews and choose one. Before I finish the website, I'll make sure the contact method and any WhatsApp ordering details are configured.`,
      domain: clean(data.domain, 120) || fallbackDomain(brief),
      audience: clean(data.audience, 500),
      purpose: clean(data.purpose, 500),
      concepts
    };
  }

  const selected = normalizeConcept(chosen, 0);
  const prompt = `You are a senior frontend engineer, accessibility-minded UX designer and conversion specialist.
Build a complete, polished, production-quality FRONTEND website. Generate all three files in full.

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
 "features":["..."],
 "ownerSetupNeeded":["details the owner must supply before launch"]
}

NON-NEGOTIABLE WEBSITE REQUIREMENTS:
1. Build the selected design, not a different design. Honour the requested 3D / immersive style or normal photo-led / gallery style exactly. A 3D request should visibly feel 3D through layered depth, perspective, motion and dimensional components; use CSS 3D transforms and lightweight native browser techniques, not fake claims about advanced 3D. A normal photo website should use large image-led sections, galleries and editorial layouts, not unnecessary 3D.
2. Use an original, confident colour palette suitable for this brand. Use CSS variables for all main colours. Do not default every website to black and gold. Make each website's palette and composition distinctive.
3. EVERY website must have a clear, visible navigation/menu button or menu bar. It must contain Home and About plus the sections appropriate to the actual business. Menu links must navigate to real section IDs/pages in the generated website. Mobile navigation must open and close and work by keyboard.
4. Create the correct industry-specific workflows. Fashion/e-commerce needs product categories, product cards, product details, add-to-cart, cart quantity/removal and order summary. Restaurant/food sites need a menu, food cards, item selection and an order summary. Hotels need room types, amenities and a reservation enquiry flow. Barber/salons need services, team/barbers, gallery, pricing and a booking enquiry. Construction businesses need services, projects, process and request-a-quote. For any other domain, infer the right sections and actions rather than using these examples blindly.
5. Make every visible button and interactive element work. No dead buttons, fake links, href="#" without a real target, or controls that do nothing. Use meaningful navigation, working filters/tabs/accordions/galleries/cart forms and validation as appropriate. Add accessible names, labels, keyboard support and visible focus states.
6. CONTACT / WHATSAPP: Include a contact section and a clear contact action. If the user specifically requests WhatsApp, create WhatsApp contact and order buttons. Use a single clearly named editable constant in script.js, for example WHATSAPP_NUMBER = "234XXXXXXXXXX" (digits only, international format without +). Never invent a real number. If the number is still the placeholder, show a clear on-page message telling the owner to replace it before launch; do not open a broken chat. If no contact preference or number was supplied, add a normal contact form/contact action and list WhatsApp number and preferred contact method in ownerSetupNeeded so NexaGPT can ask the owner before publishing. If WhatsApp is configured, every order button must open https://wa.me/NUMBER?text=ENCODED_MESSAGE with a prefilled message containing the exact selected item(s), quantities, options, and order/enquiry summary. The message must be URL-encoded with encodeURIComponent. Do not silently lose the order details.
7. For food, clothes and products, tapping a card or order button must let the visitor choose the item and quantity/options, review the order, then send the complete order description to the configured WhatsApp chat. Do not claim payment has been made. Do not create fake payment processing.
8. Contact forms, booking forms and quote forms must validate required fields and give a useful confirmation. If no real backend exists, clearly say the enquiry is prepared and provide a working mailto/WhatsApp route when configured; do not pretend it was submitted to a server.
9. Mobile-first responsive layout with desktop/tablet breakpoints. Ensure normal vertical page scrolling works on phones and desktop. NEVER lock the whole website to one screen: do not set body/html to height:100vh with overflow:hidden; do not trap touch scrolling. Use min-height rather than fixed page height. Any horizontal carousels must not disable vertical page scrolling.
10. HTML must link to style.css and script.js. Include semantic HTML, metadata, accessible labels, keyboard-friendly controls and visible focus states.
11. Use realistic sample content but clearly mark owner-editable placeholders. Do not invent real phone numbers, addresses, prices, reviews, testimonials, certifications or business claims. Do not claim real payment, booking, database, authentication or backend integrations.
12. Do not use external JavaScript libraries or remote scripts. Images may use descriptive, replaceable image URLs or CSS placeholders; never claim an image is a real client asset. If external image URLs are used, provide sensible alt text and fallback styling.
13. Keep all three files complete. No ellipses, TODOs, omitted sections or dead controls. Return valid JSON and escape newlines correctly.`;

  const raw = await callGemini(prompt, { json: true, maxOutputTokens: 20000 });
  const data = parseJson(raw, null);
  const html = clean(data?.indexHtml, 120000);
  const css = clean(data?.styleCss, 120000);
  const js = clean(data?.scriptJs, 120000);

  if (!html || !css || !js) {
    throw new Error("The website model did not return all three complete files. Try again; your selected concept has not been lost.");
  }

  const setup = Array.isArray(data.ownerSetupNeeded) ? data.ownerSetupNeeded.slice(0, 10) : [];
  return {
    reply: `I've created ${clean(data.projectName, 120) || "your website"} using the selected design. The preview supports normal page scrolling. Test the menu, product/order or booking actions, and contact buttons. Before publishing, provide any owner details listed below so WhatsApp/contact actions use the correct destination.`,
    artifact: {
      type: "website",
      title: clean(data.projectName, 120) || "Website",
      summary: clean(data.summary, 1200),
      files: { html, css, js },
      features: Array.isArray(data.features) ? data.features.slice(0, 24) : [],
      ownerSetupNeeded: setup,
      selectedConcept: selected.title
    }
  };
}
