
"use strict";

/*
 * JOSEPH AI V2 — WEBSITE STUDIO
 *
 * Improvements:
 * - Full-screen website viewer
 * - Desktop and mobile preview modes
 * - Preview navigation protection
 * - Broken-image fallback
 * - Generated CSS and JS injection
 * - Existing download functionality retained
 */

(() => {
  const API_URL = "/api/website";
  const REQUEST_TIMEOUT = 65000;

  const state = {
    files: null,
    generating: false,
    previewMode: "desktop",
    fullscreenFallback: false
  };

  const $ = selector => document.querySelector(selector);

  const form = $("#websiteBuilderForm");
  const status = $("#websiteBuilderStatus");
  const generateButton = $("#generateWebsiteButton");
  const previewContainer = $("#websitePreviewContainer");
  const filesContainer = $("#websiteGeneratedFiles");

  const desktopButton = $("#websiteDesktopPreviewButton");
  const mobileButton = $("#websiteMobilePreviewButton");
  const downloadButton = $("#downloadWebsiteButton");
  const saveButton = $("#saveWebsiteProjectButton");

  if (
    !form ||
    !status ||
    !generateButton ||
    !previewContainer ||
    !filesContainer
  ) {
    console.error("Website Studio: Required elements are missing.");
    return;
  }

  let previewShell = null;
  let previewFrame = null;
  let fullscreenButton = null;

  function setStatus(message, type = "info") {
    status.textContent = message;
    status.dataset.status = type;
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
  }

  function field(name) {
    const element = form.elements.namedItem(name);

    return element && typeof element.value === "string"
      ? element.value.trim()
      : "";
  }

  function collectBrief() {
    return {
      projectName: field("projectName"),
      businessType: field("businessType"),
      description: field("description"),
      audience: field("audience"),
      features: field("features"),
      visualStyle: field("visualStyle"),
      colors: field("colors"),
      reference: field("reference"),
      buildScope: field("buildScope"),
      backendFeatures: field("backendFeatures"),
      businessContact: field("businessContact")
    };
  }

  function setGenerating(value) {
    state.generating = value;
    generateButton.disabled = value;

    generateButton.textContent = value
      ? "Generating your website..."
      : "Generate professional website";
  }

  function validateFiles(files) {
    if (!files || typeof files !== "object") {
      throw new Error("The server returned invalid website files.");
    }

    for (const name of ["html", "css", "js"]) {
      if (
        typeof files[name] !== "string" ||
        !files[name].trim()
      ) {
        throw new Error(
          `The generated ${name} file is missing.`
        );
      }
    }

    return files;
  }

  async function requestWebsite(brief) {
    const controller = new AbortController();

    const timeoutId = setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT
    );

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          action: "generate",
          brief
        }),
        signal: controller.signal
      });

      let result;

      try {
        result = await response.json();
      } catch {
        throw new Error(
          "The server returned an unreadable response."
        );
      }

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Website generation failed."
        );
      }

      return {
        files: validateFiles(result.files),
        provider: result.provider || "AI",
        model: result.model || "",
        note: result.note || ""
      };

    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error(
          "Website generation took too long. Please try again."
        );
      }

      if (error instanceof TypeError) {
        throw new Error(
          "Could not connect to Joseph AI. Check your internet connection."
        );
      }

      throw error;

    } finally {
      clearTimeout(timeoutId);
    }
  }

  /*
   * This script runs INSIDE the isolated preview.
   *
   * It prevents ordinary internal links from loading
   * the Joseph AI application inside the iframe.
   *
   * Hash links remain functional.
   * External links, WhatsApp, phone and email links remain usable.
   */

  function buildPreviewGuardScript() {
    return `
(function () {
  "use strict";

  function isExternalDestination(url) {
    return (
      url.protocol === "http:" ||
      url.protocol === "https:" ||
      url.protocol === "mailto:" ||
      url.protocol === "tel:" ||
      url.protocol === "sms:"
    );
  }

  document.addEventListener("click", function (event) {
    var link = event.target.closest
      ? event.target.closest("a")
      : null;

    if (!link) return;

    var rawHref = link.getAttribute("href");

    if (!rawHref) return;

    var href = rawHref.trim();

    if (
      href.startsWith("#") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:") ||
      href.startsWith("sms:") ||
      href.startsWith("javascript:")
    ) {
      return;
    }

    var destination;

    try {
      destination = new URL(href, document.baseURI);
    } catch (_) {
      event.preventDefault();
      return;
    }

    if (isExternalDestination(destination)) {
      return;
    }

    // Prevent internal paths from loading Joseph AI in the preview.
    event.preventDefault();
    event.stopImmediatePropagation();

    console.warn(
      "Joseph AI Preview blocked an internal page navigation:",
      href
    );
  }, true);

  // Prevent forms from accidentally submitting to Joseph AI routes.
  document.addEventListener("submit", function (event) {
    var form = event.target;

    if (!(form instanceof HTMLFormElement)) return;

    var action = form.getAttribute("action");

    if (!action || action === "#" || action.startsWith("#")) {
      event.preventDefault();
      return;
    }

    try {
      var destination = new URL(action, document.baseURI);

      if (
        destination.protocol !== "http:" &&
        destination.protocol !== "https:" &&
        destination.protocol !== "mailto:"
      ) {
        event.preventDefault();
      }
    } catch (_) {
      event.preventDefault();
    }
  }, true);

  // Replace broken images with attractive visual placeholders.
  document.addEventListener("error", function (event) {
    var image = event.target;

    if (!(image instanceof HTMLImageElement)) return;

    image.style.opacity = "0";
    image.style.pointerEvents = "none";

    var wrapper = image.parentElement;

    if (wrapper) {
      wrapper.style.background =
        "linear-gradient(135deg, #292929, #51402b)";
      wrapper.style.minHeight =
        wrapper.style.minHeight || "140px";
      wrapper.style.position =
        wrapper.style.position || "relative";

      if (!wrapper.querySelector(".joseph-image-fallback")) {
        var fallback = document.createElement("div");

        fallback.className = "joseph-image-fallback";
        fallback.textContent =
          image.alt || "Image unavailable";

        fallback.style.cssText =
          "position:absolute;inset:0;display:flex;" +
          "align-items:center;justify-content:center;" +
          "padding:16px;text-align:center;" +
          "color:#f1dfbd;font-size:13px;" +
          "background:linear-gradient(135deg,#292929,#51402b);";

        wrapper.appendChild(fallback);
      }
    }
  }, true);

})();
`;
  }

  /*
   * Build the complete preview document.
   *
   * The generated CSS and JS are injected directly.
   * Local style.css and script.js references are removed.
   */

  function buildPreviewDocument(files) {
    let html = files.html;

    html = html.replace(
      /<base\b[^>]*>/gi,
      ""
    );

    html = html.replace(
      /<link\b(?=[^>]*\bhref\s*=\s*["'](?:\.\/)?style\.css(?:[?#][^"']*)?["'])[^>]*>/gi,
      ""
    );

    html = html.replace(
      /<script\b(?=[^>]*\bsrc\s*=\s*["'](?:\.\/)?script\.js(?:[?#][^"']*)?["'])[^>]*>\s*<\/script\s*>/gi,
      ""
    );

    const css = files.css.replace(
      /<\/style/gi,
      "<\\/style"
    );

    const guardScript = buildPreviewGuardScript()
      .replace(/<\/script/gi, "<\\/script");

    const generatedJS = files.js.replace(
      /<\/script/gi,
      "<\\/script"
    );

    const styleTag = `<style>${css}</style>`;

    const scripts =
      `<script>${guardScript}<\/script>` +
      `<script>${generatedJS}<\/script>`;

    if (/<\/head\s*>/i.test(html)) {
      html = html.replace(
        /<\/head\s*>/i,
        `${styleTag}</head>`
      );
    } else {
      html = `${styleTag}${html}`;
    }

    if (/<\/body\s*>/i.test(html)) {
      html = html.replace(
        /<\/body\s*>/i,
        `${scripts}</body>`
      );
    } else {
      html += scripts;
    }

    return html;
  }

  /*
   * PREVIEW VIEWER TOOLBAR
   */

  function createViewerButton(label, action) {
    const button = document.createElement("button");

    button.type = "button";
    button.textContent = label;

    button.style.cssText =
      "padding:10px 14px;border:1px solid #444;" +
      "border-radius:9px;background:#222;color:#fff;" +
      "font-size:13px;font-weight:600;cursor:pointer;";

    button.addEventListener("click", action);

    return button;
  }

  function updateFullscreenButton() {
    if (!fullscreenButton) return;

    const isFullscreen =
      document.fullscreenElement === previewShell ||
      state.fullscreenFallback;

    fullscreenButton.textContent = isFullscreen
      ? "Exit Full Screen"
      : "Full Screen";

    fullscreenButton.setAttribute(
      "aria-pressed",
      String(isFullscreen)
    );
  }

  function applyPreviewSize() {
    if (!previewShell || !previewFrame) return;

    const fullscreen =
      document.fullscreenElement === previewShell ||
      state.fullscreenFallback;

    if (fullscreen) {
      previewShell.style.position = "fixed";
      previewShell.style.inset = "0";
      previewShell.style.zIndex = "999999";
      previewShell.style.width = "100%";
      previewShell.style.height = "100dvh";
      previewShell.style.maxHeight = "100dvh";
      previewShell.style.borderRadius = "0";
      previewShell.style.background = "#fff";

      previewFrame.style.width = "100%";
      previewFrame.style.height = "calc(100dvh - 48px)";
      previewFrame.style.maxWidth = "100%";
      previewFrame.style.borderRadius = "0";

    } else {
      previewShell.style.position = "relative";
      previewShell.style.inset = "auto";
      previewShell.style.zIndex = "auto";
      previewShell.style.width = "100%";
      previewShell.style.height = "auto";
      previewShell.style.maxHeight = "none";
      previewShell.style.borderRadius = "12px";

      previewFrame.style.width =
        state.previewMode === "mobile"
          ? "390px"
          : "100%";

      previewFrame.style.maxWidth = "100%";
      previewFrame.style.height = "75vh";
      previewFrame.style.minHeight = "520px";
      previewFrame.style.borderRadius = "10px";
    }

    updateFullscreenButton();
  }

  async function toggleFullscreen() {
    if (!previewShell) return;

    const isNativeFullscreen =
      document.fullscreenElement === previewShell;

    if (isNativeFullscreen || state.fullscreenFallback) {
      if (isNativeFullscreen && document.exitFullscreen) {
        try {
          await document.exitFullscreen();
        } catch (error) {
          console.warn("Could not exit native fullscreen:", error);
        }
      }

      state.fullscreenFallback = false;
      applyPreviewSize();
      return;
    }

    if (previewShell.requestFullscreen) {
      try {
        await previewShell.requestFullscreen();
        return;
      } catch (error) {
        console.warn(
          "Native fullscreen unavailable. Using expanded viewer.",
          error
        );
      }
    }

    state.fullscreenFallback = true;
    applyPreviewSize();
  }

  function renderPreview() {
    if (!state.files) return;

    previewContainer.replaceChildren();

    previewShell = document.createElement("div");

    previewShell.className = "joseph-website-preview-shell";

    previewShell.style.cssText =
      "position:relative;width:100%;overflow:hidden;" +
      "border:1px solid #444;border-radius:12px;" +
      "background:#171717;";

    const toolbar = document.createElement("div");

    toolbar.style.cssText =
      "display:flex;align-items:center;gap:8px;" +
      "flex-wrap:wrap;padding:10px;" +
      "background:#171717;border-bottom:1px solid #333;";

    const viewerLabel = document.createElement("span");

    viewerLabel.textContent = "WEBSITE PREVIEW";

    viewerLabel.style.cssText =
      "font-size:11px;font-weight:700;" +
      "letter-spacing:1px;color:#d3a44b;margin-right:auto;";

    const desktopControl = createViewerButton(
      "Desktop",
      () => changePreviewMode("desktop")
    );

    const mobileControl = createViewerButton(
      "Mobile",
      () => changePreviewMode("mobile")
    );

    fullscreenButton = createViewerButton(
      "Full Screen",
      toggleFullscreen
    );

    toolbar.append(
      viewerLabel,
      desktopControl,
      mobileControl,
      fullscreenButton
    );

    previewFrame = document.createElement("iframe");

    previewFrame.title = "Generated website preview";

    previewFrame.setAttribute(
      "sandbox",
      "allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals"
    );

    previewFrame.setAttribute("loading", "eager");
    previewFrame.setAttribute("allow", "fullscreen");

    previewFrame.allowFullscreen = true;

    previewFrame.style.cssText =
      "display:block;width:100%;height:75vh;" +
      "min-height:520px;max-width:100%;" +
      "margin:0 auto;border:0;" +
      "background:#fff;";

    previewShell.append(toolbar, previewFrame);
    previewContainer.appendChild(previewShell);

    previewFrame.srcdoc = buildPreviewDocument(state.files);

    applyPreviewSize();

    if (desktopButton) {
      desktopButton.setAttribute(
        "aria-pressed",
        String(state.previewMode === "desktop")
      );
    }

    if (mobileButton) {
      mobileButton.setAttribute(
        "aria-pressed",
        String(state.previewMode === "mobile")
      );
    }

    desktopControl.setAttribute(
      "aria-pressed",
      String(state.previewMode === "desktop")
    );

    mobileControl.setAttribute(
      "aria-pressed",
      String(state.previewMode === "mobile")
    );
  }

  document.addEventListener("fullscreenchange", () => {
    if (!state.fullscreenFallback) {
      applyPreviewSize();
    }
  });

  document.addEventListener("keydown", event => {
    if (
      event.key === "Escape" &&
      state.fullscreenFallback
    ) {
      state.fullscreenFallback = false;
      applyPreviewSize();
    }
  });

  function downloadFile(name, content) {
    const blob = new Blob([content], {
      type: "text/plain;charset=utf-8"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = name;
    link.style.display = "none";

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function createFileCard(name, content) {
    const card = document.createElement("details");

    card.style.margin = "12px 0";
    card.style.padding = "12px";
    card.style.border = "1px solid #333";
    card.style.borderRadius = "10px";

    const summary = document.createElement("summary");

    summary.textContent = name;
    summary.style.cursor = "pointer";
    summary.style.fontWeight = "600";

    const code = document.createElement("pre");

    code.textContent = content;
    code.style.whiteSpace = "pre-wrap";
    code.style.overflowX = "auto";
    code.style.maxHeight = "400px";
    code.style.fontSize = "12px";
    code.style.padding = "12px";
    code.style.marginTop = "12px";
    code.style.background = "#111";
    code.style.borderRadius = "8px";

    const button = document.createElement("button");

    button.type = "button";
    button.textContent = `Download ${name}`;

    button.addEventListener("click", () => {
      downloadFile(name, content);
    });

    card.append(summary, code, button);

    return card;
  }

  function renderGeneratedFiles() {
    if (!state.files) return;

    filesContainer.replaceChildren();

    const heading = document.createElement("h3");

    heading.textContent = "Your generated website files";

    const description = document.createElement("p");

    description.textContent =
      "Inspect or download your generated HTML, CSS and JavaScript.";

    filesContainer.append(
      heading,
      description,
      createFileCard("index.html", state.files.html),
      createFileCard("style.css", state.files.css),
      createFileCard("script.js", state.files.js)
    );
  }

  function downloadAllFiles() {
    if (!state.files) {
      setStatus(
        "Generate a website before downloading.",
        "error"
      );
      return;
    }

    downloadFile("index.html", state.files.html);
    downloadFile("style.css", state.files.css);

    setTimeout(() => {
      downloadFile("script.js", state.files.js);
    }, 500);

    setStatus(
      "Your three website files are being downloaded.",
      "success"
    );
  }

  async function handleGenerate(event) {
    event.preventDefault();

    if (state.generating) return;

    if (!form.reportValidity()) return;

    const brief = collectBrief();

    if (
      !brief.projectName ||
      !brief.businessType ||
      !brief.description
    ) {
      setStatus(
        "Enter your project name, business type and description.",
        "error"
      );
      return;
    }

    setGenerating(true);

    setStatus(
      "Joseph AI is creating your website. Please wait...",
      "loading"
    );

    if (downloadButton) {
      downloadButton.disabled = true;
    }

    try {
      const result = await requestWebsite(brief);

      state.files = result.files;
      state.previewMode = "desktop";
      state.fullscreenFallback = false;

      renderPreview();
      renderGeneratedFiles();

      if (downloadButton) {
        downloadButton.disabled = false;
      }

      setStatus(
        `Website generated successfully using ${result.provider}. Preview and inspect your website below.`,
        "success"
      );

      console.info("Website provider:", result.provider);
      console.info("Website model:", result.model);
      console.info("Website note:", result.note);

    } catch (error) {
      console.error("Website Studio error:", error);
      setStatus(error.message, "error");

    } finally {
      setGenerating(false);
    }
  }

  function changePreviewMode(mode) {
    if (!state.files) {
      setStatus("Generate a website first.", "error");
      return;
    }

    if (mode !== "desktop" && mode !== "mobile") return;

    state.previewMode = mode;

    renderPreview();
  }

  form.addEventListener("submit", handleGenerate);

  if (desktopButton) {
    desktopButton.addEventListener("click", () => {
      changePreviewMode("desktop");
    });
  }

  if (mobileButton) {
    mobileButton.addEventListener("click", () => {
      changePreviewMode("mobile");
    });
  }

  if (downloadButton) {
    downloadButton.disabled = true;
    downloadButton.addEventListener("click", downloadAllFiles);
  }

  // Saving is deliberately left disabled until the
  // existing project-saving API is inspected.
  if (saveButton) {
    saveButton.disabled = true;
  }

  setStatus(
    "Website Studio is ready. Enter your project details to begin.",
    "info"
  );

  console.log("Joseph AI Website Studio loaded.");
})();
