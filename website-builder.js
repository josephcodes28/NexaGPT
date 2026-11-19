
"use strict";

/*
 * JOSEPH AI V2 — WEBSITE STUDIO CONNECTION
 *
 * Connects:
 * - Website Builder form
 * - /api/website generation endpoint
 * - Live website preview
 * - Generated HTML, CSS and JS display
 * - Individual file downloads and Download Website button
 *
 * This module does not modify the main Assistant controller.
 */

(() => {
  const API_URL = "/api/website";
  const REQUEST_TIMEOUT = 65000;

  const state = {
    files: null,
    projectName: "Joseph AI Website",
    previewMode: "desktop",
    generating: false
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

  if (!form || !status || !generateButton || !previewContainer || !filesContainer) {
    console.error("Website Studio: Required HTML elements were not found.");
    return;
  }

  function setStatus(message, type = "info") {
    status.textContent = message;
    status.dataset.status = type;
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
  }

  function getFieldValue(name) {
    const field = form.elements.namedItem(name);
    return field && typeof field.value === "string"
      ? field.value.trim()
      : "";
  }

  function collectBrief() {
    return {
      projectName: getFieldValue("projectName"),
      businessType: getFieldValue("businessType"),
      description: getFieldValue("description"),
      audience: getFieldValue("audience"),
      features: getFieldValue("features"),
      visualStyle: getFieldValue("visualStyle"),
      colors: getFieldValue("colors"),
      reference: getFieldValue("reference"),
      buildScope: getFieldValue("buildScope"),
      backendFeatures: getFieldValue("backendFeatures"),
      businessContact: getFieldValue("businessContact")
    };
  }

  function setGenerating(isGenerating) {
    state.generating = isGenerating;
    generateButton.disabled = isGenerating;
    generateButton.textContent = isGenerating
      ? "Generating your website..."
      : "Generate professional website";
  }

  function validateGeneratedFiles(files) {
    if (!files || typeof files !== "object") {
      throw new Error("The server returned an invalid response.");
    }

    for (const key of ["html", "css", "js"]) {
      if (typeof files[key] !== "string" || !files[key].trim()) {
        throw new Error(`The generated ${key.toUpperCase()} file is missing.`);
      }
    }

    return files;
  }

  async function generateWebsite(brief) {
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
          result.error || "Website generation failed. Please try again."
        );
      }

      const files = validateGeneratedFiles(result.files);

      return {
        files,
        model: result.model || "",
        note: result.note || ""
      };

    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error(
          "The request took too long. Please try again with a shorter description."
        );
      }

      if (error instanceof TypeError) {
        throw new Error(
          "Could not connect to Joseph AI. Check your internet connection and try again."
        );
      }

      throw error;

    } finally {
      clearTimeout(timeoutId);
    }
  }

  function buildPreviewDocument(files) {
    let html = files.html;

    // Remove references to the separate files.
    // Their contents will be inserted directly into the preview.
    html = html.replace(
      /<link\b(?=[^>]*\bhref\s*=\s*["'][^"']*style\.css(?:\?[^"']*)?["'])[^>]*>/gi,
      ""
    );

    html = html.replace(
      /<script\b(?=[^>]*\bsrc\s*=\s*["'][^"']*script\.js(?:\?[^"']*)?["'])[^>]*>\s*<\/script>/gi,
      ""
    );

    const safeCSS = files.css.replace(/<\/style/gi, "<\\/style");
    const safeJS = files.js.replace(/<\/script/gi, "<\\/script");

    const styleTag = `<style>${safeCSS}</style>`;
    const scriptTag = `<script>${safeJS}<\/script>`;

    if (/<\/head>/i.test(html)) {
      html = html.replace(/<\/head>/i, `${styleTag}</head>`);
    } else {
      html = `${styleTag}${html}`;
    }

    if (/<\/body>/i.test(html)) {
      html = html.replace(/<\/body>/i, `${scriptTag}</body>`);
    } else {
      html += scriptTag;
    }

    return html;
  }

  function renderPreview() {
    if (!state.files) return;

    previewContainer.replaceChildren();

    const frame = document.createElement("iframe");
    frame.title = "Generated website live preview";
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("loading", "lazy");
    frame.setAttribute("referrerpolicy", "no-referrer");

    frame.style.display = "block";
    frame.style.height = "650px";
    frame.style.border = "1px solid #333";
    frame.style.borderRadius = "12px";
    frame.style.background = "#ffffff";
    frame.style.margin = "0 auto";
    frame.style.maxWidth = "100%";
    frame.style.width =
      state.previewMode === "mobile" ? "390px" : "100%";

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

  function createFileCard(fileName, content) {
    const card = document.createElement("details");
    card.style.margin = "12px 0";
    card.style.padding = "12px";
    card.style.border = "1px solid #333";
    card.style.borderRadius = "10px";

    const summary = document.createElement("summary");
    summary.textContent = fileName;
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

    const download = document.createElement("button");
    download.type = "button";
    download.textContent = `Download ${fileName}`;
    download.style.marginTop = "10px";

    download.addEventListener("click", () => {
      downloadFile(fileName, content);
    });

    card.append(summary, code, download);
    return card;
  }

  function renderGeneratedFiles() {
    if (!state.files) return;

    filesContainer.replaceChildren();

    const heading = document.createElement("h3");
    heading.textContent = "Your generated website files";

    const description = document.createElement("p");
    description.textContent =
      "Open a file to inspect its code, or download it separately.";

    filesContainer.append(heading, description);

    filesContainer.append(
      createFileCard("index.html", state.files.html),
      createFileCard("style.css", state.files.css),
      createFileCard("script.js", state.files.js)
    );
  }

  function downloadFile(fileName, content) {
    const blob = new Blob([content], {
      type: "text/plain;charset=utf-8"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;
    link.style.display = "none";

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function downloadWebsiteFiles() {
    if (!state.files) {
      setStatus("Generate a website before downloading files.", "error");
      return;
    }

    downloadFile("index.html", state.files.html);
    downloadFile("style.css", state.files.css);

    setTimeout(() => {
      downloadFile("script.js", state.files.js);
    }, 500);

    setStatus(
      "Your three website files are being downloaded. Check your Downloads folder.",
      "success"
    );
  }

  async function handleGenerate(event) {
    event.preventDefault();

    if (state.generating) return;

    if (!form.reportValidity()) return;

    const brief = collectBrief();

    if (!brief.projectName || !brief.businessType || !brief.description) {
      setStatus(
        "Please enter the project name, business type and website description.",
        "error"
      );
      return;
    }

    state.projectName = brief.projectName;

    setGenerating(true);
    setStatus(
      "Joseph AI is creating your website. This may take a little while...",
      "loading"
    );

    if (downloadButton) downloadButton.disabled = true;

    try {
      const result = await generateWebsite(brief);

      state.files = result.files;
      state.previewMode = "desktop";

      renderPreview();
      renderGeneratedFiles();

      if (downloadButton) downloadButton.disabled = false;

      setStatus(
        "Website generated successfully! You can preview, inspect and download your files.",
        "success"
      );

      if (result.note) {
        console.info("Website Builder:", result.note);
      }

      if (result.model) {
        console.info("Website generation model:", result.model);
      }

    } catch (error) {
      console.error("Website generation error:", error);

      setStatus(error.message, "error");

    } finally {
      setGenerating(false);
    }
  }

  function setPreviewMode(mode) {
    if (!state.files) {
      setStatus("Generate a website before changing preview mode.", "error");
      return;
    }

    state.previewMode = mode;
    renderPreview();
  }

  form.addEventListener("submit", handleGenerate);

  if (desktopButton) {
    desktopButton.addEventListener("click", () => {
      setPreviewMode("desktop");
    });
  }

  if (mobileButton) {
    mobileButton.addEventListener("click", () => {
      setPreviewMode("mobile");
    });
  }

  if (downloadButton) {
    downloadButton.disabled = true;
    downloadButton.addEventListener("click", downloadWebsiteFiles);
  }

  // Saving is intentionally not connected yet.
  // We must inspect the existing projects API before implementing it.
  if (saveButton) {
    saveButton.disabled = true;
  }

  setStatus(
    "Website Studio is ready. Enter your project details to begin.",
    "info"
  );

  console.log("Joseph AI Website Studio connection loaded.");
})();
      
