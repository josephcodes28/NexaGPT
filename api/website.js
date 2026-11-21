/*
 * NexaGPT Universal Website Engine V7
 *
 * Universal business and website understanding:
 * - Does not restrict website creation to a fixed industry/category list.
 * - Infers the website's purpose, audience, pages, content and workflows
 *   directly from the user's brief and conversation.
 * - Supports business websites, stores, booking systems, portfolios,
 *   communities, directories, SaaS interfaces, educational platforms,
 *   editorial sites and unfamiliar/niche website concepts.
 *
 * Preserves:
 * - Gemini primary + bounded 503 retry + Groq fallback.
 * - Existing request fields and normalized + legacy response file contract.
 * - WhatsApp integration requirements.
 * - Guaranteed restaurant gallery.
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
    features: {
      type: 'ARRAY',
      items: { type: 'STRING' }
    }
  },
  required: [
    'projectName',
    'summary',
    'indexHtml',
    'styleCss',
    'scriptJs',
    'features'
  ]
};

function respond(res, status, data) {
  if (typeof res.status === 'function') {
    return res.status(status).json(data);
  }

  res.statusCode = status;
  res.setHeader?.(
    'Content-Type',
    'application/json; charset=utf-8'
  );
  return res.end(JSON.stringify(data));
}

function cleanText(value, maxLength = MAX_BRIEF) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function hashText(value) {
  let hash = 2166136261;

  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

/*
 * These are visual direction examples, not a list of supported industries.
 * The model must infer the actual design from the brief.
 */
function chooseDesignDirection(brief, projectName) {
  const seed = hashText(`${projectName}|${brief}`);
  const text = brief.toLowerCase();

  const directions = [
    'Editorial composition: expressive typography, generous whitespace, large visual storytelling and refined details.',
    'Modern minimal: clean geometry, precise spacing, restrained colour and strong typography.',
    'Bold contemporary: confident typography, strong contrast, distinctive composition and high-impact visuals.',
    'Warm human-centred: welcoming colours, approachable typography and authentic imagery.',
    'Premium architectural: structured grids, spacious layouts, elegant contrast and refined details.',
    'Conversion-focused: clear information hierarchy, purposeful sections and prominent calls to action.',
    'Creative asymmetric: expressive layouts, layered composition and distinctive visual rhythm.',
    'Classic professional: balanced proportions, trustworthy presentation and restrained visual details.'
  ];

  let direction = directions[seed % directions.length];

  if (/\bminimal\b|\bminimalist\b/.test(text)) {
    direction = directions[1];
  } else if (/\bluxury\b|\bpremium\b|\belegant\b/.test(text)) {
    direction = directions[4];
  } else if (/\bbold\b|\bvibrant\b|\bcolourful\b|\bcolorful\b/.test(text)) {
    direction = directions[2];
  } else if (/\bprofessional\b|\bcorporate\b/.test(text)) {
    direction = directions[7];
  }

  return direction;
}

/*
 * A small, mixed visual reference library is supplied as optional inspiration.
 * It is deliberately NOT mapped to a closed set of industries.
 * The AI must use only images that genuinely fit the brief.
 * Client-supplied image URLs and project assets take priority.
 */
function imageLibrary(brief, projectName) {
  const collections = [
    [
      'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1800&q=85',
      'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1400&q=85',
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=85',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=85'
    ],
    [
      'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1800&q=85',
      'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1400&q=85',
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1400&q=85',
      'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1400&q=85'
    ],
    [
      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1400&q=85',
      'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=1400&q=85',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=85',
      'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1400&q=85'
    ]
  ];

  const seed = hashText(`${projectName}|${brief}`);
  const selected = collections[seed % collections.length];

  return selected
    .map((url, index) => `${index + 1}. ${url}`)
    .join('\n');
}

