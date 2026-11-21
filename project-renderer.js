(() => {
  "use strict";

  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));

  function makePreviewDocument(html, css, js) {
    const source = html || "<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'></head><body></body></html>";
    const parsed = new DOMParser().parseFromString(source, "text/html");

    if (!parsed.head) {
      const head = parsed.createElement("head");
      parsed.documentElement.insertBefore(head, parsed.body || null);
    }
    if (!parsed.body) parsed.documentElement.appendChild(parsed.createElement("body"));

    const style = parsed.createElement("style");
    style.textContent = css || "";
    parsed.head.appendChild(style);

    const script = parsed.createElement("script");
    script.textContent = js || "";
    parsed.body.appendChild(script);

    return "<!doctype html>\n" + parsed.documentElement.outerHTML;
  }

  function mountConcepts(container, concepts, metadata = {}) {
    const grid = document.createElement("div");
    grid.className = "concept-grid";

    (concepts || []).slice(0, 5).forEach((concept, index) => {
      const card = document.createElement("article");
      card.className = "concept-card";
      const preview = concept.previewHtml
        ? `<iframe class="concept-preview" title="${esc(concept.title)} visual sample" sandbox=""></iframe>`
        : `<div class="concept-preview-fallback"><span>${esc(concept.title)}</span><small>${esc((concept.structure || []).slice(0, 3).join(" · "))}</small></div>`;

      card.innerHTML = `
        <span class="concept-number">CONCEPT ${index + 1}</span>
        ${preview}
        <strong>${esc(concept.title)}</strong>
        <p>${esc(concept.description)}</p>
        <button class="primary-btn" type="button">Choose this design</button>`;

      if (concept.previewHtml) {
        const frame = card.querySelector("iframe");
        frame.srcdoc = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;min-height:100%;font-family:Arial,sans-serif}*{box-sizing:border-box}</style></head><body>${concept.previewHtml}</body></html>`;
      }

      card.querySelector("button").addEventListener("click", () => {
        container.dispatchEvent(new CustomEvent("nexa:concept-selected", {
          bubbles: true,
          detail: { concept, metadata }
        }));
      });
      grid.appendChild(card);
    });

    container.appendChild(grid);
  }

  function downloadFile(name, content) {
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function mount(container, artifact) {
    const wrap = document.createElement("section");
    wrap.className = "artifact";

    const files = artifact.files || {};
    const html = files.html || artifact.indexHtml || "";
    const css = files.css || artifact.styleCss || "";
    const js = files.js || artifact.scriptJs || "";
    const doc = makePreviewDocument(html, css, js);

    wrap.innerHTML = `
      <h3>${esc(artifact.title || "Project preview")}</h3>
      <p>${esc(artifact.summary || "Preview your project below.")}</p>
      <div class="preview-actions">
        <button class="secondary-btn" type="button" data-full>Full screen</button>
        <button class="secondary-btn" type="button" data-download>Download files</button>
      </div>
      <iframe title="Generated project preview" class="project-preview" sandbox="allow-scripts allow-forms allow-modals"></iframe>`;

    const frame = wrap.querySelector("iframe");
    frame.srcdoc = doc;
    container.appendChild(wrap);

    const fullButton = wrap.querySelector("[data-full]");
    fullButton.addEventListener("click", async () => {
      try {
        if (document.fullscreenElement === wrap) {
          await document.exitFullscreen();
          return;
        }
        if (wrap.requestFullscreen) {
          await wrap.requestFullscreen();
        } else {
          wrap.classList.toggle("preview-expanded");
        }
      } catch {
        wrap.classList.toggle("preview-expanded");
      }
    });

    wrap.querySelector("[data-download]").addEventListener("click", () => {
      downloadFile("index.html", html);
      setTimeout(() => downloadFile("style.css", css), 180);
      setTimeout(() => downloadFile("script.js", js), 360);
    });
  }

  window.NexaProjectRenderer = { mount, mountConcepts };
})();