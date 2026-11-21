/* NexaGPT Project Renderer V4
 * Isolated website previews with protected navigation and WhatsApp click-to-chat support.
 * Load before the main NexaGPT frontend script.
 */
(function (global) {
  "use strict";

  const STYLE_ID = "nexa-project-renderer-styles-v3";
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
      .nexa-artifact-media{display:block;width:100%;max-height:75vh;object-fit:contain;background:#09090b}
      .nexa-fullscreen-view{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;width:100%;height:100vh;height:100dvh;min-height:0;background:#fff;color:#171717;overscroll-behavior:contain;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}
      .nexa-fullscreen-bar{display:flex;align-items:center;gap:10px;flex:0 0 auto;min-height:54px;padding:8px 12px;background:#15151b;color:#fff;border-bottom:1px solid #333;box-shadow:0 2px 12px #0002}
      .nexa-fullscreen-name{min-width:0;flex:1;font-size:14px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .nexa-fullscreen-close{font-size:13px!important;padding:9px 13px!important;border-color:#555!important;background:#292930!important;color:#fff!important}
      .nexa-fullscreen-frame{display:block;flex:1 1 auto;width:100%;height:0;min-height:0;border:0;background:#fff;touch-action:pan-y;overscroll-behavior-y:contain;-webkit-overflow-scrolling:touch}
      body.nexa-fullscreen-open{overflow:hidden!important;overscroll-behavior:none!important}
      @media(max-width:600px){.nexa-fullscreen-bar{min-height:52px;padding-left:10px;padding-right:10px}.nexa-fullscreen-name{font-size:13px}.nexa-fullscreen-close{padding:9px 11px!important}}.nexa-artifact-note{font-size:12px;opacity:.7;padding:10px 13px;border-top:1px solid var(--border-color,#34343b)}
      .nexa-concepts{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px;margin:12px 0}.nexa-concept{padding:8px!important;text-align:left!important;overflow:hidden}.nexa-concept img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:7px;margin-bottom:8px;background:#25252b}.nexa-concept strong{display:block;font-size:13px}.nexa-concept span{display:block;font-size:11px;opacity:.72;margin-top:3px}.nexa-concept[aria-pressed=true]{border-color:var(--accent-color,#c99a3b)!important;box-shadow:0 0 0 1px var(--accent-color,#c99a3b)}
      .nexa-artifact-error{padding:16px;color:#b42318;font-size:13px}.nexa-artifact-empty{padding:18px;font-size:13px;opacity:.75}
      @media(max-width:600px){.nexa-artifact-head{align-items:flex-start;flex-wrap:wrap}.nexa-artifact-actions{margin-left:0;width:100%}.nexa-artifact-frame-wrap{height:68vh;min-height:300px}.nexa-artifact-toolbar{gap:6px}.nexa-artifact button{padding:8px 9px}}
    `;
    document.head.appendChild(style);
  }

  function safeText(value, fallback) { return typeof value === "string" && value.trim() ? value.trim() : fallback; }
  function makeButton(label, action, pressed) {
    const button = document.createElement("button"); button.type = "button"; button.textContent = label;
    if (pressed !== undefined) button.setAttribute("aria-pressed", String(pressed));
    button.addEventListener("click", action); return button;
  }
  function downloadText(filename, content, mime) {
    const blob = new Blob([content || ""], { type: mime || "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
    anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  const SCROLL_RUNTIME = String.raw`<style id="nexa-mobile-scroll-fix">
    html,body{height:auto!important;min-height:100%!important;max-height:none!important;overflow-x:hidden!important;overflow-y:auto!important;overscroll-behavior-y:auto!important;-webkit-overflow-scrolling:touch!important;touch-action:pan-y!important}
    body{position:static!important}*{-webkit-overflow-scrolling:touch}
  </style>`;

  // WhatsApp is the only external destination deliberately opened by the preview.
  // Other external links retain their normal browser behavior.
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
      const sections = Array.from(document.querySelectorAll('section,[id],main article'));
      return sections.find(node => variants.some(v => slug(node.id || '') === v || slug(node.getAttribute('aria-label') || '') === v)) || null;
    };
    const goTo = target => {
      if (!target) { window.scrollTo({top:0,behavior:'smooth'}); return; }
      const node = findSection(target);
      if (node) { node.scrollIntoView({behavior:'smooth',block:'start'}); history.replaceState(null,'','#'+target); }
    };
    const cleanNumber = value => String(value || '').replace(/[^0-9]/g, '');
    const validNumber = value => /^\d{8,15}$/.test(cleanNumber(value));
    const makeWhatsAppUrl = (number, message) => {
      const digits = cleanNumber(number);
      if (!validNumber(digits)) return '';
      return 'https://wa.me/' + digits + '?text=' + encodeURIComponent(message || 'Hello, I would like to make an enquiry.');
    };
    const getBusinessNumber = element => {
      const local = element && element.closest('[data-whatsapp-number],[data-business-whatsapp]');
      const meta = document.querySelector('meta[name="business-whatsapp"],meta[name="whatsapp-number"]');
      return (element && (element.getAttribute('data-whatsapp-number') || element.getAttribute('data-business-whatsapp'))) ||
        (local && (local.getAttribute('data-whatsapp-number') || local.getAttribute('data-business-whatsapp'))) ||
        (document.documentElement.getAttribute('data-whatsapp-number')) || (meta && meta.content) || '';
    };
    const openWhatsApp = (number, message) => {
      const url = makeWhatsAppUrl(number, message);
      if (!url) { window.alert('The business WhatsApp number has not been configured. Please contact the website owner.'); return false; }
      // This runs directly inside a user click/submit event, allowing the mobile browser to open WhatsApp.
      const popup = window.open(url, '_blank', 'noopener,noreferrer');
      if (!popup) window.location.href = url;
      return true;
    };
    const showStatus = (form, message) => {
      let status = form.querySelector('[data-preview-form-status]');
      if (!status) { status = document.createElement('p'); status.dataset.previewFormStatus='true'; status.setAttribute('role','status'); form.appendChild(status); }
      status.textContent = message;
    };
    const formMessage = form => {
      const heading = form.getAttribute('data-whatsapp-title') || 'Website enquiry';
      const lines = [heading];
      const data = new FormData(form);
      for (const [key, raw] of data.entries()) {
        if (raw instanceof File) continue;
        const value = String(raw || '').trim();
        if (!value) continue;
        const field = form.querySelector('[name="' + CSS.escape(key) + '"]');
        const label = field && (field.labels && field.labels[0] ? field.labels[0].textContent : field.getAttribute('aria-label'));
        lines.push((label || key.replace(/[_-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase())) + ': ' + value);
      }
      return lines.join('\n');
    };
    document.addEventListener('click', event => {
      const target = event.target && event.target.closest ? event.target.closest('a[href],button[data-whatsapp-order], [role="button"][data-whatsapp-order]') : null;
      if (!target) return;
      if (target.matches('[data-whatsapp-order]')) {
        event.preventDefault();
        const name = target.getAttribute('data-product-name') || target.getAttribute('data-item-name') || target.closest('[data-product-name]')?.getAttribute('data-product-name') || 'Selected item';
        const price = target.getAttribute('data-product-price') || target.closest('[data-product-price]')?.getAttribute('data-product-price') || 'Not listed';
        const quantityField = target.closest('[data-order-card]')?.querySelector('[name="quantity"],input[type="number"]');
        const quantity = target.getAttribute('data-product-quantity') || (quantityField && quantityField.value) || '1';
        const details = target.getAttribute('data-order-details') || '';
        const message = ['Hello, I would like to order:', 'Item: ' + name, 'Price: ' + price, 'Quantity: ' + quantity, details].filter(Boolean).join('\n');
        openWhatsApp(getBusinessNumber(target), message); return;
      }
      if (!target.matches('a[href]')) return;
      const raw = target.getAttribute('href') || '';
      if (/^(mailto:|tel:)/i.test(raw)) return;
      if (/^(javascript:|data:)/i.test(raw)) { event.preventDefault(); return; }
      let url; try { url = new URL(raw, document.baseURI); } catch (_) { event.preventDefault(); return; }
      const isWhatsApp = /(^|\.)wa\.me$/i.test(url.hostname) || /(^|\.)whatsapp\.com$/i.test(url.hostname) || /^whatsapp:$/i.test(url.protocol);
      if (isWhatsApp) {
        event.preventDefault();
        if (url.protocol === 'whatsapp:') { window.location.href = url.href; return; }
        const number = url.hostname.toLowerCase() === 'wa.me' ? url.pathname.replace(/^\//,'') : (url.searchParams.get('phone') || '');
        const message = url.searchParams.get('text') || 'Hello, I would like to make an enquiry.';
        openWhatsApp(number, message); return;
      }
      if (url.origin !== baseOrigin) return;
      event.preventDefault();
      if (url.hash) { goTo(decodeURIComponent(url.hash.slice(1))); return; }
      const path = url.pathname.replace(/\/$/,'').split('/').filter(Boolean).pop() || '';
      goTo(slug(path));
    }, true);
    document.addEventListener('submit', event => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      const action = form.getAttribute('action') || '';
      const whatsappForm = form.hasAttribute('data-whatsapp-form') || /wa\.me|whatsapp\.com/i.test(action);
      if (whatsappForm) {
        event.preventDefault();
        if (!form.reportValidity()) return;
        const number = form.getAttribute('data-whatsapp-number') || form.getAttribute('data-business-whatsapp') || getBusinessNumber(form) || (() => {
          try { const u = new URL(action, document.baseURI); return u.hostname === 'wa.me' ? u.pathname.replace(/^\//,'') : u.searchParams.get('phone'); } catch (_) { return ''; }
        })();
        const message = formMessage(form);
        if (openWhatsApp(number, message)) showStatus(form, 'WhatsApp opened with your details. Please review the message and tap Send in WhatsApp.');
        return;
      }
      let sameSite = !action;
      try { sameSite = sameSite || new URL(action, document.baseURI).origin === baseOrigin; } catch (_) { sameSite = true; }
      if (!sameSite) return;
      event.preventDefault(); showStatus(form, 'Preview only: connect a form backend to receive submissions.');
    }, true);
  })();
  </script>`;

  function composeDocument(files) {
    let html = safeText(files.html, '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body></body></html>');
    const css = typeof files.css === 'string' ? files.css : ''; const js = typeof files.js === 'string' ? files.js : '';
    const styleTag = css ? `<style>\n${css.replace(/<\/style/gi,'<\\/style')}\n</style>` : '';
    const scriptTag = js ? `<script>\n${js.replace(/<\/script/gi,'<\\/script')}\n</script>` : '';
    if (/<head[^>]*>/i.test(html)) html = html.replace(/<head([^>]*)>/i, `<head$1>${styleTag}${PREVIEW_GUARD}${SCROLL_RUNTIME}`);
    else html = `${styleTag}${PREVIEW_GUARD}${SCROLL_RUNTIME}${html}`;
    if (/<\/body\s*>/i.test(html)) html = html.replace(/<\/body\s*>/i, `${scriptTag}</body>`); else html += scriptTag;
    return html;
  }

  function mountProject(container, artifact) {
    if (!container || !artifact || typeof artifact !== 'object') return null;
    addStyles();
    const files = artifact.files && typeof artifact.files === 'object' ? artifact.files : null;
    if (!files || typeof files.html !== 'string') return mountMediaOrError(container, artifact);
    const card = document.createElement('section'); card.className = 'nexa-artifact'; card.setAttribute('aria-label','Interactive project preview');
    const head = document.createElement('div'); head.className = 'nexa-artifact-head'; const heading = document.createElement('div');
    const title = document.createElement('div'); title.className = 'nexa-artifact-title'; title.textContent = safeText(artifact.title,'Your NexaGPT project');
    const kind = document.createElement('div'); kind.className = 'nexa-artifact-kind'; kind.textContent = safeText(artifact.type,'web project'); heading.append(title,kind);
    const actions = document.createElement('div'); actions.className = 'nexa-artifact-actions';
    actions.appendChild(makeButton('Download project files', () => {
      downloadText('index.html',composeDocument({html:files.html,css:'',js:''}),MIME.html);
      if (typeof files.css === 'string') downloadText('style.css',files.css,MIME.css);
      if (typeof files.js === 'string') downloadText('script.js',files.js,MIME.js);
    })); head.append(heading,actions);
    const toolbar = document.createElement('div'); toolbar.className = 'nexa-artifact-toolbar';
    const previewButton = makeButton('Preview',()=>show('preview'),true), codeButton = makeButton('View code',()=>show('code'),false);
    const spacer = document.createElement('span'); spacer.className = 'nexa-spacer';
    const desktopButton = makeButton('Desktop',()=>setViewport('desktop'),true), mobileButton = makeButton('Mobile',()=>setViewport('mobile'),false);
    const refreshButton = makeButton('Reload',loadPreview), fullScreenButton = makeButton('Full screen',openFullScreen);
    fullScreenButton.setAttribute('aria-label','Open website in full-screen view'); toolbar.append(previewButton,codeButton,spacer,desktopButton,mobileButton,refreshButton,fullScreenButton);
    const previewWrap = document.createElement('div'); previewWrap.className = 'nexa-artifact-frame-wrap';
    const frame = document.createElement('iframe'); frame.className = 'nexa-artifact-frame'; frame.title = `${title.textContent} interactive preview`;
    frame.setAttribute('sandbox','allow-scripts allow-forms allow-modals allow-pointer-lock allow-downloads allow-popups allow-popups-to-escape-sandbox');
    frame.setAttribute('referrerpolicy','no-referrer'); frame.setAttribute('loading','lazy'); previewWrap.appendChild(frame);
    const code = document.createElement('div'); code.className = 'nexa-artifact-code';
    [['index.html',files.html],['style.css',files.css],['script.js',files.js]].forEach(([name,value])=>{
      if (typeof value !== 'string') return; const section=document.createElement('section'),h=document.createElement('h4'),pre=document.createElement('pre');
      h.textContent=name; pre.textContent=value; section.append(h,pre); code.appendChild(section);
    });
    const note=document.createElement('div'); note.className='nexa-artifact-note';
    note.textContent='Interactive isolated preview. WhatsApp buttons open a prefilled chat; the customer must tap Send in WhatsApp. Other forms need a connected backend.';
    card.append(head,toolbar,previewWrap,code,note); container.appendChild(card);
    function loadPreview(){ frame.srcdoc=composeDocument(files); }
    function openFullScreen(){
      const overlay=document.createElement('section'); overlay.className='nexa-fullscreen-view'; overlay.setAttribute('role','dialog'); overlay.setAttribute('aria-modal','true'); overlay.setAttribute('aria-label',`${title.textContent} full-screen website`);
      const bar=document.createElement('div'); bar.className='nexa-fullscreen-bar'; const name=document.createElement('div'); name.className='nexa-fullscreen-name'; name.textContent=title.textContent;
      const fullFrame=document.createElement('iframe'); fullFrame.className='nexa-fullscreen-frame'; fullFrame.title=`${title.textContent} full-screen website`;
      fullFrame.setAttribute('sandbox','allow-scripts allow-forms allow-modals allow-pointer-lock allow-downloads allow-popups allow-popups-to-escape-sandbox');
      fullFrame.setAttribute('referrerpolicy','no-referrer'); fullFrame.setAttribute('allow','fullscreen'); fullFrame.setAttribute('scrolling','yes');
      fullFrame.style.touchAction='pan-y'; fullFrame.style.overscrollBehaviorY='contain'; fullFrame.style.webkitOverflowScrolling='touch';
      const previousFocus=document.activeElement;
      function closeFullScreen(){ if(!overlay.isConnected)return; document.removeEventListener('keydown',onKey); overlay.remove(); if(!document.querySelector('.nexa-fullscreen-view'))document.body.classList.remove('nexa-fullscreen-open'); if(previousFocus&&typeof previousFocus.focus==='function')previousFocus.focus(); }
      const close=makeButton('Back to chat ✕',closeFullScreen); close.className='nexa-fullscreen-close'; bar.append(name,close); overlay.append(bar,fullFrame);
      document.body.appendChild(overlay); document.body.classList.add('nexa-fullscreen-open'); fullFrame.srcdoc=composeDocument(files); close.focus();
      function onKey(event){if(event.key==='Escape')closeFullScreen();} document.addEventListener('keydown',onKey);
    }
    function show(mode){const preview=mode==='preview';previewWrap.style.display=preview?'block':'none';code.style.display=preview?'none':'block';previewButton.setAttribute('aria-pressed',String(preview));codeButton.setAttribute('aria-pressed',String(!preview));}
    function setViewport(mode){const mobile=mode==='mobile';frame.classList.toggle('mobile',mobile);desktopButton.setAttribute('aria-pressed',String(!mobile));mobileButton.setAttribute('aria-pressed',String(mobile));}
    loadPreview(); return {element:card,frame,reload:loadPreview,files};
  }

  function mountMediaOrError(container,artifact){
    addStyles(); const type=String(artifact.type||'').toLowerCase(); const url=typeof artifact.url==='string'?artifact.url:(typeof artifact.src==='string'?artifact.src:'');
    const card=document.createElement('section');card.className='nexa-artifact';const title=document.createElement('div');title.className='nexa-artifact-head';title.textContent=safeText(artifact.title,'Created media');card.appendChild(title);
    if(url&&/^https:\/\//i.test(url)&&type.startsWith('image')){const img=document.createElement('img');img.className='nexa-artifact-media';img.src=url;img.alt=safeText(artifact.alt,title.textContent);img.loading='lazy';card.appendChild(img);}
    else if(url&&/^https:\/\//i.test(url)&&type.startsWith('video')){const video=document.createElement('video');video.className='nexa-artifact-media';video.src=url;video.controls=true;video.playsInline=true;card.appendChild(video);}
    else{const message=document.createElement('div');message.className='nexa-artifact-empty';message.textContent='This result does not contain a supported preview file.';card.appendChild(message);}
    container.appendChild(card);return {element:card};
  }
  function mountConcepts(container,concepts,metadata){
    if(!container||!Array.isArray(concepts))return null;addStyles();const wrap=document.createElement('div');wrap.className='nexa-concepts';let selectedId=null;
    concepts.forEach((concept,index)=>{const button=document.createElement('button');button.type='button';button.className='nexa-concept';const id=safeText(concept.id,`concept-${index+1}`);
      if(concept.imageUrl&&/^https:\/\//i.test(concept.imageUrl)){const img=document.createElement('img');img.src=concept.imageUrl;img.alt=safeText(concept.title,'Design concept');button.appendChild(img);}
      const strong=document.createElement('strong');strong.textContent=safeText(concept.title,`Concept ${index+1}`);const span=document.createElement('span');span.textContent=safeText(concept.description,'');button.append(strong,span);
      button.addEventListener('click',()=>{selectedId=id;Array.from(wrap.children).forEach(child=>child.setAttribute('aria-pressed',String(child===button)));const detail={conceptId:id,concept,metadata:metadata||{}};container.dispatchEvent(new CustomEvent('nexa:concept-selected',{bubbles:true,detail}));document.dispatchEvent(new CustomEvent('nexa:concept-selected',{detail}));});wrap.appendChild(button);
    });container.appendChild(wrap);return {element:wrap,getSelectedId:()=>selectedId};
  }
  global.NexaProjectRenderer=Object.freeze({mount:mountProject,mountConcepts,version:'4.0.0'});
})(window);