function buildPrompt({ projectName, brief, revision, existingFiles }) {
  const photos = imageLibrary(brief, projectName);
  const designDirection = chooseDesignDirection(brief, projectName);
  const revisionMode = Boolean(revision && existingFiles);

  return `
You are NexaGPT's universal website understanding, product design and frontend engineering system.

Your job is to understand and build the website the user actually describes.

You are NOT restricted to a predefined list of industries, business categories, website types, page structures or features.

A user may request a website for:
- A familiar business or organization.
- A very specific niche or specialist service.
- A new business concept you have never seen before.
- A personal, creative, educational, commercial or community project.
- A web application, platform, directory, marketplace, portal, dashboard or SaaS product.
- A business with unusual workflows or a combination of several industries.

These are examples only. They are not a complete list and must never become a restriction.

==================================================
PROJECT
==================================================

Project name:
${projectName}

Complete user brief:
${brief}

==================================================
UNIVERSAL UNDERSTANDING PROCESS
==================================================

Before generating code, independently determine:

1. What exactly is the subject, business, organization, product or idea?
2. What does it do, sell, teach, publish, manage or provide?
3. Who will use the website?
4. What are the main visitor goals?
5. What should the website owner be able to manage?
6. What pages, sections and content are appropriate?
7. What actions should visitors be able to perform?
8. What information and assets did the user provide?
9. What information is missing?
10. Which features can genuinely work in the supplied frontend files, and which require a backend or external integration?

Do not depend on a fixed industry lookup table.

Infer the domain from the complete meaning of the user's request, not just individual keywords.

If the user describes an unfamiliar or niche business:
- Understand its services and audience from the description.
- Use the terminology that belongs to that business.
- Design the appropriate pages and visitor journey.
- Create relevant workflows based on the described operations.
- Do not force it into an unrelated familiar category.
- Do not refuse merely because the business type is unfamiliar.

If the brief combines multiple business types, support the combined requirements rather than arbitrarily choosing only one.

If essential information is missing, use sensible editable neutral content or omit the detail. Do not invent facts. Do not ask questions inside the generated website. The conversational assistant can ask the user for essential missing information before generation when necessary.

==================================================
BUSINESS OPERATING SYSTEM
==================================================

Do not build only a pretty landing page when the user has requested a working business website or platform.

Infer the actual operating features from the brief.

Possible patterns include, but are not limited to:

- Retail: products, variants, categories, quantities, cart and checkout.
- Food service: menus, food options, quantities, delivery or pickup and ordering.
- Accommodation: room types, guest details, dates and reservation enquiries.
- Property: listings, property details, search, filters and viewing enquiries.
- Personal care: service selection, staff where supplied and appointment requests.
- Education: programmes, courses, applications and student enquiries.
- Healthcare: services, departments and appointment enquiries, without unsupported medical claims.
- Professional services: service details, consultation requests and quotations.
- Events: event details, packages, availability enquiries and booking requests.
- Transport and logistics: routes or service details, shipment enquiries and quote requests.
- Membership organizations: membership information, plans and applications.
- Communities: member-facing information, events and participation flows.
- Publishing: articles, categories, search and readable editorial layouts.
- Directories: searchable entries, categories and detail pages.
- Marketplaces: seller or provider listings, product/service discovery and enquiry flows.
- SaaS or web applications: product interface, navigation, forms, settings and appropriate interactive states.
- Portfolios: project presentation, skills, case studies and contact.
- Any other domain: infer the correct operations from the user's description.

These examples are guidance, not mandatory features.

Only implement features that make sense for the requested website.

Never add a shopping cart to a church website just because it is a business website. Never add hotel reservations to a salon unless requested. Never turn every website into a generic company landing page.

For each requested workflow:
- Build the complete frontend interaction where feasible.
- Make controls usable on mobile and desktop.
- Validate user input.
- Show clear success, empty and error states.
- Do not make controls decorative or inert.
- Do not claim that a real-world action succeeded unless an actual service confirms it.

==================================================
DISTINCTIVE DESIGN SYSTEM
==================================================

Suggested creative direction for this project:
${designDirection}

This is inspiration, not a compulsory template.

Create a visual identity and layout that fit the actual project.

The design must be determined by:
- The user's explicit instructions.
- The nature of the project.
- The audience.
- The content and photography.
- The visitor's main task.
- The brand personality described in the brief.

Avoid producing the same design repeatedly.

Vary, when appropriate:
- Hero composition.
- Navigation layout.
- Page structure and section order.
- Typography.
- Colour palette.
- Grid and card systems.
- Image placement and cropping.
- Background treatment.
- Interaction patterns.
- Footer composition.

Do not introduce arbitrary variation that conflicts with the user's requested style.

The result should feel deliberately designed for this project, not like a renamed copy of another generated website.

Use strong visual hierarchy, readable typography, intentional spacing, consistent components and professional responsive layouts.

Do not use emoji as substitute icons. Use inline SVG or CSS icons where appropriate.

==================================================
PHOTOGRAPHY AND ASSETS
==================================================

Optional visual reference library:
${photos}

Use client-supplied images, logos, brand colours, text and asset URLs whenever provided. These take priority.

Use reference-library photographs only when they genuinely fit the project. They are optional references, not a requirement to place unrelated images on a page.

Never use food imagery on a baby salon website, fashion imagery on a logistics portal, or other unrelated photography merely to fill space.

If no suitable photograph is available:
- Use a restrained, intentional CSS visual treatment.
- Use a clearly editable image slot only when the user needs to supply an asset.
- Do not invent image URLs.
- Do not create a gallery of unrelated stock images.

Use descriptive alt text and responsive image sizing.

==================================================
CONTENT AND TRUST
==================================================

Do not invent:
- Business addresses.
- Phone numbers or WhatsApp numbers.
- Product or service prices.
- Stock levels or availability.
- Awards or certifications.
- Customer reviews or testimonials.
- Staff names or qualifications.
- Medical, legal or financial claims.
- Client counts, statistics or company history.

Use information provided by the user.

When content is missing, use neutral editable wording or omit it.

Avoid lorem ipsum, generic filler, repetitive sections and fake testimonials.

==================================================
WHATSAPP BUSINESS INTEGRATION
==================================================

Support WhatsApp click-to-chat for contact, product orders, food orders, bookings, appointments and quotation requests when appropriate to the project.

Use ONLY a WhatsApp number explicitly supplied in the client brief.

Normalize the number to digits only, including the country calling code, without a leading plus sign.

For an 11-digit Nigerian local mobile number beginning with 0, remove the first 0 and prefix 234.

For other countries, require the country calling code. Never guess it.

If the brief does not contain a business WhatsApp number, create one clearly marked configuration constant in scriptJs:

const BUSINESS_WHATSAPP = '';

Add a comment explaining that the owner must enter the full international number using digits only.

Do not use a fake number.

If the number is missing, explain when a WhatsApp action is clicked that the owner must configure the number.

Add the configured number to the document root as data-whatsapp-number="..." or a meta tag named business-whatsapp.

For product or menu order actions, use:
- data-whatsapp-order
- data-product-name
- data-product-price
- data-product-quantity

Use the actual displayed name and price. Never invent a price.

Include quantity and selected options where relevant.

For booking, appointment, reservation and quote forms, use:
<form data-whatsapp-form data-whatsapp-title="...">

Use proper name attributes. Validate required fields and include every non-empty field label and value in the prepared message.

The visitor must review the message and tap Send inside WhatsApp.

Clearly explain this near the relevant controls.

Do not claim that an order, booking, payment or message has been completed merely because WhatsApp opened.

Do not use window.top, parent or top-level app navigation.

==================================================
FORMS, DATA AND INTEGRATION HONESTY
==================================================

The generated deliverable consists of three frontend files. Do not pretend that frontend-only code automatically provides a production backend.

Do not claim to have implemented:
- Permanent shared online data storage.
- Real payment processing.
- Live inventory synchronization.
- Real user authentication.
- Confirmed bookings or reservations.
- Email or SMS delivery.
- Admin management connected to a database.

Only implement these as real integrations if the user explicitly supplies working backend endpoints, credentials or integration requirements that are available to the project.

Where a backend is not available:
- Implement the useful frontend experience.
- Use local browser storage only for temporary/local state where appropriate.
- Explain clearly what requires backend integration.
- Never show a fake payment success or fake confirmed booking.

==================================================
TECHNICAL CONTRACT
==================================================

Return a complete website in exactly three files:

1. index.html
2. style.css
3. script.js

HTML:
- Complete HTML5 document.
- Correct title and viewport.
- Semantic accessible elements.
- Link only to style.css and script.js for local assets.
- Every internal navigation link must point to an existing element ID.
- Use real in-page anchors such as href="#about".
- Do not use root-relative paths for internal sections.

CSS:
- Complete responsive styles.
- Mobile-first implementation.
- No horizontal overflow.
- Readable typography and colour contrast.
- Visible keyboard focus.
- Responsive images and layouts.
- Respect prefers-reduced-motion.

JavaScript:
- Complete browser-side functionality.
- No frameworks, build tools or remote JavaScript libraries.
- Working mobile navigation with aria-expanded.
- Close mobile navigation after a section link is tapped.
- Implement all requested frontend interactions.
- Validate forms.
- Provide clear feedback and error handling.
- No uncaught errors from ordinary user interactions.
- Do not navigate away from the NexaGPT application.

Do not use window.top, parent or top-level navigation.

==================================================
REVISION MODE
==================================================

${revisionMode ? `
This is a revision of an existing project.

Existing project files:
${JSON.stringify(existingFiles)}

Latest user revision:
${revision}

Preserve existing working features and project identity.
Change only what the user requests unless a related correction is necessary.
Do not unnecessarily redesign unrelated sections.
Preserve WhatsApp integration and preview compatibility.
Return all three complete updated files.
` : `
This is a new website project.
Create the complete website based on the user's brief.
`}

==================================================
FINAL SELF-CHECK
==================================================

Before returning the files, verify:

1. The website matches the actual project, even if its domain is unfamiliar.
2. The content and terminology fit the requested subject.
3. The page structure serves the visitor's goals.
4. The operating features are appropriate to the request.
5. The design is distinctive and follows explicit instructions.
6. Images and assets are relevant.
7. No unsupported business facts or prices were invented.
8. Internal navigation targets exist.
9. Mobile navigation works.
10. Every visible control has a meaningful action.
11. Forms validate input.
12. WhatsApp actions are honest and correctly configured.
13. The three files are complete and mutually consistent.
14. The HTML, CSS and JavaScript are syntactically coherent.
15. The mobile layout does not overflow horizontally.
16. No real backend capability is falsely claimed.

Fix issues before returning the result.

==================================================
STRICT OUTPUT FORMAT
==================================================

Return ONLY one valid JSON object containing exactly:

{
  "projectName": "string",
  "summary": "string",
  "indexHtml": "complete HTML document",
  "styleCss": "complete CSS",
  "scriptJs": "complete JavaScript",
  "features": ["feature 1", "feature 2"]
}

No Markdown fences.
No explanations outside the JSON.
Escape JSON strings correctly.
Do not omit any file.
Do not return partial files.
Do not return placeholder code.
`;
}

