
"use strict";

/*
 * JOSEPH AI V2 — WEBSITE STUDIO
 * Preview and generation controller
 *
 * Keeps generated websites isolated from Joseph AI.
 */

(() => {
  const API_URL = "/api/website";
  const REQUEST_TIMEOUT = 65000;

  const state = {
    files: null,
    generating: false,
    previewMode: "desktop"
  };

  const $ = (selector) => document.querySelector(selector);

  const form = $("#websiteBuilderForm");
  const status = $("#websiteBuilderStatus");
  const generateButton = $("#generateWebsiteButton");
  const previewContainer = $("#websitePreviewContainer");
  const filesContainer = $("#websiteGeneratedFiles");

  const desktopButton = $("#websiteDesktopPreviewButton");
  const mobileButton = $("#websiteMobilePreviewButton");
  const downloadButton = $("#downloadWebsiteButton");
  const saveButton = $("#saveWebsiteProjectButton");

  if (!form || !status || !generateButton ||
      !previewContainer || !filesContainer) {
    console.error("Website Studio: Required elements are missing.");
    return;
  }

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
      if (typeof files[name] !== "string" || !files[name].trim()) {
        throw new Error(`The generated ${name} file is missing.`);
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
        throw new Error("The server returned an unreadable response.");
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
   * PREVIEW SECURITY AND REPAIR
   *
   * Remove the generated website's references to local
   * style.css and script.js.
   *
   * Inject the actual generated CSS and JS instead.
   * This prevents the preview from loading Joseph AI files.
   */

  function buildPreviewDocument(files) {
    let html = files.html;

    // Remove generated base tags that could redirect relative links.
    html = html.replace(/<base\b[^>]*>/gi, "");

    // Remove local stylesheet references.
    html = html.replace(
      /<link\b(?=[^>]*\bhref\s*=\s*["'](?:\.\/)?style\.css(?:[?#][^"']*)?["'])[^>]*>/gi,
      ""
    );

    // Remove local JavaScript references.
    html = html.replace(
      /<script\b(?=[^>]*\bsrc\s*=\s*["'](?:\.\/)?script\.js(?:[?#][^"']*)?["'])[^>]*>\s*<\/script\s*>/gi,
      ""
    );

    // Prevent accidental loading of Joseph AI's relative assets.
    // Root-relative URLs are retained because they may be intentional.
    const css = files.css.replace(/<\/style/gi, "<\\/style");
    const js = files.js.replace(/<\/script/gi, "<\\/script");

    const styleTag = `<style>${css}</style>`;
    const scriptTag = `<script>${js}<\/script>`;

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
        `${scriptTag}</body>`
      );
    } else {
      html += scriptTag;
    }

    return html;
  }

  function renderPreview() {
    if (!state.files) return;

    previewContainer.replaceChildren();

    const frame = document.createElement("iframe");

    frame.title = "Generated website preview";

    /*
     * allow-scripts:
     * Runs the generated website's JavaScript.
     *
     * allow-forms:
     * Allows frontend forms to work.
     *
     * allow-popups:
     * Allows WhatsApp and external links to open.
     *
     * No allow-same-origin:
     * Keeps the generated site isolated from Joseph AI.
     */
    frame.setAttribute(
      "sandbox",
      "allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals"
    );

    frame.setAttribute("loading", "eager");
    frame.setAttribute("referrerpolicy", "no-referrer");

    frame.style.display = "block";
    frame.style.height = "700px";
    frame.style.maxWidth = "100%";
    frame.style.width =
      state.previewMode === "mobile" ? "390px" : "100%";
    frame.style.margin = "0 auto";
    frame.style.border = "1px solid #333";
    frame.style.borderRadius = "12px";
    frame.style.background = "#ffffff";

    frame.srcdoc = buildPreviewDocument(state.files);

    previewContainer.appendChild(frame);

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
  }

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
      setStatus("Generate a website before downloading.", "error");
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

  // Project saving will be connected after inspecting
  // the existing projects API.
  if (saveButton) {
    saveButton.disabled = true;
  }

  setStatus(
    "Website Studio is ready. Enter your project details to begin.",
    "info"
  );

  console.log("Joseph AI Website Studio loaded.");
})();
      
