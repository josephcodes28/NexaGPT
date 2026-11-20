/* NexaGPT Project Renderer V2
 * Isolated website previews with protected in-frame navigation.
 * Load before the main NexaGPT frontend script.
 */
(function (global) {
  "use strict";

  const STYLE_ID = "nexa-project-renderer-styles-v2";
  const MIME = { html: "text/html;charset=utf-8", css: "text/css;charset=utf-8", js: "text/javascript;charset=utf-8" };

  function addStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .nexa-artifact{width:100%;min-width:0;margin:14px 0;border:1px solid var(--border-color,#34343b);border-radius:18px;overflow:hidden;background:var(--panel-bg,#17171c);color:var(--text-color,inherit);font:inherit}
      .nexa-artifact *{box-sizing:border-box}.nexa-artifact-head{display:flex;align-items:center;gap:10px;padding:13px 14px;border-bottom:1px solid var(--border-color,#34343b)}
      .nexa-artifact-title{font-weight:700;min-width:0;overflow-wrap:anywhere}.nexa-artifact-kind{font-size:11px;opacity:.7;text-transform:uppercase;letter-spacing:.08em;margin-top:2px}
      .nexa-artifact-actions{display:flex;gap:7px;flex-wrap:wrap;margin-left:auto}.nexa-artifact button{font:inherit;cursor:pointer;border:1px solid var(--border-color,#45454e);background:var(--button-bg,#24242b);color:inherit;border-radius:10px;padding:8px 11px;font-size:12px}
      .nexa-artifact button:focus-visible{outline:2px solid var(--accent-color,#c99a3b);outline-offset:2px}.nexa-artifact button[aria-pressed=true]{border-color:var(--accent-color,#c99a3b)}
      .nexa-artifact-toolbar{display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:10px 12px;border-bottom:1px solid var(--border-color,#34343b)}.nexa-artifact-toolbar .nexa-spacer{flex:1}
      .nexa-artifact-frame-wrap{background:#fff;position:relative;width:100%;height:min(72vh,720px);min-height:340px}.nexa-artifact-frame{display:block;width:100%;height:100%;border:0;background:#fff}.nexa-artifact-frame.mobile{width:min(390px,100%);margin:0 auto;border-left:1px solid #ddd;border-right:1px solid #ddd}
      .nexa-artifact-code{display:none;max-height:520px;overflow:auto;padding:12px;background:#101015;color:#e9e9ef}.nexa-artifact-code pre{white-space:pre;overflow:auto;margin:0 0 14px;font:12px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace}.nexa-artifact-code h4{font-size:12px;margin:0 0 6px;color:#d9b66e}
      .nexa-artifact-media{display:block;width:100%;max-height:75vh;object-fit:contain;background:#09090b}.nexa-artifact-note{font-size:12px;opacity:.7;padding:10px 13px;border-top:1px solid var(--border-color,#34343b)}
      .nexa-concepts{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px;margin:12px 0}.nexa-concept{padding:8px!important;text-align:left!important;overflow:hidden}.nexa-concept img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:7px;margin-bottom:8px;background:#25252b}.nexa-concept strong{display:block;font-size:13px}.nexa-concept span{display:block;font-size:11px;opacity:.72;margin-top:3px}.nexa-concept[aria-pressed=true]{border-color:var(--accent-color,#c99a3b)!important;box-shadow:0 0 0 1px var(--accent-color,#c99a3b)}
      .nexa-artifact-error{padding:16px;color:#b42318;font-size:13px}.nexa-artifact-empty{padding:18px;font-size:13px;opacity:.75}
      @media(max-width:600px){.nexa-artifact-head{align-items:flex-start;flex-wrap:wrap}.nexa-artifact-actions{margin-left:0;width:100%}.nexa-artifact-frame-wrap{height:68vh;min-height:300px}.nexa-artifact-toolbar{gap:6px}.nexa-artifact button{padding:8px 9px}}
    `;
    document.head.appendChild(style);
  }

  function safeText(value, fallback) {
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
  }

  function makeButton(label, action, pressed) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    if (pressed !== undefined) button.setAttribute("aria-pressed", String(pressed));
    button.addEventListener("click", action);
    return button;
  }

  function downloadText(filename, content, mime) {
    const blob = new Blob([content || ""], { type: mime || "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = filename;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  // This runtime is injected before generated JavaScript. It keeps common
  // same-site paths such as /about and /gallery inside the preview instead of
  // letting them reload the NexaGPT application at the host's root URL.
  const PREVIEW_GUARD = String.raw`<script>
  (() => {
    'use strict';
    const baseOrigin = (() => { try { return new URL(document.baseURI).origin; } catch (_) { return location.origin; } })();
    const slug = value => String(value || '').toLowerCase().replace(/^#/, '').replace(/\.[a-z0-9]+$/i, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const findSection = key => {
      if (!key) return null;
      const variants = [key, key.replace(/-us$/, ''), key.replace(/-section$/, '')];
      for (const candidate of variants) {
        const direct = document.getElementById(candidate) || document.querySelector('[name="' + CSS.escape(candidate) + '"]');
        if (direct) return direct;
      }
      const sections = Array.from(document.querySelectorAll('section, [id], main article'));
      return sections.find(node => variants.some(v => slug(node.id || '') === v || slug(node.getAttribute('aria-label') || '') === v)) || null;
    };
    const goTo = target => {
      if (!target) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      const node = findSection(target);
      if (node) { node.scrollIntoView({ behavior: 'smooth', block: 'start' }); history.replaceState(null, '', '#' + target); }
    };
    document.addEventListener('click', event => {
      const anchor = event.target && event.target.closest ? event.target.closest('a[href]') : null;
      if (!anchor) return;
      const raw = anchor.getAttribute('href') || '';
      if (!raw || raw === '#') { event.preventDefault(); goTo(''); return; }
      if (/^(mailto:|tel:)/i.test(raw)) return;
      if (/^(javascript:|data:)/i.test(raw)) { event.preventDefault(); return; }
      let url;
      try { url = new URL(raw, document.baseURI); } catch (_) { event.preventDefault(); return; }
      if (url.origin !== baseOrigin) return;
      event.preventDefault();
      if (url.hash) { goTo(decodeURIComponent(url.hash.slice(1))); return; }
      const path = url.pathname.replace(/\/$/, '').split('/').filter(Boolean).pop() || '';
      goTo(slug(path));
    }, true);
    document.addEventListener('submit', event => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      const action = form.getAttribute('action') || '';
      let sameSite = !action;
      try { sameSite = sameSite || new URL(action, document.baseURI).origin === baseOrigin; } catch (_) { sameSite = true; }
      if (!sameSite) return;
      event.preventDefault();
      let status = form.querySelector('[data-preview-form-status]');
      if (!status) { status = document.createElement('p'); status.dataset.previewFormStatus = 'true'; status.setAttribute('role', 'status'); form.appendChild(status); }
      status.textContent = 'Preview only: connect a form backend to receive submissions.';
    }, true);
  })();
  </script>`;

  function composeDocument(files) {
    let html = safeText(files.html, '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body></body></html>');
    const css = typeof files.css === 'string' ? files.css : '';
    const js = typeof files.js === 'string' ? files.js : '';
    const styleTag = css ? `<style>\n${css.replace(/<\/style/gi, '<\\/style')}\n</style>` : '';
    const scriptTag = js ? `<script>\n${js.replace(/<\/script/gi, '<\\/script')}\n</script>` : '';
    if (/<head[^>]*>/i.test(html)) html = html.replace(/<head([^>]*)>/i, `<head$1>${styleTag}${PREVIEW_GUARD}`);
    else html = `${styleTag}${PREVIEW_GUARD}${html}`;
    if (/<\/body\s*>/i.test(html)) html = html.replace(/<\/body\s*>/i, `${scriptTag}</body>`);
    else html += scriptTag;
    return html;
  }

  function mountProject(container, artifact) {
    if (!container || !artifact || typeof artifact !== 'object') return null;
    addStyles();
    const files = artifact.files && typeof artifact.files === 'object' ? artifact.files : null;
    if (!files || typeof files.html !== 'string') return mountMediaOrError(container, artifact);

    const card = document.createElement('section'); card.className = 'nexa-artifact'; card.setAttribute('aria-label', 'Interactive project preview');
    const head = document.createElement('div'); head.className = 'nexa-artifact-head';
    const heading = document.createElement('div');
    const title = document.createElement('div'); title.className = 'nexa-artifact-title'; title.textContent = safeText(artifact.title, 'Your NexaGPT project');
    const kind = document.createElement('div'); kind.className = 'nexa-artifact-kind'; kind.textContent = safeText(artifact.type, 'web project');
    heading.append(title, kind);
    const actions = document.createElement('div'); actions.className = 'nexa-artifact-actions';
    actions.appendChild(makeButton('Download project files', () => {
      downloadText('index.html', composeDocument({ html: files.html, css: '', js: '' }), MIME.html);
      if (typeof files.css === 'string') downloadText('style.css', files.css, MIME.css);
      if (typeof files.js === 'string') downloadText('script.js', files.js, MIME.js);
    }));
    head.append(heading, actions);

    const toolbar = document.createElement('div'); toolbar.className = 'nexa-artifact-toolbar';
    const previewButton = makeButton('Preview', () => show('preview'), true);
    const codeButton = makeButton('View code', () => show('code'), false);
    const spacer = document.createElement('span'); spacer.className = 'nexa-spacer';
    const desktopButton = makeButton('Desktop', () => setViewport('desktop'), true);
    const mobileButton = makeButton('Mobile', () => setViewport('mobile'), false);
    const refreshButton = makeButton('Reload', loadPreview);
    toolbar.append(previewButton, codeButton, spacer, desktopButton, mobileButton, refreshButton);

    const previewWrap = document.createElement('div'); previewWrap.className = 'nexa-artifact-frame-wrap';
    const frame = document.createElement('iframe'); frame.className = 'nexa-artifact-frame';
    frame.title = `${title.textContent} interactive preview`;
    frame.setAttribute('sandbox', 'allow-scripts allow-forms allow-modals allow-pointer-lock allow-downloads');
    frame.setAttribute('referrerpolicy', 'no-referrer'); frame.setAttribute('loading', 'lazy');
    previewWrap.appendChild(frame);

    const code = document.createElement('div'); code.className = 'nexa-artifact-code';
    [['index.html', files.html], ['style.css', files.css], ['script.js', files.js]].forEach(([name, value]) => {
      if (typeof value !== 'string') return;
      const section = document.createElement('section'); const h = document.createElement('h4'); h.textContent = name;
      const pre = document.createElement('pre'); pre.textContent = value; section.append(h, pre); code.appendChild(section);
    });
    const note = document.createElement('div'); note.className = 'nexa-artifact-note';
    note.textContent = 'Interactive isolated preview. Internal links stay inside this website. Forms need a connected backend to receive real submissions.';
    card.append(head, toolbar, previewWrap, code, note); container.appendChild(card);

    function loadPreview() { frame.srcdoc = composeDocument(files); }
    function show(mode) {
      const preview = mode === 'preview'; previewWrap.style.display = preview ? 'block' : 'none'; code.style.display = preview ? 'none' : 'block';
      previewButton.setAttribute('aria-pressed', String(preview)); codeButton.setAttribute('aria-pressed', String(!preview));
    }
    function setViewport(mode) {
      const mobile = mode === 'mobile'; frame.classList.toggle('mobile', mobile);
      desktopButton.setAttribute('aria-pressed', String(!mobile)); mobileButton.setAttribute('aria-pressed', String(mobile));
    }
    loadPreview();
    return { element: card, frame, reload: loadPreview, files };
  }

  function mountMediaOrError(container, artifact) {
    addStyles();
    const type = String(artifact.type || '').toLowerCase();
    const url = typeof artifact.url === 'string' ? artifact.url : (typeof artifact.src === 'string' ? artifact.src : '');
    const card = document.createElement('section'); card.className = 'nexa-artifact';
    const title = document.createElement('div'); title.className = 'nexa-artifact-head'; title.textContent = safeText(artifact.title, 'Created media'); card.appendChild(title);
    if (url && /^https:\/\//i.test(url) && type.startsWith('image')) {
      const img = document.createElement('img'); img.className = 'nexa-artifact-media'; img.src = url; img.alt = safeText(artifact.alt, title.textContent); img.loading = 'lazy'; card.appendChild(img);
    } else if (url && /^https:\/\//i.test(url) && type.startsWith('video')) {
      const video = document.createElement('video'); video.className = 'nexa-artifact-media'; video.src = url; video.controls = true; video.playsInline = true; card.appendChild(video);
    } else {
      const message = document.createElement('div'); message.className = 'nexa-artifact-empty'; message.textContent = 'This result does not contain a supported preview file.'; card.appendChild(message);
    }
    container.appendChild(card); return { element: card };
  }

  function mountConcepts(container, concepts, metadata) {
    if (!container || !Array.isArray(concepts)) return null;
    addStyles(); const wrap = document.createElement('div'); wrap.className = 'nexa-concepts'; let selectedId = null;
    concepts.forEach((concept, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'nexa-concept';
      const id = safeText(concept.id, `concept-${index + 1}`);
      if (concept.imageUrl && /^https:\/\//i.test(concept.imageUrl)) { const img = document.createElement('img'); img.src = concept.imageUrl; img.alt = safeText(concept.title, 'Design concept'); button.appendChild(img); }
      const strong = document.createElement('strong'); strong.textContent = safeText(concept.title, `Concept ${index + 1}`);
      const span = document.createElement('span'); span.textContent = safeText(concept.description, ''); button.append(strong, span);
      button.addEventListener('click', () => {
        selectedId = id; Array.from(wrap.children).forEach(child => child.setAttribute('aria-pressed', String(child === button)));
        const detail = { conceptId: id, concept, metadata: metadata || {} };
        container.dispatchEvent(new CustomEvent('nexa:concept-selected', { bubbles: true, detail }));
        document.dispatchEvent(new CustomEvent('nexa:concept-selected', { detail }));
      });
      wrap.appendChild(button);
    });
    container.appendChild(wrap); return { element: wrap, getSelectedId: () => selectedId };
  }

  global.NexaProjectRenderer = Object.freeze({ mount: mountProject, mountConcepts, version: '2.0.0' });
})(window);