function isRetryable(status) {
  return (
    status === 408 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    timeoutMs
  );

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

async function callGemini(prompt, apiKey) {
  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: schema,
          temperature: 0.8
        }
      })
    },
    GEMINI_TIMEOUT_MS
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      data?.error?.message ||
      `Gemini returned HTTP ${response.status}.`
    );
    error.status = response.status;
    throw error;
  }

  const raw = (
    data?.candidates?.[0]?.content?.parts || []
  )
    .map(part => part.text || '')
    .join('')
    .trim();

  if (!raw) {
    throw new Error('Gemini returned an empty result.');
  }

  return JSON.parse(raw);
}

async function callGroq(prompt, apiKey) {
  const response = await fetchWithTimeout(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You are NexaGPT, a universal website understanding system and senior frontend engineering team. Understand any website type from the user brief, including unfamiliar and niche domains. Follow the complete prompt exactly. Return one valid JSON object only. Do not use Markdown fences.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: {
          type: 'json_object'
        },
        temperature: 0.7,
        max_tokens: 12000
      })
    },
    GROQ_TIMEOUT_MS
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      data?.error?.message ||
      `Groq returned HTTP ${response.status}.`
    );
    error.status = response.status;
    throw error;
  }

  const raw = data?.choices?.[0]?.message?.content?.trim();

  if (!raw) {
    throw new Error('Groq returned an empty result.');
  }

  return JSON.parse(raw);
}

