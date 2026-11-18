
"use strict";

/* =========================================================
   JOSEPH AI V2
   CENTRAL CHAT CONTROLLER
   Mobile navigation | Browser history | Gemini connection
========================================================= */

(() => {
  const CONFIG = {
    api: {
      chat: "/api/chat",
      jobs: "/api/jobs"
    },

    storage: {
      conversations: "JOSEPH_V2_CONVERSATIONS",
      activeConversation: "JOSEPH_V2_ACTIVE_CONVERSATION",
      settings: "JOSEPH_V2_SETTINGS",
      memory: "JOSEPH_V2_MEMORY",
      projects: "JOSEPH_V2_PROJECTS",
      applications: "JOSEPH_V2_APPLICATIONS"
    },

    maxAttachmentSize: 8 * 1024 * 1024,
    maxAttachments: 5,
    requestTimeout: 90000,
    swipeThreshold: 80,
    edgeWidth: 30
  };

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    [...root.querySelectorAll(selector)];

  const state = {
    conversations: [],
    activeConversationId: null,
    attachments: [],
    settings: {},
    memory: [],
    projects: [],
    applications: [],

    isSending: false,
    recognition: null,
    listening: false,
    abortController: null,

    currentPage: "brain",
    sidebarOpen: false,

    touchStartX: 0,
    touchStartY: 0,
    touchStartedInSidebar: false
  };

  const defaultSettings = {
    theme: "dark",
    compact: false,
    model: "auto",
    webSearch: true,
    speakResponses: false,
    voiceLanguage: "en-US",
    memoryEnabled: true
  };

  /* =====================================================
     STORAGE
  ===================================================== */

  function readStorage(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      console.warn("Storage read error:", error);
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error("Storage write error:", error);
      showToast("Unable to save. Your phone storage may be full.");
      return false;
    }
  }

  function loadWorkspace() {
    state.conversations = readStorage(
      CONFIG.storage.conversations,
      []
    );

    state.activeConversationId = readStorage(
      CONFIG.storage.activeConversation,
      null
    );

    state.settings = {
      ...defaultSettings,
      ...readStorage(CONFIG.storage.settings, {})
    };

    state.memory = readStorage(CONFIG.storage.memory, []);
    state.projects = readStorage(CONFIG.storage.projects, []);
    state.applications = readStorage(
      CONFIG.storage.applications,
      []
    );

    if (!Array.isArray(state.conversations)) {
      state.conversations = [];
    }

    if (!Array.isArray(state.memory)) state.memory = [];
    if (!Array.isArray(state.projects)) state.projects = [];

    if (!Array.isArray(state.applications)) {
      state.applications = [];
    }

    if (!getActiveConversation()) {
      createConversation(false);
    }
  }

  function saveConversations() {
    writeStorage(
      CONFIG.storage.conversations,
      state.conversations
    );

    writeStorage(
      CONFIG.storage.activeConversation,
      state.activeConversationId
    );
  }

  function saveSettings() {
    writeStorage(CONFIG.storage.settings, state.settings);
  }

  /* =====================================================
     HELPERS
  ===================================================== */

  function escapeHTML(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      })[char]
    );
  }

  function showToast(message) {
    const container = $("#toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => toast.remove(), 3500);
  }

  function setConnection(message, status = "ready") {
    const text = $("#connectionText");
    const container = $("#connectionStatus");

    if (text) text.textContent = message;

    if (container) {
      container.dataset.status = status;
    }
  }

  function makeId() {
    return (
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 9)
    );
  }

  function setLoading(active, title, description) {
    const overlay = $("#loadingOverlay");
    if (!overlay) return;

    overlay.hidden = !active;

    if (title) $("#loadingTitle").textContent = title;

    if (description) {
      $("#loadingDescription").textContent = description;
    }
  }

  async function requestJSON(url, options = {}) {
    const controller = new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      CONFIG.requestTimeout
    );

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          ...(options.headers || {}),
          ...(options.body ? {
            "Content-Type": "application/json"
          } : {})
        }
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error ||
          data.message ||
          `Request failed (${response.status})`
        );
      }

      return data;

    } finally {
      clearTimeout(timeout);
    }
  }

  function getAssistantText(data) {
    if (typeof data === "string") return data;

    return (
      data?.reply ||
      data?.response ||
      data?.message ||
      data?.text ||
      data?.content ||
      data?.answer ||
      data?.result?.reply ||
      data?.result?.text ||
      "I received a response, but it did not contain readable text."
    );
  }

  /* =====================================================
     CONVERSATIONS
  ===================================================== */

  function getActiveConversation() {
    return state.conversations.find(
      conversation =>
        conversation.id === state.activeConversationId
    ) || null;
  }

  function createConversation(render = true) {
    const conversation = {
      id: makeId(),
      title: "New chat",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: []
    };

    state.conversations.unshift(conversation);
    state.activeConversationId = conversation.id;

    saveConversations();

    if (render) {
      renderMessages();
      renderConversationHistory();
      showPage("brain");
    }

    return conversation;
  }

  function openConversation(id) {
    const conversation = state.conversations.find(
      item => item.id === id
    );

    if (!conversation) return;

    state.activeConversationId = id;

    saveConversations();
    renderMessages();
    renderConversationHistory();

    showPage("brain");
  }

  function renameConversation(id) {
    const conversation = state.conversations.find(
      item => item.id === id
    );

    if (!conversation) return;

    const title = prompt(
      "Enter a new conversation name:",
      conversation.title
    );

    if (!title || !title.trim()) return;

    conversation.title = title.trim();
    conversation.updatedAt = new Date().toISOString();

    saveConversations();
    renderConversationHistory();
  }

  function deleteConversation(id) {
    if (!confirm(
      "Delete this conversation? This cannot be undone."
    )) return;

    state.conversations = state.conversations.filter(
      item => item.id !== id
    );

    if (state.activeConversationId === id) {
      state.activeConversationId = null;
      createConversation(false);
    }

    saveConversations();
    renderMessages();
    renderConversationHistory();

    showToast("Conversation deleted.");
  }

  function clearConversationHistory() {
    if (!confirm("Delete all conversation history?")) return;

    state.conversations = [];
    state.activeConversationId = null;

    createConversation(false);
    saveConversations();

    renderMessages();
    renderConversationHistory();

    showToast("Conversation history cleared.");
  }

  function updateConversationTitle(conversation, message) {
    if (conversation.title !== "New chat" || !message) return;

    conversation.title =
      message.trim().slice(0, 42) || "New conversation";
  }

  /* =====================================================
     CONVERSATION HISTORY
  ===================================================== */

  function renderConversationHistory(filter = "") {
    const container = $("#conversationHistoryList");
    if (!container) return;

    const search = filter.toLowerCase().trim();

    const conversations = state.conversations.filter(item =>
      item.title.toLowerCase().includes(search) ||
      item.messages.some(message =>
        String(message.content || "")
          .toLowerCase()
          .includes(search)
      )
    );

    if (!conversations.length) {
      container.innerHTML = `
        <div class="history-empty">
          ${search
            ? "No matching conversations."
            : "Your conversations will appear here."}
        </div>
      `;
      return;
    }

    container.innerHTML = conversations.map(item => `
      <div class="history-item ${
        item.id === state.activeConversationId ? "active" : ""
      }" data-conversation-id="${escapeHTML(item.id)}">

        <button
          class="history-open"
          type="button"
          data-history-open="${escapeHTML(item.id)}"
        >
          <span class="history-chat-icon">◌</span>
          <span class="history-title">
            ${escapeHTML(item.title)}
          </span>
        </button>

        <div class="history-actions">
          <button
            type="button"
            title="Rename"
            data-history-rename="${escapeHTML(item.id)}"
          >✎</button>

          <button
            type="button"
            title="Delete"
            data-history-delete="${escapeHTML(item.id)}"
          >×</button>
        </div>
      </div>
    `).join("");
  }

  function setupHistoryActions() {
    const container = $("#conversationHistoryList");
    if (!container) return;

    container.addEventListener("click", event => {
      const open = event.target.closest("[data-history-open]");
      const rename = event.target.closest("[data-history-rename]");
      const remove = event.target.closest("[data-history-delete]");

      if (open) {
        openConversation(open.dataset.historyOpen);
      }

      if (rename) {
        renameConversation(rename.dataset.historyRename);
      }

      if (remove) {
        deleteConversation(remove.dataset.historyDelete);
      }
    });

    $("#conversationSearch")?.addEventListener("input", event => {
      renderConversationHistory(event.target.value);
    });
  }

  /* =====================================================
     CHAT DISPLAY
  ===================================================== */

  function renderMessages() {
    const container = $("#chatMessages");
    if (!container) return;

    const conversation = getActiveConversation();
    const messages = conversation?.messages || [];

    if (!messages.length) {
      container.innerHTML = `
        <div class="brain-welcome" id="brainWelcome">
          <div class="welcome-logo"><span>J</span></div>

          <h1>How can I help you today?</h1>

          <p>
            I'm Joseph AI, your intelligent assistant and digital
            work partner. Tell me what you want to do.
          </p>

          <div class="welcome-capabilities">

            <button class="prompt-card"
              data-prompt="Research something on the internet and explain the findings."
              type="button">
              <span class="prompt-icon">⌕</span>
              <span>
                <strong>Research anything</strong>
                <small>Find information and useful answers</small>
              </span>
            </button>

            <button class="prompt-card"
              data-prompt="Help me create a professional website for a business."
              type="button">
              <span class="prompt-icon">⌘</span>
              <span>
                <strong>Build a website</strong>
                <small>Create professional websites and projects</small>
              </span>
            </button>

            <button class="prompt-card"
              data-prompt="Find legitimate remote jobs that accept applicants from Nigeria. Show real listings and their links."
              type="button">
              <span class="prompt-icon">↗</span>
              <span>
                <strong>Find online work</strong>
                <small>Explore real jobs and opportunities</small>
              </span>
            </button>

            <button class="prompt-card"
              data-prompt="Help me create content for social media."
              type="button">
              <span class="prompt-icon">✧</span>
              <span>
                <strong>Create content</strong>
                <small>Write, plan and develop content</small>
              </span>
            </button>

          </div>
        </div>
      `;

      return;
    }

    container.innerHTML = messages.map((message, index) => {
      const isUser = message.role === "user";

      return `
        <article class="message-row ${isUser ? "user" : "assistant"}">

          <div class="message-avatar">
            ${isUser ? "Y" : "J"}
          </div>

          <div class="message-content">

            <div class="message-author">
              ${isUser ? "You" : "Joseph AI"}
            </div>

            <div class="message-text">${
              escapeHTML(message.content).replace(/\n/g, "<br>")
            }</div>

            ${!isUser ? `
              <div class="message-actions">
                <button type="button" data-copy-message="${index}">
                  Copy
                </button>

                <button type="button" data-speak-message="${index}">
                  Read aloud
                </button>
              </div>
            ` : ""}

          </div>
        </article>
      `;
    }).join("");

    container.scrollTop = container.scrollHeight;
  }

  function setupMessageActions() {
    const container = $("#chatMessages");
    if (!container) return;

    container.onclick = async event => {
      const copyButton = event.target.closest("[data-copy-message]");
      const speakButton = event.target.closest("[data-speak-message]");

      const conversation = getActiveConversation();
      if (!conversation) return;

      if (copyButton) {
        const message =
          conversation.messages[
            Number(copyButton.dataset.copyMessage)
          ];

        if (!message) return;

        try {
          await navigator.clipboard.writeText(message.content);
          showToast("Message copied.");
        } catch {
          showToast("Could not copy this message.");
        }
      }

      if (speakButton) {
        const message =
          conversation.messages[
            Number(speakButton.dataset.speakMessage)
          ];

        if (message) speakText(message.content);
      }
    };
  }

  function addMessage(role, content, extra = {}) {
    const conversation =
      getActiveConversation() || createConversation(false);

    conversation.messages.push({
      role,
      content: String(content || ""),
      timestamp: new Date().toISOString(),
      ...extra
    });

    conversation.updatedAt = new Date().toISOString();

    if (role === "user") {
      updateConversationTitle(conversation, content);
    }

    saveConversations();
    renderMessages();
    renderConversationHistory();
  }

  function setTyping(active) {
    const indicator = $("#typingIndicator");
    if (indicator) indicator.hidden = !active;
  }

  /* =====================================================
     ATTACHMENTS
  ===================================================== */

  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(reader.result);

      reader.onerror = () => reject(
        new Error("Could not read the selected file.")
      );

      reader.readAsDataURL(file);
    });
  }

  async function addFiles(fileList) {
    const files = [...fileList];

    for (const file of files) {
      if (state.attachments.length >= CONFIG.maxAttachments) {
        showToast("Maximum of 5 attachments per message.");
        break;
      }

      if (!file.type.startsWith("image/")) {
        showToast(
          "Image attachments are supported by the current Brain connection. Other file types are not connected yet."
        );
        continue;
      }

      if (file.size > CONFIG.maxAttachmentSize) {
        showToast(`${file.name} is larger than 8 MB.`);
        continue;
      }

      try {
        const data = await fileToDataURL(file);

        state.attachments.push({
          name: file.name,
          type: file.type,
          size: file.size,
          data
        });

      } catch (error) {
        showToast(error.message);
      }
    }

    renderAttachments();
  }

  function renderAttachments() {
    const preview = $("#attachmentPreview");
    const list = $("#attachmentList");

    if (!preview || !list) return;

    preview.hidden = state.attachments.length === 0;

    list.innerHTML = state.attachments.map((file, index) => `
      <div class="attachment-item">
        <span>${escapeHTML(file.name)}</span>

        <button
          type="button"
          data-remove-attachment="${index}"
          aria-label="Remove attachment"
        >×</button>
      </div>
    `).join("");
  }

  function setupAttachments() {
    $("#attachFileButton")?.addEventListener("click", () => {
      $("#brainFileInput")?.click();
    });

    $("#brainImageButton")?.addEventListener("click", () => {
      $("#brainImageInput")?.click();
    });

    $("#brainFileInput")?.addEventListener("change", event => {
      addFiles(event.target.files);
      event.target.value = "";
    });

    $("#brainImageInput")?.addEventListener("change", event => {
      addFiles(event.target.files);
      event.target.value = "";
    });

    $("#clearAttachmentsButton")?.addEventListener("click", () => {
      state.attachments = [];
      renderAttachments();
    });

    $("#attachmentList")?.addEventListener("click", event => {
      const button = event.target.closest("[data-remove-attachment]");
      if (!button) return;

      state.attachments.splice(
        Number(button.dataset.removeAttachment),
        1
      );

      renderAttachments();
    });
  }

  /* =====================================================
     CENTRAL BRAIN CONNECTION
  ===================================================== */

  async function sendMessage(text) {
    const message = String(text || "").trim();

    if (
      (!message && !state.attachments.length) ||
      state.isSending
    ) {
      return;
    }

    if (!getActiveConversation()) {
      createConversation(false);
    }

    const attachments = [...state.attachments];

    state.attachments = [];
    renderAttachments();

    addMessage(
      "user",
      message || "Please examine my image attachment."
    );

    const input = $("#brainInput");

    if (input) {
      input.value = "";
      input.style.height = "auto";
    }

    state.isSending = true;
    state.abortController = new AbortController();

    const sendButton = $("#sendBrainButton");

    if (sendButton) sendButton.disabled = true;

    setTyping(true);
    setConnection("Thinking...", "busy");

    const timeout = setTimeout(() => {
      state.abortController?.abort();
    }, CONFIG.requestTimeout);

    try {
      const active = getActiveConversation();

      const history = (active?.messages || [])
        .slice(-21, -1)
        .map(item => ({
          role: item.role,
          content: item.content
        }));

      const payload = {
        message:
          message || "Please examine my image attachment.",

        history,

        attachments: attachments.map(file => ({
          name: file.name,
          type: file.type,
          data: file.data
        })),

        settings: {
          model: state.settings.model,
          webSearch: state.settings.webSearch
        }
      };

      // Send the actual request to the Joseph AI Brain.
      const response = await fetch(CONFIG.api.chat, {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify(payload),

        signal: state.abortController.signal
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error ||
          data.message ||
          `Server error: ${response.status}`
        );
      }

      if (data.success === false) {
        throw new Error(
          data.error || "The AI could not complete the request."
        );
      }

      const reply = getAssistantText(data);

      addMessage("assistant", reply);

      if (state.settings.speakResponses) {
        speakText(reply);
      }

      setConnection("Ready", "ready");

    } catch (error) {
      if (error.name === "AbortError") {
        addMessage(
          "assistant",
          "The request was stopped or took too long. You can try again."
        );

        setConnection("Stopped", "ready");

      } else {
        console.error("Joseph AI chat error:", error);

        addMessage(
          "assistant",
          `I couldn't connect to my Brain right now.\n\n${error.message}\n\nPlease check your internet connection and try again.`
        );

        setConnection("Connection error", "error");
      }

    } finally {
      clearTimeout(timeout);

      state.isSending = false;
      state.abortController = null;

      setTyping(false);

      if (sendButton) sendButton.disabled = false;
    }
  }

  function stopGeneration() {
    if (state.abortController) {
      state.abortController.abort();
    }

    stopSpeaking();
    stopVoiceRecognition();
  }

  /* =====================================================
     VOICE
  ===================================================== */

  function startVoiceRecognition() {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      showToast("Voice input is not supported in this browser.");
      return;
    }

    if (state.listening) {
      stopVoiceRecognition();
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang =
      state.settings.voiceLanguage || "en-US";

    recognition.interimResults = true;
    recognition.continuous = false;

    let finalTranscript = "";

    recognition.onstart = () => {
      state.listening = true;
      setConnection("Listening...", "busy");
    };

    recognition.onresult = event => {
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];

        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      const input = $("#brainInput");

      if (input) {
        input.value = finalTranscript + interimTranscript;
      }
    };

    recognition.onerror = event => {
      showToast(`Voice input error: ${event.error}`);
    };

    recognition.onend = () => {
      state.listening = false;
      state.recognition = null;

      setConnection("Ready", "ready");

      const input = $("#brainInput");

      if (input?.value.trim()) {
        sendMessage(input.value);
      }
    };

    state.recognition = recognition;

    try {
      recognition.start();
    } catch (error) {
      state.recognition = null;
      state.listening = false;

      showToast("Could not start voice input.");
    }
  }

  function stopVoiceRecognition() {
    const recognition = state.recognition;

    state.recognition = null;
    state.listening = false;

    if (recognition) {
      try {
        recognition.abort();
      } catch {}
    }
  }

  function speakText(text) {
    if (!("speechSynthesis" in window)) {
      showToast("Speech output is not supported.");
      return;
    }

    stopSpeaking();

    const utterance = new SpeechSynthesisUtterance(text);

    utterance.lang =
      state.settings.voiceLanguage || "en-US";

    speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    if ("speechSynthesis" in window) {
      speechSynthesis.cancel();
    }
  }

  
  /* =====================================================
     SIDEBAR AND PAGE NAVIGATION
  ===================================================== */

  function isSidebarOpen() {
    return Boolean($("#sidebar")?.classList.contains("open"));
  }

  function setSidebarVisual(open) {
    state.sidebarOpen = open;

    $("#sidebar")?.classList.toggle("open", open);

    $("#sidebarOverlay")?.classList.toggle(
      "visible",
      open
    );

    $("#menuToggle")?.setAttribute(
      "aria-expanded",
      String(open)
    );
  }

  function openSidebar() {
    if (isSidebarOpen()) return;

    // Add a browser-history entry so Android Back closes the sidebar.
    history.pushState(
      {
        josephAI: true,
        type: "sidebar",
        page: state.currentPage
      },
      ""
    );

    setSidebarVisual(true);
  }

  function closeSidebar() {
    if (!isSidebarOpen()) return;

    // If the sidebar owns the current history entry,
    // Android/browser Back will close it naturally.
    if (
      history.state?.josephAI &&
      history.state.type === "sidebar"
    ) {
      history.back();
      return;
    }

    setSidebarVisual(false);
  }

  function showPage(page) {
    const allowedPages = [
      "brain",
      "projects",
      "autopilot",
      "memory",
      "settings"
    ];

    if (!allowedPages.includes(page)) {
      page = "brain";
    }

    const sidebarWasOpen = isSidebarOpen();
    const pageChanged = page !== state.currentPage;

    // If a page is selected from the sidebar,
    // replace the sidebar entry instead of leaving a stale entry.
    if (
      sidebarWasOpen &&
      history.state?.josephAI &&
      history.state.type === "sidebar"
    ) {
      history.replaceState(
        {
          josephAI: true,
          type: "page",
          page
        },
        ""
      );

    } else if (pageChanged) {
      history.pushState(
        {
          josephAI: true,
          type: "page",
          page
        },
        ""
      );
    }

    state.currentPage = page;

    $$("[data-page-section]").forEach(section => {
      section.classList.toggle(
        "active",
        section.dataset.pageSection === page
      );
    });

    $$("[data-page]").forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.page === page
      );
    });

    const modelName = $("#currentModelName");

    if (modelName) {
      modelName.textContent =
        page === "brain"
          ? "Joseph AI"
          : page.charAt(0).toUpperCase() + page.slice(1);
    }

    setSidebarVisual(false);

    if (page === "projects") renderProjects();
    if (page === "memory") renderMemory();
    if (page === "settings") renderSettings();
    if (page === "autopilot") renderAutopilot();
  }

  function handleBrowserBack(event) {
    // Back from an open sidebar closes it.
    if (event.state?.josephAI && event.state.type === "sidebar") {
      setSidebarVisual(true);
      return;
    }

    setSidebarVisual(false);

    const previousPage =
      event.state?.josephAI
        ? event.state.page
        : "brain";

    state.currentPage = previousPage || "brain";

    $$("[data-page-section]").forEach(section => {
      section.classList.toggle(
        "active",
        section.dataset.pageSection === state.currentPage
      );
    });

    $$("[data-page]").forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.page === state.currentPage
      );
    });

    const modelName = $("#currentModelName");

    if (modelName) {
      modelName.textContent =
        state.currentPage === "brain"
          ? "Joseph AI"
          : state.currentPage.charAt(0).toUpperCase() +
            state.currentPage.slice(1);
    }

    stopSpeaking();

    if (state.currentPage === "projects") renderProjects();
    if (state.currentPage === "memory") renderMemory();
    if (state.currentPage === "settings") renderSettings();
    if (state.currentPage === "autopilot") renderAutopilot();
  }

  function setupNavigation() {
    $$("[data-page]").forEach(button => {
      button.addEventListener("click", () => {
        showPage(button.dataset.page);
      });
    });

    $("#menuToggle")?.addEventListener(
      "click",
      openSidebar
    );

    $("#closeSidebarButton")?.addEventListener(
      "click",
      closeSidebar
    );

    $("#sidebarOverlay")?.addEventListener(
      "click",
      closeSidebar
    );

    $("#newChatButton")?.addEventListener("click", () => {
      createConversation();
    });

    // Android Back button and browser Back button.
    window.addEventListener("popstate", handleBrowserBack);

    // Escape is the keyboard equivalent of Back.
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        if (isSidebarOpen()) {
          closeSidebar();
        } else {
          stopSpeaking();
        }
      }
    });

    // Touch navigation.
    document.addEventListener("touchstart", event => {
      const touch = event.touches[0];
      if (!touch) return;

      state.touchStartX = touch.clientX;
      state.touchStartY = touch.clientY;

      state.touchStartedInSidebar =
        Boolean(touch.target.closest("#sidebar"));

    }, { passive: true });

    document.addEventListener("touchend", event => {
      const touch = event.changedTouches[0];
      if (!touch) return;

      const dx = touch.clientX - state.touchStartX;
      const dy = touch.clientY - state.touchStartY;

      // Ignore vertical gestures. Normal page scrolling stays natural.
      if (Math.abs(dy) > Math.abs(dx)) return;

      if (
        !isSidebarOpen() &&
        state.touchStartX <= CONFIG.edgeWidth &&
        dx >= CONFIG.swipeThreshold
      ) {
        openSidebar();
        return;
      }

      if (
        isSidebarOpen() &&
        state.touchStartedInSidebar &&
        dx <= -CONFIG.swipeThreshold
      ) {
        closeSidebar();
      }

    }, { passive: true });
  }

    /* =====================================================
     CHAT COMPOSER
  ===================================================== */

  function setupComposer() {
    $("#brainForm")?.addEventListener("submit", event => {
      event.preventDefault();

      sendMessage($("#brainInput")?.value || "");
    });

    $("#brainInput")?.addEventListener("keydown", event => {
      if (
        event.key === "Enter" &&
        !event.shiftKey &&
        !event.isComposing
      ) {
        event.preventDefault();
        sendMessage(event.target.value);
      }
    });

    $("#brainInput")?.addEventListener("input", event => {
      const input = event.target;

      input.style.height = "auto";

      input.style.height =
        Math.min(input.scrollHeight, 180) + "px";
    });

    $("#brainVoiceButton")?.addEventListener(
      "click",
      startVoiceRecognition
    );

    $("#stopSpeakingButton")?.addEventListener(
      "click",
      stopGeneration
    );

    $("#chatMessages")?.addEventListener("click", event => {
      const prompt = event.target.closest("[data-prompt]");
      if (!prompt) return;

      sendMessage(prompt.dataset.prompt);
    });

    setupMessageActions();
  }

  /* =====================================================
     PROJECTS
  ===================================================== */

  function renderProjects() {
    const container = $("#allProjectsList");
    if (!container) return;

    if (!state.projects.length) {
      container.innerHTML = `
        <div class="empty-state">
          <span>▣</span>
          <h3>No projects yet</h3>
          <p>Ask Joseph AI to help you create your first project.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = state.projects.map(project => `
      <article class="workspace-card">
        <h3>${escapeHTML(project.name || "Untitled project")}</h3>
        <p>${escapeHTML(project.description || "Project")}</p>
        <small>${escapeHTML(project.type || "General")}</small>
      </article>
    `).join("");
  }

  /* =====================================================
     MEMORY
  ===================================================== */

  function renderMemory() {
    const container = $("#memoryList");
    if (!container) return;

    if (!state.memory.length) {
      container.innerHTML = `
        <p class="muted-text">No saved memories yet.</p>
      `;
      return;
    }

    container.innerHTML = state.memory.map((item, index) => `
      <div class="memory-item">
        <span>${escapeHTML(item.text || item)}</span>

        <button
          type="button"
          data-delete-memory="${index}"
          aria-label="Delete memory"
        >×</button>
      </div>
    `).join("");
  }

  function setupMemory() {
    $("#memoryForm")?.addEventListener("submit", event => {
      event.preventDefault();

      const input = $("#memoryInput");
      const text = input?.value.trim();

      if (!text) return;

      state.memory.unshift({
        id: makeId(),
        text,
        createdAt: new Date().toISOString()
      });

      writeStorage(CONFIG.storage.memory, state.memory);

      input.value = "";
      renderMemory();

      showToast("Memory saved on this device.");
    });

    $("#memoryList")?.addEventListener("click", event => {
      const button = event.target.closest("[data-delete-memory]");
      if (!button) return;

      const index = Number(button.dataset.deleteMemory);

      if (!confirm("Delete this saved memory?")) return;

      state.memory.splice(index, 1);

      writeStorage(CONFIG.storage.memory, state.memory);
      renderMemory();
    });

    $("#memoryEnabled")?.addEventListener("change", event => {
      state.settings.memoryEnabled = event.target.checked;
      saveSettings();
    });
  }

    /* =====================================================
     AUTOPILOT
  ===================================================== */

  function renderAutopilot() {
    const count = $("#autopilotOpportunityCount");
    const tasks = $("#autopilotTaskCount");
    const completed = $("#autopilotCompletedCount");

    if (count) count.textContent = "0";
    if (tasks) tasks.textContent = "0";
    if (completed) completed.textContent = "0";
  }

  async function scanOpportunities() {
    const button = $("#scanOpportunitiesButton");

    if (button) {
      button.disabled = true;
      button.textContent = "Searching...";
    }

    try {
      const params = new URLSearchParams({
        category: "Website Developer",
        location: "Nigeria",
        keywords: "remote"
      });

      const data = await requestJSON(
        `${CONFIG.api.jobs}?${params.toString()}`,
        { method: "GET" }
      );

      const jobs = Array.isArray(data)
        ? data
        : data.jobs || data.results || [];

      const container = $("#autopilotOpportunities");

      if (!container) return;

      if (!jobs.length) {
        container.innerHTML = `
          <p class="muted-text">
            No opportunities were returned by the jobs service.
            Try again later or choose another category.
          </p>
        `;
      } else {
        container.innerHTML = jobs.map(job => {
          const url = job.url || job.link || "";

          return `
            <article class="opportunity-item">

              <h4>${escapeHTML(
                job.title || job.name || "Untitled listing"
              )}</h4>

              <p>${escapeHTML(
                job.company || job.organization || "Company not provided"
              )}</p>

              <p>${escapeHTML(
                job.location || "Location not provided"
              )}</p>

              <p>${escapeHTML(
                job.salary || job.pay || "Pay not disclosed"
              )}</p>

              ${url ? `
                <a
                  href="${escapeHTML(url)}"
                  target="_blank"
                  rel="noopener noreferrer"
                >View original listing</a>
              ` : ""}

            </article>
          `;
        }).join("");
      }

      if ($("#autopilotOpportunityCount")) {
        $("#autopilotOpportunityCount").textContent = jobs.length;
      }

      showToast("Opportunity search completed.");

    } catch (error) {
      console.error(error);

      const container = $("#autopilotOpportunities");

      if (container) {
        container.innerHTML = `
          <p class="muted-text">
            Opportunity search is currently unavailable:
            ${escapeHTML(error.message)}
          </p>
        `;
      }

      showToast("Could not retrieve opportunities.");

    } finally {
      if (button) {
        button.disabled = false;
        button.innerHTML = "<span>✧</span> Find opportunities";
      }
    }
  }

  function setupAutopilot() {
    $("#scanOpportunitiesButton")?.addEventListener(
      "click",
      scanOpportunities
    );
  }

  /* =====================================================
     SETTINGS
  ===================================================== */

  function applySettings() {
    const theme = state.settings.theme || "dark";

    document.documentElement.dataset.theme = theme;

    document.body.classList.toggle(
      "light-theme",
      theme === "light"
    );

    document.body.classList.toggle(
      "compact-mode",
      Boolean(state.settings.compact)
    );

    const memoryEnabled = $("#memoryEnabled");

    if (memoryEnabled) {
      memoryEnabled.checked =
        state.settings.memoryEnabled !== false;
    }
  }

  function renderSettings() {
    const map = {
      appearanceSetting: "theme",
      compactModeSetting: "compact",
      defaultModelSetting: "model",
      webSearchSetting: "webSearch",
      speakResponsesSetting: "speakResponses",
      voiceLanguageSetting: "voiceLanguage"
    };

    Object.entries(map).forEach(([id, key]) => {
      const element = $("#" + id);
      if (!element) return;

      if (element.type === "checkbox") {
        element.checked = Boolean(state.settings[key]);
      } else {
        element.value =
          state.settings[key] ?? defaultSettings[key];
      }
    });
  }

  function setupSettings() {
    const map = {
      appearanceSetting: "theme",
      compactModeSetting: "compact",
      defaultModelSetting: "model",
      webSearchSetting: "webSearch",
      speakResponsesSetting: "speakResponses",
      voiceLanguageSetting: "voiceLanguage"
    };

    Object.entries(map).forEach(([id, key]) => {
      $("#" + id)?.addEventListener("change", event => {
        const element = event.target;

        state.settings[key] =
          element.type === "checkbox"
            ? element.checked
            : element.value;

        saveSettings();
        applySettings();
      });
    });

    $("#themeButton")?.addEventListener("click", () => {
      state.settings.theme =
        state.settings.theme === "dark" ? "light" : "dark";

      saveSettings();
      applySettings();
      renderSettings();
    });

    $("#exportDataButton")?.addEventListener(
      "click",
      exportData
    );

    $("#clearHistoryButton")?.addEventListener(
      "click",
      clearConversationHistory
    );

    $("#clearLocalDataButton")?.addEventListener("click", () => {
      if (!confirm(
        "This will clear local conversations, projects, memories and settings. Continue?"
      )) return;

      Object.values(CONFIG.storage).forEach(key => {
        localStorage.removeItem(key);
      });

      location.reload();
    });
  }

  function exportData() {
    const data = {
      exportedAt: new Date().toISOString(),
      conversations: state.conversations,
      projects: state.projects,
      memory: state.memory,
      settings: state.settings,
      applications: state.applications
    };

    const blob = new Blob(
      [JSON.stringify(data, null, 2)],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "joseph-ai-backup.json";
    link.click();

    URL.revokeObjectURL(url);

    showToast("Workspace backup exported.");
  }

    /* =====================================================
     INITIALIZATION
  ===================================================== */

  function init() {
    loadWorkspace();

    // Create a starting point for in-app browser navigation.
    history.replaceState(
      {
        josephAI: true,
        type: "base",
        page: "brain"
      },
      ""
    );

    state.currentPage = "brain";

    applySettings();

    renderMessages();
    renderConversationHistory();
    renderProjects();
    renderMemory();
    renderAutopilot();
    renderSettings();
    renderAttachments();

    setupNavigation();
    setupHistoryActions();
    setupComposer();
    setupAttachments();
    setupMemory();
    setupAutopilot();
    setupSettings();

    setConnection("Ready", "ready");

    console.log("Joseph AI V2 initialized successfully.");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, {
      once: true
    });
  } else {
    init();
  }

})();