/* Guaranteed restaurant gallery retained for compatibility. */

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
  return /\brestaurant\b|\bfood\b|\bcafe\b|\bcafé\b|\bbakery\b|\bbistro\b|\bgrill\b|\bpizzeria\b|\bpizza\b|\bdining\b|\beatery\b|\bfood\s*shop\b|\bcatering\b/i.test(brief);
}

function makeRestaurantGallery() {
  const cards = RESTAURANT_GALLERY_IMAGES.map(photo => `
    <figure class="nexagpt-food-gallery-card" data-order-card>
      <img
        src="${photo.url}"
        alt="${photo.alt}"
        loading="lazy"
        decoding="async"
        referrerpolicy="no-referrer"
      >
      <figcaption>${photo.caption}</figcaption>
      <button
        type="button"
        class="nexagpt-gallery-order"
        data-whatsapp-order
        data-product-name="${photo.alt}"
        data-product-price="Not listed"
        data-product-quantity="1"
      >Ask about this dish</button>
    </figure>
  `).join('');

  return `
    <div class="nexagpt-food-gallery-grid" aria-label="Food photo gallery">
      ${cards}
    </div>
  `;
}

function ensureRestaurantGallery(project, brief) {
  if (!isRestaurantBrief(brief)) return project;

  let html = String(project.indexHtml || '');
  let css = String(project.styleCss || '');

  const galleryMarkup = makeRestaurantGallery();
  const gallerySectionPattern =
    /<section\b[^>]*>[\s\S]*?<\/section>/gi;

  const sections = [...html.matchAll(gallerySectionPattern)];

  const gallerySection = sections.find(match => {
    const openingTag =
      (match[0].match(/^<section\b[^>]*>/i) || [''])[0];

    return (
      /\bid\s*=\s*(["'])[^"']*gallery[^"']*\1/i.test(openingTag) ||
      /\bclass\s*=\s*(["'])[^"']*gallery[^"']*\1/i.test(openingTag) ||
      /aria-label\s*=\s*(["'])[^"']*gallery[^"']*\1/i.test(openingTag)
    );
  });

  if (gallerySection) {
    const currentSection = gallerySection[0];

    if (!/nexagpt-food-gallery-grid/.test(currentSection)) {
      const updatedSection = currentSection.replace(
        /<\/section>\s*$/i,
        `${galleryMarkup}\n</section>`
      );
      html = html.replace(currentSection, updatedSection);
    }
  } else {
    html = html.replace(
      /(<(?!section\b)[a-z][a-z0-9:-]*\b[^>]*?)\s+id\s*=\s*(["'])gallery\2/i,
      '$1 data-nexagpt-original-gallery="true"'
    );

    const newSection = `
      <section
        id="gallery"
        class="nexagpt-food-gallery-section"
        aria-label="Food gallery"
      >
        <div class="nexagpt-food-gallery-heading">
          <p class="eyebrow">A taste of our kitchen</p>
          <h2>Fresh from our kitchen</h2>
          <p>Take a look at dishes made to be enjoyed.</p>
        </div>
        ${galleryMarkup}
      </section>
    `;

    if (/<\/main>/i.test(html)) {
      html = html.replace(/<\/main>/i, `${newSection}\n</main>`);
    } else if (/<\/body>/i.test(html)) {
      html = html.replace(/<\/body>/i, `${newSection}\n</body>`);
    } else {
      html += newSection;
    }
  }

  const galleryCss = `

/* NexaGPT guaranteed restaurant gallery and WhatsApp actions */
.nexagpt-food-gallery-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: clamp(12px, 2vw, 24px);
  width: 100%;
  margin: 28px auto 0;
}

.nexagpt-food-gallery-card {
  position: relative;
  overflow: hidden;
  margin: 0;
  min-width: 0;
  aspect-ratio: 4 / 3;
  border-radius: 16px;
  background: #eee;
  box-shadow: 0 8px 24px rgba(0,0,0,.10);
}

.nexagpt-food-gallery-card img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform .45s ease;
}

.nexagpt-food-gallery-card:hover img {
  transform: scale(1.045);
}

.nexagpt-food-gallery-card figcaption {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 28px 14px 54px;
  color: #fff;
  font-weight: 600;
  font-size: .92rem;
  background: linear-gradient(transparent, rgba(0,0,0,.75));
  pointer-events: none;
}

.nexagpt-gallery-order {
  position: absolute;
  z-index: 2;
  right: 10px;
  bottom: 10px;
  border: 0;
  border-radius: 999px;
  padding: 9px 13px;
  background: #171717;
  color: #fff;
  font: inherit;
  font-size: .8rem;
  font-weight: 700;
  cursor: pointer;
}

.nexagpt-gallery-order:focus-visible {
  outline: 3px solid #d6a84f;
  outline-offset: 3px;
}

.nexagpt-food-gallery-heading {
  text-align: center;
  max-width: 680px;
  margin: 0 auto 12px;
}

.nexagpt-food-gallery-section {
  padding: clamp(48px, 7vw, 88px) clamp(18px, 5vw, 64px);
}

@media (max-width: 760px) {
  .nexagpt-food-gallery-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .nexagpt-food-gallery-card {
    border-radius: 12px;
  }
}

@media (max-width: 420px) {
  .nexagpt-food-gallery-grid {
    grid-template-columns: 1fr;
  }

  .nexagpt-food-gallery-card {
    aspect-ratio: 16 / 10;
  }
}
`;

  if (!css.includes('NexaGPT guaranteed restaurant gallery')) {
    css += galleryCss;
  }

  return {
    ...project,
    indexHtml: html,
    styleCss: css
  };
}

function validateProject(project, projectName) {
  if (!project || typeof project !== 'object') {
    throw new Error(
      'The website model returned invalid project data.'
    );
  }

  const html = project.indexHtml;
  const css = project.styleCss;
  const js = project.scriptJs;

  for (const [name, value] of [
    ['index.html', html],
    ['style.css', css],
    ['script.js', js]
  ]) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(
        `The website model did not return a complete ${name} file.`
      );
    }

    if (value.length > MAX_FILE) {
      throw new Error(`Generated ${name} is too large.`);
    }
  }

  return {
    success: true,
    projectName: String(project.projectName || projectName),
    summary: String(project.summary || 'Website created.'),
    note: String(project.summary || 'Your website preview is ready.'),
    files: {
      html,
      css,
      js,
      indexHtml: html,
      styleCss: css,
      scriptJs: js
    },
    provider: 'Gemini',
    model: GEMINI_MODEL,
    features: Array.isArray(project.features)
      ? project.features
          .filter(item => typeof item === 'string')
          .slice(0, 30)
      : []
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');

    return respond(res, 405, {
      success: false,
      error: 'Only POST requests are supported.'
    });
  }

  const startedAt = Date.now();

  try {
    const geminiKey = process.env.GEMINI_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;

    if (!geminiKey && !groqKey) {
      return respond(res, 500, {
        success: false,
        error:
          'Website generation is not configured. Add GEMINI_API_KEY or GROQ_API_KEY in Vercel.'
      });
    }

    const body =
      req.body && typeof req.body === 'object'
        ? req.body
        : {};

    const brief = cleanText(
      body.description || body.brief || body.prompt || '',
      MAX_BRIEF
    );

    const projectName = cleanText(
      body.projectName || 'Website project',
      160
    );

    const revision = cleanText(
      body.revision || '',
      MAX_BRIEF
    );

    const existingFiles =
      body.existingFiles &&
      typeof body.existingFiles === 'object'
        ? body.existingFiles
        : null;

    if (!brief) {
      return respond(res, 400, {
        success: false,
        error:
          'Describe the website you want NexaGPT to create.'
      });
    }

    if (brief.length > MAX_BRIEF) {
      return respond(res, 400, {
        success: false,
        error:
          'The website brief is too long. Shorten it and try again.'
      });
    }

    const prompt = buildPrompt({
      projectName,
      brief,
      revision,
      existingFiles
    });

    let project = null;
    let provider = '';
    let geminiError = null;

    if (geminiKey) {
      try {
        project = await callGemini(prompt, geminiKey);
        provider = 'Gemini';
      } catch (error) {
        geminiError = error;

        console.error(
          '[NexaGPT Website Engine] Gemini failed:',
          error?.status || error?.name,
          error?.message
        );

        if (error?.status === 503) {
          await new Promise(resolve => setTimeout(resolve, 1200));

          try {
            project = await callGemini(prompt, geminiKey);
            provider = 'Gemini';
          } catch (retryError) {
            geminiError = retryError;

            console.error(
              '[NexaGPT Website Engine] Gemini retry failed:',
              retryError?.status || retryError?.name,
              retryError?.message
            );
          }
        }
      }
    }

    if (
      !project &&
      groqKey &&
      (
        !geminiKey ||
        isRetryable(geminiError?.status) ||
        !geminiError?.status ||
        geminiError?.name === 'AbortError'
      )
    ) {
      try {
        project = await callGroq(prompt, groqKey);
        provider = 'Groq (backup)';
      } catch (groqError) {
        console.error(
          '[NexaGPT Website Engine] Groq fallback failed:',
          groqError?.status || groqError?.name,
          groqError?.message
        );

        return respond(res, 502, {
          success: false,
          error:
            'Both website AI providers are temporarily unavailable or could not complete the request.',
          details: {
            gemini: geminiError?.status
              ? `HTTP ${geminiError.status}`
              : (geminiError ? geminiError.message : 'Not used'),
            groq: groqError?.status
              ? `HTTP ${groqError.status}`
              : groqError.message
          }
        });
      }
    }

    if (!project && geminiError) {
      const status = geminiError?.status || 502;

      const message =
        status === 503
          ? 'Gemini is overloaded and no working Groq backup is configured. Add GROQ_API_KEY to Vercel, then redeploy.'
          : status === 429
            ? 'Gemini has reached a usage limit and no working Groq backup is configured. Add GROQ_API_KEY to Vercel, then redeploy.'
            : 'The website AI could not complete the request. Check the Vercel function log for details.';

      return respond(res, status >= 500 ? 503 : status, {
        success: false,
        error: message
      });
    }

    if (!project) {
      return respond(res, 503, {
        success: false,
        error:
          'No website AI provider is currently available. Check your Vercel API keys.'
      });
    }

    project = ensureRestaurantGallery(project, brief);

    const result = validateProject(project, projectName);

    result.provider = provider;
    result.model =
      provider === 'Gemini' ? GEMINI_MODEL : GROQ_MODEL;
    result.generationTimeMs = Date.now() - startedAt;

    return respond(res, 200, result);
  } catch (error) {
    console.error(
      '[NexaGPT Website Engine] Unexpected error:',
      error
    );

    const timedOut = error?.name === 'AbortError';

    return respond(res, timedOut ? 504 : 502, {
      success: false,
      error: timedOut
        ? 'Website generation timed out. Please try again with a shorter brief.'
        : 'The website engine could not validate the generated project. Please try again.'
    });
  }
}
