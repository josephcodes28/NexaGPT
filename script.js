
"use strict";

/* =========================================================
   JOSEPH AI V2
   MAIN FRONTEND CONTROLLER
   File: script.js

   Frontend features:
   - Navigation and responsive sidebar
   - AI conversations and local history
   - File and image attachments
   - Browser speech recognition and speech synthesis
   - Research, website, app, game and content workflows
   - Website preview, code tabs and downloads
   - Local projects, memory and settings
   - Remote work and Autopilot interface
   - Export and local data management

   Backend endpoints are connected separately.
   ========================================================= */

const JosephAI = (() => {
  "use strict";

  const CONFIG = {
    api: {
      chat: "/api/chat",
      website: "/api/website",
      content: "/api/content",
      jobs: "/api/jobs",
      image: "/api/image",
      video: "/api/video",
      app: "/api/app",
      game: "/api/game"
    },

    storage: {
      conversations: "JOSEPH_V2_CONVERSATIONS",
      activeConversation: "JOSEPH_V2_ACTIVE_CONVERSATION",
      projects: "JOSEPH_V2_PROJECTS",
      websites: "JOSEPH_V2_WEBSITES",
      content: "JOSEPH_V2_CONTENT",
      activity: "JOSEPH_V2_ACTIVITY",
      memory: "JOSEPH_V2_MEMORY",
      settings: "JOSEPH_V2_SETTINGS",
      applications: "JOSEPH_V2_APPLICATIONS",
      attachments: "JOSEPH_V2_ATTACHMENTS"
    },

    maxAttachmentSize: 8 * 1024 * 1024,
    maxAttachments: 5,
    requestTimeout: 90000
  };

  const state = {
    currentPage: "brain",
    activeConversationId: null,
    conversations: [],
    messages: [],
    attachments: [],
    websites: [],
    projects: [],
    contentHistory: [],
    activity: [],
    memory: [],
    applications: [],
    currentWebsite: null,
    currentContent: "",
    currentImage: null,
    currentApp: null,
    currentGame: null,
    currentVideo: null,
    currentCodeTab: "html",
    lastContentRequest: null,
    lastJobResults: [],
    recognition: null,
    isListening: false,
    isSending: false,
    speechEnabled: false,
    speechLanguage: "en-US",
    compactMode: false
  };

  const pageNames = {
    brain: "Joseph Brain",
    research: "Research & Search",
    voice: "Voice Conversation",
    "image-studio": "Image Studio",
    "video-studio": "Video Studio",
    "website-builder": "Website Builder",
    "app-builder": "App Builder",
    "game-builder": "Game Builder",
    "content-studio": "Content Studio",
    "remote-work": "Remote Work",
    autopilot: "Autopilot",
    projects: "My Projects",
    history: "History",
    memory: "Memory",
    settings: "Settings"
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) =>
    Array.from(root.querySelectorAll(selector));

  const byId = id => document.getElementById(id);

  function makeId() {
    return (
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 9)
    );
  }

  function safeRead(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      console.warn("Could not read local data:", key, error);
      return fallback;
    }
  }

  function safeWrite(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error("Could not save local data:", error);
      showToast(
        "Storage is full or unavailable. Some data could not be saved.",
        "error"
      );
      return false;
    }
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[character]);
  }

  function formatDate(value) {
    const date = new Date(value || Date.now());

    return date.toLocaleString([], {
      dateStyle: "medium",
      timeStyle: "short"
    });
  }

  function showToast(message, type = "success") {
    const container = byId("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    window.setTimeout(() => {
      toast.classList.add("toast-visible");
    }, 10);

    window.setTimeout(() => {
      toast.remove();
    }, 4000);
  }

  function setStatus(id, message) {
    const element = byId(id);
    if (element) element.textContent = message;
  }

  function setFeedback(id, message) {
    const element = byId(id);
    if (element) element.textContent = message;
  }

  function setButtonLoading(button, loading, loadingText) {
    if (!button) return;

    if (loading) {
      button.dataset.originalText = button.textContent;
      button.disabled = true;
      if (loadingText) button.textContent = loadingText;
    } else {
      button.disabled = false;
      if (button.dataset.originalText) {
        button.textContent = button.dataset.originalText;
        delete button.dataset.originalText;
      }
    }
  }

  function setGlobalLoading(
    visible,
    title = "Joseph AI is working...",
    description = "Please wait."
  ) {
    const overlay = byId("loadingOverlay");
    if (!overlay) return;

    overlay.hidden = !visible;

    const titleElement = byId("loadingTitle");
    const descriptionElement = byId("loadingDescription");

    if (titleElement) titleElement.textContent = title;
    if (descriptionElement) {
      descriptionElement.textContent = description;
    }
  }

  async function requestJSON(url, options = {}) {
    const controller = new AbortController();

    const timeout = window.setTimeout(
      () => controller.abort(),
      options.timeout || CONFIG.requestTimeout
    );

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          ...(options.body instanceof FormData
            ? {}
            : { "Content-Type": "application/json" }),
          ...(options.headers || {})
        }
      });

      const text = await response.text();
      let data = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { text };
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
          data.message ||
          `Server returned error ${response.status}`
        );
      }

      return data;
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error(
          "The request took too long. Please try again."
        );
      }

      if (error instanceof TypeError) {
        throw new Error(
          "Could not connect to the service. Check your internet connection and backend deployment."
        );
      }

      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function downloadFile(filename, content, type = "text/plain") {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function downloadJSON(filename, data) {
    downloadFile(
      filename,
      JSON.stringify(data, null, 2),
      "application/json"
    );
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(
        new Error(`Could not read ${file.name}`)
      );

      reader.readAsDataURL(file);
    });
  }

  function recordActivity(title, type = "activity") {
    state.activity.unshift({
      id: makeId(),
      title,
      type,
      createdAt: new Date().toISOString()
    });

    state.activity = state.activity.slice(0, 100);

    safeWrite(CONFIG.storage.activity, state.activity);
    renderActivityHistory();
  }

  /* =======================================================
     INITIAL DATA
     ======================================================= */

  function loadData() {
    state.conversations = safeRead(
      CONFIG.storage.conversations,
      []
    );

    state.activeConversationId = safeRead(
      CONFIG.storage.activeConversation,
      null
    );

    state.projects = safeRead(CONFIG.storage.projects, []);
    state.websites = safeRead(CONFIG.storage.websites, []);
    state.contentHistory = safeRead(CONFIG.storage.content, []);
    state.activity = safeRead(CONFIG.storage.activity, []);
    state.memory = safeRead(CONFIG.storage.memory, []);
    state.applications = safeRead(CONFIG.storage.applications, []);

    const settings = safeRead(CONFIG.storage.settings, {});

    applySettings(settings);

    if (
      state.activeConversationId &&
      state.conversations.some(
        item => item.id === state.activeConversationId
      )
    ) {
      const conversation = state.conversations.find(
        item => item.id === state.activeConversationId
      );

      state.messages = conversation.messages || [];
      renderMessages();
    } else {
      createConversation(false);
    }

    renderAll();
  }

  function saveConversations() {
    safeWrite(CONFIG.storage.conversations, state.conversations);
    safeWrite(
      CONFIG.storage.activeConversation,
      state.activeConversationId
    );
  }

  function saveProjects() {
    safeWrite(CONFIG.storage.projects, state.projects);
    renderProjects();
  }

  function saveWebsites() {
    safeWrite(CONFIG.storage.websites, state.websites);
    renderWebsiteProjects();
    renderProjects();
  }

  function renderAll() {
    renderMessages();
    renderHistory();
    renderActivityHistory();
    renderMemory();
    renderWebsiteProjects();
    renderContentHistory();
    renderApplications();
    renderProjects();
    renderAutopilotStats();
  }

  /* =======================================================
     NAVIGATION
     ======================================================= */

  function openPage(page) {
    if (!pageNames[page]) return;

    state.currentPage = page;

    $$(".page-section").forEach(section => {
      section.classList.toggle(
        "active",
        section.dataset.pageSection === page
      );
    });

    $$(".nav-item").forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.page === page
      );
    });

    const title = byId("currentPageName");
    if (title) title.textContent = pageNames[page];

    closeSidebar();

    if (page === "history") renderHistory();
    if (page === "projects") renderProjects();
    if (page === "memory") renderMemory();
    if (page === "autopilot") renderAutopilotStats();

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openSidebar() {
    byId("sidebar")?.classList.add("sidebar-open");
    byId("sidebarOverlay")?.classList.add("active");
  }

  function closeSidebar() {
    byId("sidebar")?.classList.remove("sidebar-open");
    byId("sidebarOverlay")?.classList.remove("active");
  }

  function setupNavigation() {
    $$("[data-page]").forEach(button => {
      button.addEventListener("click", () => {
        openPage(button.dataset.page);
      });
    });

    $$("[data-open-page]").forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault();
        openPage(button.dataset.openPage);
      });
    });

    byId("menuToggle")?.addEventListener("click", openSidebar);
    byId("closeSidebar")?.addEventListener("click", closeSidebar);
    byId("sidebarOverlay")?.addEventListener("click", closeSidebar);

    byId("newChatButton")?.addEventListener("click", () => {
      createConversation();
      openPage("brain");
    });

    byId("clearBrainChat")?.addEventListener("click", () => {
      createConversation();
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") closeSidebar();
    });
  }

  /* =======================================================
     CONVERSATIONS AND BRAIN
     ======================================================= */

  function createConversation(showMessage = true) {
    const conversation = {
      id: makeId(),
      title: "New conversation",
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    state.conversations.unshift(conversation);
    state.activeConversationId = conversation.id;
    state.messages = [];

    saveConversations();
    renderMessages();
    renderHistory();

    if (showMessage) {
      showToast("New conversation started.");
    }
  }

  function getActiveConversation() {
    return state.conversations.find(
      item => item.id === state.activeConversationId
    );
  }

  function saveActiveConversation() {
    const conversation = getActiveConversation();
    if (!conversation) return;

    conversation.messages = state.messages;
    conversation.updatedAt = new Date().toISOString();

    const firstUserMessage = state.messages.find(
      message => message.role === "user"
    );

    if (firstUserMessage) {
      conversation.title =
        firstUserMessage.content.slice(0, 55) ||
        "New conversation";
    }

    saveConversations();
    renderHistory();
  }

  function renderMessages() {
    const container = byId("chatMessages");
    if (!container) return;

    if (!state.messages.length) {
      container.innerHTML = `
        <div class="welcome-screen" id="brainWelcome">
          <div class="welcome-symbol">✦</div>
          <h2>What can I help you with today?</h2>
          <p>Ask me anything. Let's think, build, learn and make progress together.</p>

          <div class="suggestion-grid">
            <button class="suggestion-card" data-prompt="Help me plan and build a professional website for a customer." type="button">
              <span class="suggestion-icon">⌘</span>
              <strong>Build a website</strong>
              <small>Create a professional website for a client.</small>
            </button>

            <button class="suggestion-card" data-prompt="Give me real online work opportunities I can apply for from Nigeria." type="button">
              <span class="suggestion-icon">↗</span>
              <strong>Find online work</strong>
              <small>Discover real opportunities and next steps.</small>
            </button>

            <button class="suggestion-card" data-prompt="Help me create an app and explain how to publish it." type="button">
              <span class="suggestion-icon">▣</span>
              <strong>Create an app</strong>
              <small>Plan and develop a real application.</small>
            </button>

            <button class="suggestion-card" data-prompt="Give me a creative business idea and explain how I can start." type="button">
              <span class="suggestion-icon">✧</span>
              <strong>Explore an idea</strong>
              <small>Get practical ideas and guidance.</small>
            </button>
          </div>
        </div>
      `;

      bindSuggestionButtons();
      return;
    }

    container.innerHTML = "";

    state.messages.forEach(message => {
      const wrapper = document.createElement("article");
      wrapper.className = `chat-message ${message.role === "user" ? "user-message" : "assistant-message"}`;

      const avatar = document.createElement("div");
      avatar.className = "message-avatar";
      avatar.textContent = message.role === "user" ? "J" : "✦";

      const content = document.createElement("div");
      content.className = "message-content";

      const label = document.createElement("div");
      label.className = "message-author";
      label.textContent = message.role === "user" ? "You" : "Joseph AI";

      const body = document.createElement("div");
      body.className = "message-text";
      body.textContent = message.content || "";

      content.append(label, body);

      if (message.attachments?.length) {
        const files = document.createElement("div");
        files.className = "message-attachments";

        message.attachments.forEach(file => {
          const item = document.createElement("span");
          item.className = "message-attachment";
          item.textContent = file.name;
          files.appendChild(item);
        });

        content.appendChild(files);
      }

      if (message.role === "assistant" && message.content) {
        const actions = document.createElement("div");
        actions.className = "message-actions";

        const copy = document.createElement("button");
        copy.type = "button";
        copy.className = "text-button";
        copy.textContent = "Copy";
        copy.addEventListener("click", () => {
          copyText(message.content);
        });

        const speak = document.createElement("button");
        speak.type = "button";
        speak.className = "text-button";
        speak.textContent = "Read aloud";
        speak.addEventListener("click", () => {
          speakText(message.content);
        });

        actions.append(copy, speak);
        content.appendChild(actions);
      }

      wrapper.append(avatar, content);
      container.appendChild(wrapper);
    });

    container.scrollTop = container.scrollHeight;
  }

  function bindSuggestionButtons() {
    $$("[data-prompt]").forEach(button => {
      button.addEventListener("click", () => {
        const input = byId("brainInput");
        if (!input) return;

        input.value = button.dataset.prompt;
        input.focus();
        autoResizeTextarea(input);
      });
    });
  }

  function addMessage(role, content, attachments = []) {
    state.messages.push({
      id: makeId(),
      role,
      content,
      attachments: attachments.map(file => ({
        name: file.name,
        type: file.type
      })),
      createdAt: new Date().toISOString()
    });

    saveActiveConversation();
    renderMessages();
  }

  function autoResizeTextarea(textarea) {
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height =
      Math.min(textarea.scrollHeight, 220) + "px";
  }

  function getConversationForAPI() {
    return state.messages
      .slice(-20)
      .map(message => ({
        role: message.role,
        content: message.content
      }));
  }

  async function sendBrainMessage(message) {
    if (state.isSending) return;

    const text = String(message || "").trim();

    if (!text && !state.attachments.length) {
      showToast("Write a message or attach a file first.", "warning");
      return;
    }

    const attachments = [...state.attachments];

    state.isSending = true;

    const sendButton = byId("sendBrainButton");
    if (sendButton) sendButton.disabled = true;

    addMessage(
      "user",
      text || "Please examine the attached file.",
      attachments
    );

    state.attachments = [];
    renderAttachments();

    const input = byId("brainInput");
    if (input) {
      input.value = "";
      autoResizeTextarea(input);
    }

    setGlobalLoading(
      true,
      "Joseph AI is thinking...",
      "Preparing your response."
    );

    setStatus("connectionText", "Working");

    try {
      const encodedAttachments = [];

      for (const file of attachments) {
        encodedAttachments.push({
          name: file.name,
          type: file.type,
          data: await readFileAsDataURL(file)
        });
      }

      const data = await requestJSON(CONFIG.api.chat, {
        method: "POST",
        body: JSON.stringify({
          message: text,
          conversation: getConversationForAPI(),
          attachments: encodedAttachments,
          settings: {
            webSearch: getSettings().webSearch !== false,
            model: getSettings().defaultModel || "auto"
          }
        })
      });

      const reply =
        data.reply ||
        data.response ||
        data.message ||
        data.text;

      if (!reply || typeof reply !== "string") {
        throw new Error(
          "The AI service returned no readable response."
        );
      }

      addMessage("assistant", reply);
      recordActivity("Conversation response received", "chat");

      if (getSettings().speakResponses) {
        speakText(reply);
      }

      setStatus("connectionText", "Ready");
    } catch (error) {
      addMessage(
        "assistant",
        `I couldn't complete that request. ${error.message}\n\nPlease check that the chat backend is deployed and configured.`
      );

      setStatus("connectionText", "Connection issue");
      showToast(error.message, "error");
    } finally {
      state.isSending = false;
      if (sendButton) sendButton.disabled = false;

      setGlobalLoading(false);
    }
  }

  function setupBrain() {
    byId("brainForm")?.addEventListener("submit", event => {
      event.preventDefault();
      sendBrainMessage(byId("brainInput")?.value || "");
    });

    const input = byId("brainInput");

    input?.addEventListener("input", () => {
      autoResizeTextarea(input);
    });

    input?.addEventListener("keydown", event => {
      if (
        event.key === "Enter" &&
        !event.shiftKey &&
        !event.isComposing
      ) {
        event.preventDefault();
        byId("brainForm")?.requestSubmit();
      }
    });

    byId("attachFileButton")?.addEventListener("click", () => {
      byId("brainFileInput")?.click();
    });

    byId("brainImageButton")?.addEventListener("click", () => {
      byId("brainImageInput")?.click();
    });

    byId("brainFileInput")?.addEventListener("change", event => {
      addAttachments(event.target.files);
      event.target.value = "";
    });

    byId("brainImageInput")?.addEventListener("change", event => {
      addAttachments(event.target.files);
      event.target.value = "";
    });

    byId("clearAttachments")?.addEventListener("click", () => {
      state.attachments = [];
      renderAttachments();
    });

    byId("stopSpeakingButton")?.addEventListener("click", stopSpeaking);

    bindSuggestionButtons();
  }

  /* =======================================================
     ATTACHMENTS
     ======================================================= */

  function addAttachments(fileList) {
    const files = Array.from(fileList || []);

    if (!files.length) return;

    for (const file of files) {
      if (state.attachments.length >= CONFIG.maxAttachments) {
        showToast(
          `You can attach up to ${CONFIG.maxAttachments} files at a time.`,
          "warning"
        );
        break;
      }

      if (file.size > CONFIG.maxAttachmentSize) {
        showToast(
          `${file.name} is too large. Maximum size is 8 MB per file.`,
          "warning"
        );
        continue;
      }

      const alreadyAdded = state.attachments.some(
        item =>
          item.name === file.name &&
          item.size === file.size
      );

      if (!alreadyAdded) state.attachments.push(file);
    }

    renderAttachments();
  }

  function renderAttachments() {
    const preview = byId("attachmentPreview");
    const list = byId("attachmentList");

    if (!preview || !list) return;

    list.innerHTML = "";

    if (!state.attachments.length) {
      preview.hidden = true;
      return;
    }

    preview.hidden = false;

    state.attachments.forEach(file => {
      const item = document.createElement("div");
      item.className = "attachment-item";

      const name = document.createElement("span");
      name.textContent = file.name;

      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `Remove ${file.name}`);

      remove.addEventListener("click", () => {
        state.attachments = state.attachments.filter(
          item => item !== file
        );
        renderAttachments();
      });

      item.append(name, remove);
      list.appendChild(item);
    });
  }

  
  /* =======================================================
     COPY AND SPEECH
     ======================================================= */

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(String(text || ""));
      showToast("Copied to clipboard.");
    } catch {
      const temporary = document.createElement("textarea");
      temporary.value = String(text || "");
      document.body.appendChild(temporary);
      temporary.select();

      try {
        document.execCommand("copy");
        showToast("Copied to clipboard.");
      } catch {
        showToast("Could not copy this text.", "error");
      }

      temporary.remove();
    }
  }

  function speakText(text) {
    if (!("speechSynthesis" in window)) {
      showToast(
        "Speech playback is not supported by this browser.",
        "warning"
      );
      return;
    }

    stopSpeaking();

    const utterance = new SpeechSynthesisUtterance(
      String(text || "")
    );

    utterance.lang = state.speechLanguage;
    utterance.rate = 1;
    utterance.pitch = 1;

    utterance.onstart = () => {
      const button = byId("stopSpeakingButton");
      if (button) button.hidden = false;
    };

    utterance.onend = () => {
      const button = byId("stopSpeakingButton");
      if (button) button.hidden = true;
    };

    utterance.onerror = () => {
      const button = byId("stopSpeakingButton");
      if (button) button.hidden = true;
    };

    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    const button = byId("stopSpeakingButton");
    if (button) button.hidden = true;
  }

  /* =======================================================
     VOICE CONVERSATION
     ======================================================= */

  function setVoiceState(title, description, status) {
    setStatus("voiceStateTitle", title);
    setStatus("voiceStateDescription", description);
    setStatus("voiceStatus", status);
  }

  function appendVoiceTranscript(label, text) {
    const container = byId("voiceTranscript");
    if (!container) return;

    if (container.querySelector(".muted-text")) {
      container.innerHTML = "";
    }

    const line = document.createElement("p");
    line.textContent = `${label}: ${text}`;

    container.appendChild(line);
    container.scrollTop = container.scrollHeight;
  }

  function startVoiceRecognition() {
    const Recognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!Recognition) {
      showToast(
        "Voice recognition is not supported in this browser. Try a supported browser or type your message.",
        "warning"
      );

      setVoiceState(
        "Voice not available",
        "Your browser does not support speech recognition.",
        "Unavailable"
      );

      return;
    }

    if (state.recognition) {
      try {
        state.recognition.stop();
      } catch {}
    }

    const recognition = new Recognition();

    recognition.lang =
      byId("voiceLanguage")?.value || "en-US";

    recognition.continuous = false;
    recognition.interimResults = true;

    state.recognition = recognition;
    state.isListening = true;

    setVoiceState(
      "I'm listening...",
      "Speak clearly. Your words will appear in the transcript.",
      "Listening"
    );

    byId("voiceOrb")?.classList.add("listening");

    recognition.onresult = event => {
      let finalText = "";
      let interimText = "";

      for (
        let index = event.resultIndex;
        index < event.results.length;
        index++
      ) {
        const result = event.results[index];

        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }

      if (interimText) {
        setVoiceState(
          "I'm listening...",
          interimText,
          "Listening"
        );
      }

      if (finalText.trim()) {
        appendVoiceTranscript("You", finalText.trim());

        setVoiceState(
          "Processing your message...",
          "Joseph AI is preparing a response.",
          "Processing"
        );

        sendVoiceMessage(finalText.trim());
      }
    };

    recognition.onerror = event => {
      state.isListening = false;
      byId("voiceOrb")?.classList.remove("listening");

      setVoiceState(
        "Voice problem",
        `Speech recognition error: ${event.error}`,
        "Error"
      );
    };

    recognition.onend = () => {
      state.isListening = false;
      byId("voiceOrb")?.classList.remove("listening");

      if (byId("voiceStatus")?.textContent === "Listening") {
        setVoiceState(
          "Ready to speak",
          "Press the microphone to start again.",
          "Ready"
        );
      }
    };

    try {
      recognition.start();
    } catch (error) {
      state.isListening = false;
      showToast("Could not start the microphone.", "error");
    }
  }

  function stopVoiceRecognition() {
    if (state.recognition) {
      try {
        state.recognition.stop();
      } catch {}
    }

    state.isListening = false;
    byId("voiceOrb")?.classList.remove("listening");

    setVoiceState(
      "Voice stopped",
      "Press Start speaking when you are ready.",
      "Stopped"
    );
  }

  async function sendVoiceMessage(text) {
    appendVoiceTranscript("You", text);

    await sendBrainMessage(text);

    const lastAssistantMessage = [...state.messages]
      .reverse()
      .find(message => message.role === "assistant");

    if (lastAssistantMessage) {
      appendVoiceTranscript(
        "Joseph AI",
        lastAssistantMessage.content
      );

      const autoSpeak = byId("voiceAutoSpeak")?.checked;

      if (autoSpeak) {
        speakText(lastAssistantMessage.content);
      }

      setVoiceState(
        "Response ready",
        "You can continue speaking whenever you are ready.",
        "Ready"
      );
    }
  }

  function setupVoice() {
    byId("voiceStartButton")?.addEventListener(
      "click",
      startVoiceRecognition
    );

    byId("voiceStopButton")?.addEventListener(
      "click",
      stopVoiceRecognition
    );

    byId("brainVoiceButton")?.addEventListener("click", () => {
      openPage("voice");
      startVoiceRecognition();
    });

    byId("voiceLanguage")?.addEventListener("change", event => {
      state.speechLanguage = event.target.value;
    });
  }

  
  /* =======================================================
     RESEARCH
     ======================================================= */

  async function handleResearch(event) {
    event.preventDefault();

    const query = byId("researchQuery")?.value.trim();

    if (!query) {
      showToast("Enter something to research.", "warning");
      return;
    }

    const button = byId("researchButton");
    setButtonLoading(button, true, "Researching...");
    setStatus("connectionText", "Researching");

    const result = byId("researchResult");

    if (result) {
      result.innerHTML = `
        <div class="empty-state">
          <h3>Research in progress...</h3>
          <p>Waiting for the research service.</p>
        </div>
      `;
    }

    try {
      const data = await requestJSON(CONFIG.api.chat, {
        method: "POST",
        body: JSON.stringify({
          message: query,
          conversation: [],
          research: true,
          researchOptions: {
            depth: byId("researchDepth")?.value || "detailed",
            type: byId("researchType")?.value || "general"
          },
          settings: {
            webSearch: true
          }
        })
      });

      const answer =
        data.reply ||
        data.response ||
        data.message ||
        data.text;

      if (!answer) {
        throw new Error("The research service returned no results.");
      }

      renderResearchResult(answer, data.sources || []);
      recordActivity(`Research: ${query}`, "research");

      setStatus("connectionText", "Ready");
    } catch (error) {
      renderResearchResult(
        `Research could not be completed. ${error.message}`,
        []
      );

      showToast(error.message, "error");
    } finally {
      setButtonLoading(button, false);
    }
  }

  function renderResearchResult(answer, sources) {
    const result = byId("researchResult");
    if (!result) return;

    result.innerHTML = "";

    const content = document.createElement("div");
    content.className = "research-answer";
    content.textContent = answer;

    result.appendChild(content);

    if (sources.length) {
      const heading = document.createElement("h3");
      heading.textContent = "Sources";
      result.appendChild(heading);

      sources.forEach(source => {
        const link = document.createElement("a");
        link.className = "research-source";
        link.textContent =
          source.title || source.url || "Open source";

        try {
          const url = new URL(source.url);

          if (url.protocol === "https:" || url.protocol === "http:") {
            link.href = url.href;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
          }
        } catch {}

        result.appendChild(link);
      });
    }
  }

  function setupResearch() {
    byId("researchForm")?.addEventListener(
      "submit",
      handleResearch
    );
  }

  /* =======================================================
     IMAGE STUDIO
     ======================================================= */

  let imageReferences = [];

  function setupImageStudio() {
    byId("imageUploadButton")?.addEventListener("click", () => {
      byId("imageReferenceInput")?.click();
    });

    byId("imageReferenceInput")?.addEventListener(
      "change",
      event => {
        imageReferences = Array.from(event.target.files || [])
          .filter(file => file.type.startsWith("image/"));

        renderImageReferences();
      }
    );

    byId("imageForm")?.addEventListener(
      "submit",
      handleImageGeneration
    );

    byId("downloadImageButton")?.addEventListener("click", () => {
      if (!state.currentImage) return;

      const link = document.createElement("a");
      link.href = state.currentImage;
      link.download = "joseph-ai-image.png";
      link.click();
    });

    byId("saveImageButton")?.addEventListener("click", saveImageProject);
  }

  function renderImageReferences() {
    const container = byId("imageReferencePreview");
    if (!container) return;

    container.innerHTML = "";

    imageReferences.forEach(file => {
      const image = document.createElement("img");
      image.alt = file.name;
      image.title = file.name;

      const reader = new FileReader();
      reader.onload = () => {
        image.src = reader.result;
      };
      reader.readAsDataURL(file);

      container.appendChild(image);
    });
  }

  async function handleImageGeneration(event) {
    event.preventDefault();

    const prompt = byId("imagePrompt")?.value.trim();

    if (!prompt) {
      showToast("Describe the image you want first.", "warning");
      return;
    }

    const mode = byId("imageMode")?.value || "generate";

    if (mode !== "generate" && !imageReferences.length) {
      showToast(
        "Upload a reference image for this image workflow.",
        "warning"
      );
      return;
    }

    const button = byId("generateImageButton");

    setButtonLoading(button, true, "Creating...");
    setStatus("imageStatus", "Working");
    setFeedback("imageFeedback", "Sending your request to the image service.");

    setGlobalLoading(
      true,
      "Image Studio",
      "Processing your image request."
    );

    try {
      const references = [];

      for (const file of imageReferences) {
        references.push({
          name: file.name,
          type: file.type,
          data: await readFileAsDataURL(file)
        });
      }

      const data = await requestJSON(CONFIG.api.image, {
        method: "POST",
        body: JSON.stringify({
          prompt,
          mode,
          style: byId("imageStyle")?.value,
          aspect: byId("imageAspect")?.value,
          model: byId("imageModel")?.value,
          references
        })
      });

      const imageUrl =
        data.imageUrl ||
        data.image ||
        data.url;

      if (!imageUrl) {
        throw new Error(
          "The image service did not return an image."
        );
      }

      state.currentImage = imageUrl;

      const output = byId("imageOutput");
      if (output) {
        output.innerHTML = "";

        const image = document.createElement("img");
        image.src = imageUrl;
        image.alt = "Joseph AI generated image";
        image.className = "generated-image";

        output.appendChild(image);
      }

      byId("downloadImageButton").disabled = false;
      byId("saveImageButton").disabled = false;

      setStatus("imageStatus", "Complete");
      setFeedback("imageFeedback", "Image received successfully.");

      recordActivity("Created an image", "image");
    } catch (error) {
      setStatus("imageStatus", "Unavailable");
      setFeedback("imageFeedback", error.message);
      showToast(error.message, "error");
    } finally {
      setButtonLoading(button, false);
      setGlobalLoading(false);
    }
  }

  function saveImageProject() {
    if (!state.currentImage) return;

    const project = {
      id: makeId(),
      type: "image",
      title: "Generated image",
      imageUrl: state.currentImage,
      createdAt: new Date().toISOString()
    };

    state.projects.unshift(project);
    saveProjects();

    showToast("Image project saved locally.");
  }

   /* =======================================================
     VIDEO STUDIO
     ======================================================= */

  function setupVideoStudio() {
    byId("videoUploadButton")?.addEventListener("click", () => {
      byId("videoReferenceInput")?.click();
    });

    byId("videoForm")?.addEventListener(
      "submit",
      handleVideoRequest
    );
  }

  async function handleVideoRequest(event) {
    event.preventDefault();

    const prompt = byId("videoPrompt")?.value.trim();

    if (!prompt) {
      showToast("Describe the video you want.", "warning");
      return;
    }

    const mode = byId("videoMode")?.value || "script";
    const button = byId("generateVideoButton");

    setButtonLoading(button, true, "Preparing...");
    setStatus("videoStatus", "Working");

    try {
      let reference = null;
      const file = byId("videoReferenceInput")?.files?.[0];

      if (file) {
        if (file.size > CONFIG.maxAttachmentSize) {
          throw new Error("The reference image must be under 8 MB.");
        }

        reference = {
          name: file.name,
          type: file.type,
          data: await readFileAsDataURL(file)
        };
      }

      const data = await requestJSON(CONFIG.api.video, {
        method: "POST",
        body: JSON.stringify({
          prompt,
          mode,
          duration: byId("videoLength")?.value,
          aspect: byId("videoAspect")?.value,
          reference
        })
      });

      renderVideoResult(data, mode);

      state.currentVideo = data;
      setStatus("videoStatus", "Complete");

      recordActivity(`Created video project: ${mode}`, "video");
    } catch (error) {
      setStatus("videoStatus", "Unavailable");
      setFeedback("videoFeedback", error.message);
      showToast(error.message, "error");
    } finally {
      setButtonLoading(button, false);
    }
  }

  function renderVideoResult(data, mode) {
    const output = byId("videoOutput");
    const sceneList = byId("videoSceneList");

    if (!output) return;

    output.innerHTML = "";

    if (data.videoUrl) {
      const video = document.createElement("video");
      video.controls = true;
      video.src = data.videoUrl;
      video.className = "generated-video";
      output.appendChild(video);
    } else {
      const resultText =
        data.script ||
        data.storyboard ||
        data.result ||
        data.text ||
        data.message;

      if (!resultText) {
        output.textContent =
          "The service returned no video plan.";
        return;
      }

      const result = document.createElement("pre");
      result.className = "video-plan-result";
      result.textContent = resultText;

      output.appendChild(result);
    }

    if (sceneList) {
      sceneList.innerHTML = "";

      (data.scenes || []).forEach((scene, index) => {
        const item = document.createElement("div");
        item.className = "scene-item";

        const heading = document.createElement("strong");
        heading.textContent =
          scene.title || `Scene ${index + 1}`;

        const description = document.createElement("p");
        description.textContent =
          scene.description || scene.prompt || "";

        item.append(heading, description);
        sceneList.appendChild(item);
      });
    }

    setFeedback(
      "videoFeedback",
      data.videoUrl
        ? "Video received from the connected provider."
        : `Your ${mode} result is ready. This is not a rendered video file.`
    );
  }

    /* =======================================================
     WEBSITE BUILDER
     ======================================================= */

  function setupWebsiteBuilder() {
    byId("websiteForm")?.addEventListener(
      "submit",
      handleWebsiteGeneration
    );

    byId("desktopPreviewButton")?.addEventListener("click", () => {
      setPreviewDevice("desktop");
    });

    byId("mobilePreviewButton")?.addEventListener("click", () => {
      setPreviewDevice("mobile");
    });

    byId("saveWebsiteButton")?.addEventListener(
      "click",
      saveWebsiteProject
    );

    byId("downloadWebsiteButton")?.addEventListener(
      "click",
      downloadWebsiteFiles
    );

    byId("publishWebsiteButton")?.addEventListener(
      "click",
      explainWebsitePublishing
    );

    byId("copyWebsiteCodeButton")?.addEventListener(
      "click",
      copyCurrentWebsiteCode
    );

    byId("downloadWebsiteFileButton")?.addEventListener(
      "click",
      downloadCurrentWebsiteFile
    );

    $$("[data-code-tab]").forEach(button => {
      button.addEventListener("click", () => {
        selectCodeTab(button.dataset.codeTab);
      });
    });

    renderWebsiteProjects();
  }

  async function handleWebsiteGeneration(event) {
    event.preventDefault();

    const name = byId("websiteProjectName")?.value.trim();
    const description = byId("websiteDescription")?.value.trim();

    if (!description) {
      showToast("Describe the website before generating it.", "warning");
      return;
    }

    const button = byId("generateWebsiteButton");

    setButtonLoading(button, true, "Generating website...");
    setStatus("connectionText", "Building");
    setFeedback(
      "websiteFeedback",
      "Joseph AI is preparing your website files."
    );

    setGlobalLoading(
      true,
      "Building your website",
      "Generating HTML, CSS and JavaScript."
    );

    try {
      const data = await requestJSON(CONFIG.api.website, {
        method: "POST",
        body: JSON.stringify({
          action: "generate",
          name: name || "Untitled website",
          type: byId("websiteBusinessType")?.value,
          description,
          style: byId("websiteStyle")?.value,
          palette: byId("websitePalette")?.value,
          features: byId("websiteFeatures")?.value,
          extra: byId("websiteExtra")?.value,
          size: byId("websiteSize")?.value
        })
      });

      const html = data.html || data.files?.["index.html"];
      const css = data.css || data.files?.["style.css"];
      const js = data.js || data.files?.["script.js"];

      if (!html || !css || !js) {
        throw new Error(
          "The website service must return HTML, CSS and JavaScript files."
        );
      }

      state.currentWebsite = {
        id: makeId(),
        type: "website",
        name: name || "Untitled website",
        html,
        css,
        js,
        createdAt: new Date().toISOString()
      };

      updateWebsitePreview();
      selectCodeTab("html");

      byId("saveWebsiteButton").disabled = false;
      byId("downloadWebsiteButton").disabled = false;
      byId("publishWebsiteButton").disabled = false;

      setStatus("websitePreviewStatus", "Website generated");
      setFeedback(
        "websiteFeedback",
        "Website files generated. Review the preview before using them."
      );

      setStatus("connectionText", "Ready");
      recordActivity("Generated a website", "website");
    } catch (error) {
      setFeedback("websiteFeedback", error.message);
      setStatus("websitePreviewStatus", "Generation failed");
      setStatus("connectionText", "Connection issue");

      showToast(error.message, "error");
    } finally {
      setButtonLoading(button, false);
      setGlobalLoading(false);
    }
  }

  function updateWebsitePreview() {
    if (!state.currentWebsite) return;

    const website = state.currentWebsite;
    const frame = byId("websitePreview");
    const placeholder = byId("websitePreviewPlaceholder");

    if (!frame) return;

    /*
      The generated files are placed inside a sandboxed iframe.
      Scripts and forms are allowed by the HTML sandbox setting.
      Same-origin access is deliberately not enabled.
    */

    const source = website.html.replace(
      /<\/head>/i,
      `<style>${website.css}</style></head>`
    );

    const finalSource = source.replace(
      /<\/body>/i,
      `<script>${website.js.replace(/<\/script/gi, "<\\/script>")}<\/script></body>`
    );

    frame.srcdoc = finalSource;

    if (placeholder) placeholder.hidden = true;
  }

  function setPreviewDevice(device) {
    const wrap = byId("previewFrameWrap");
    if (!wrap) return;

    wrap.classList.toggle("mobile-preview", device === "mobile");

    byId("desktopPreviewButton")?.classList.toggle(
      "active",
      device === "desktop"
    );

    byId("mobilePreviewButton")?.classList.toggle(
      "active",
      device === "mobile"
    );
  }

  function selectCodeTab(tab) {
    if (!["html", "css", "js"].includes(tab)) return;

    state.currentCodeTab = tab;

    $$("[data-code-tab]").forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.codeTab === tab
      );
    });

    const code = byId("websiteCodeOutput");

    if (!code) return;

    if (!state.currentWebsite) {
      code.textContent = "Your generated code will appear here.";
      return;
    }

    const values = {
      html: state.currentWebsite.html,
      css: state.currentWebsite.css,
      js: state.currentWebsite.js
    };

    code.textContent = values[tab] || "";
  }

  function saveWebsiteProject() {
    if (!state.currentWebsite) return;

    const existing = state.websites.find(
      item => item.id === state.currentWebsite.id
    );

    if (!existing) {
      state.websites.unshift({
        ...state.currentWebsite,
        savedAt: new Date().toISOString()
      });
    }

    const project = {
      ...state.currentWebsite,
      type: "website"
    };

    const projectExists = state.projects.some(
      item => item.id === project.id
    );

    if (!projectExists) state.projects.unshift(project);

    saveWebsites();
    saveProjects();

    showToast("Website project saved in this browser.");
    recordActivity("Saved a website project", "website");
  }

  function downloadWebsiteFiles() {
    if (!state.currentWebsite) return;

    const website = state.currentWebsite;

    downloadFile("index.html", website.html, "text/html");
    downloadFile("style.css", website.css, "text/css");
    downloadFile("script.js", website.js, "text/javascript");

    showToast("Website files downloaded separately.");
  }

  function downloadCurrentWebsiteFile() {
    if (!state.currentWebsite) {
      showToast("Generate a website first.", "warning");
      return;
    }

    const values = {
      html: {
        name: "index.html",
        content: state.currentWebsite.html,
        type: "text/html"
      },
      css: {
        name: "style.css",
        content: state.currentWebsite.css,
        type: "text/css"
      },
      js: {
        name: "script.js",
        content: state.currentWebsite.js,
        type: "text/javascript"
      }
    };

    const file = values[state.currentCodeTab];

    downloadFile(file.name, file.content, file.type);
  }

  function copyCurrentWebsiteCode() {
    if (!state.currentWebsite) {
      showToast("Generate a website first.", "warning");
      return;
    }

    const code = state.currentWebsite[state.currentCodeTab];
    copyText(code || "");
  }

  function explainWebsitePublishing() {
    if (!state.currentWebsite) return;

    showToast(
      "Your files are ready. Publishing needs a hosting account and an authorized deployment workflow.",
      "warning"
    );
  }

  function renderWebsiteProjects() {
    const container = byId("websiteProjectsList");
    if (!container) return;

    if (!state.websites.length) {
      container.innerHTML = `
        <div class="empty-state compact-empty">
          <span>▣</span>
          <p>No saved website projects yet.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = "";

    state.websites.forEach(website => {
      const card = document.createElement("article");
      card.className = "project-card";

      const title = document.createElement("h3");
      title.textContent = website.name;

      const date = document.createElement("p");
      date.textContent = formatDate(website.savedAt || website.createdAt);

      const load = document.createElement("button");
      load.type = "button";
      load.className = "secondary-button";
      load.textContent = "Open project";

      load.addEventListener("click", () => {
        state.currentWebsite = { ...website };

        updateWebsitePreview();
        selectCodeTab("html");

        byId("saveWebsiteButton").disabled = false;
        byId("downloadWebsiteButton").disabled = false;
        byId("publishWebsiteButton").disabled = false;

        openPage("website-builder");
        showToast("Website project loaded.");
      });

      card.append(title, date, load);
      container.appendChild(card);
    });
  }

  
  /* =======================================================
     APP BUILDER
     ======================================================= */

  function setupAppBuilder() {
    byId("appForm")?.addEventListener("submit", handleAppGeneration);

    byId("saveAppProjectButton")?.addEventListener("click", () => {
      saveGenericProject(state.currentApp, "app");
    });

    byId("downloadAppProjectButton")?.addEventListener("click", () => {
      if (!state.currentApp) return;

      downloadJSON(
        "joseph-ai-app-project.json",
        state.currentApp
      );
    });

    byId("previewAppButton")?.addEventListener("click", () => {
      const previewUrl = state.currentApp?.previewUrl;

      if (!previewUrl) {
        showToast(
          "This project does not have a preview URL yet.",
          "warning"
        );
        return;
      }

      window.open(previewUrl, "_blank", "noopener,noreferrer");
    });
  }

  async function handleAppGeneration(event) {
    event.preventDefault();

    const name = byId("appName")?.value.trim();
    const description = byId("appDescription")?.value.trim();

    if (!description) {
      showToast("Describe your application first.", "warning");
      return;
    }

    const button = byId("generateAppButton");

    setButtonLoading(button, true, "Building...");
    setStatus("appStatus", "Working");

    try {
      const data = await requestJSON(CONFIG.api.app, {
        method: "POST",
        body: JSON.stringify({
          action: "generate",
          name: name || "Untitled application",
          type: byId("appType")?.value,
          platform: byId("appPlatform")?.value,
          description,
          features: byId("appFeatures")?.value,
          backend: byId("appBackend")?.value
        })
      });

      if (!data.files && !data.project && !data.instructions) {
        throw new Error(
          "The app service returned no project files or instructions."
        );
      }

      state.currentApp = {
        id: makeId(),
        type: "app",
        name: name || "Untitled application",
        ...data,
        createdAt: new Date().toISOString()
      };

      renderAppResult(state.currentApp);

      byId("saveAppProjectButton").disabled = false;
      byId("downloadAppProjectButton").disabled = false;
      byId("previewAppButton").disabled = !data.previewUrl;

      setStatus("appStatus", "Complete");
      setFeedback(
        "appFeedback",
        "Application project received. Review its files and build requirements."
      );

      recordActivity("Created an app project", "app");
    } catch (error) {
      setStatus("appStatus", "Unavailable");
      setFeedback("appFeedback", error.message);
      showToast(error.message, "error");
    } finally {
      setButtonLoading(button, false);
    }
  }

  function renderAppResult(project) {
    const output = byId("appOutput");
    if (!output) return;

    output.innerHTML = "";

    const title = document.createElement("h3");
    title.textContent = project.name;

    const description = document.createElement("p");
    description.textContent =
      project.summary ||
      project.description ||
      "Application project generated.";

    output.append(title, description);

    if (project.instructions) {
      const instructions = document.createElement("pre");
      instructions.textContent = project.instructions;
      output.appendChild(instructions);
    }

    if (project.files) {
      const heading = document.createElement("h4");
      heading.textContent = "Project files";
      output.appendChild(heading);

      Object.keys(project.files).forEach(filename => {
        const item = document.createElement("p");
        item.textContent = filename;
        output.appendChild(item);
      });
    }

    if (project.buildInstructions) {
      const build = document.createElement("pre");
      build.textContent = project.buildInstructions;
      output.appendChild(build);
    }
  }

    /* =======================================================
     GAME BUILDER
     ======================================================= */

  function setupGameBuilder() {
    byId("gameForm")?.addEventListener("submit", handleGameGeneration);

    byId("saveGameProjectButton")?.addEventListener("click", () => {
      saveGenericProject(state.currentGame, "game");
    });

    byId("downloadGameProjectButton")?.addEventListener("click", () => {
      if (!state.currentGame) return;

      downloadJSON(
        "joseph-ai-game-project.json",
        state.currentGame
      );
    });
  }

  async function handleGameGeneration(event) {
    event.preventDefault();

    const description = byId("gameDescription")?.value.trim();

    if (!description) {
      showToast("Describe your game first.", "warning");
      return;
    }

    const button = byId("generateGameButton");

    setButtonLoading(button, true, "Creating...");
    setStatus("gameStatus", "Working");

    try {
      const data = await requestJSON(CONFIG.api.game, {
        method: "POST",
        body: JSON.stringify({
          action: "generate",
          name: byId("gameName")?.value.trim() || "Untitled game",
          genre: byId("gameGenre")?.value,
          level: byId("gameLevel")?.value,
          platform: byId("gamePlatform")?.value,
          description,
          features: byId("gameFeatures")?.value
        })
      });

      if (!data.files && !data.previewUrl && !data.instructions) {
        throw new Error(
          "The game service returned no project files or instructions."
        );
      }

      state.currentGame = {
        id: makeId(),
        type: "game",
        name: byId("gameName")?.value.trim() || "Untitled game",
        ...data,
        createdAt: new Date().toISOString()
      };

      renderGameResult(state.currentGame);

      byId("saveGameProjectButton").disabled = false;
      byId("downloadGameProjectButton").disabled = false;

      setStatus("gameStatus", "Complete");
      setFeedback("gameFeedback", "Game project received.");

      recordActivity("Created a game project", "game");
    } catch (error) {
      setStatus("gameStatus", "Unavailable");
      setFeedback("gameFeedback", error.message);
      showToast(error.message, "error");
    } finally {
      setButtonLoading(button, false);
    }
  }

  function renderGameResult(project) {
    const output = byId("gameOutput");
    if (!output) return;

    output.innerHTML = "";

    if (project.previewUrl) {
      const frame = document.createElement("iframe");
      frame.src = project.previewUrl;
      frame.title = "Game preview";
      frame.loading = "lazy";
      frame.className = "game-preview-frame";
      output.appendChild(frame);
    }

    const title = document.createElement("h3");
    title.textContent = project.name;

    const description = document.createElement("p");
    description.textContent =
      project.summary ||
      project.instructions ||
      "Your game project is ready for review.";

    output.append(title, description);

    if (project.files) {
      const fileList = document.createElement("p");
      fileList.textContent =
        `Files created: ${Object.keys(project.files).join(", ")}`;

      output.appendChild(fileList);
    }
  }

  
  /* =======================================================
     CONTENT STUDIO
     ======================================================= */

  function setupContentStudio() {
    byId("contentForm")?.addEventListener(
      "submit",
      handleContentGeneration
    );

    byId("copyContentButton")?.addEventListener("click", () => {
      copyText(state.currentContent);
    });

    byId("downloadContentButton")?.addEventListener("click", () => {
      if (!state.currentContent) return;

      downloadFile(
        "joseph-ai-content.txt",
        state.currentContent
      );
    });

    byId("regenerateContentButton")?.addEventListener("click", () => {
      if (!state.lastContentRequest) return;

      generateContent(state.lastContentRequest);
    });

    byId("connectSocialButton")?.addEventListener("click", () => {
      showToast(
        "Social publishing needs an authorized social account integration.",
        "warning"
      );
    });

    byId("openContentCalendarButton")?.addEventListener("click", () => {
      showToast(
        "A publishing calendar will require a scheduling workflow.",
        "warning"
      );
    });
  }

  async function handleContentGeneration(event) {
    event.preventDefault();

    const subject = byId("contentSubject")?.value.trim();

    if (!subject) {
      showToast("Enter a content topic first.", "warning");
      return;
    }

    const request = {
      type: byId("contentType")?.value,
      platform: byId("contentPlatform")?.value,
      subject,
      audience: byId("contentAudience")?.value,
      tone: byId("contentTone")?.value,
      goal: byId("contentGoal")?.value,
      extra: byId("contentExtra")?.value
    };

    state.lastContentRequest = request;

    await generateContent(request);
  }

  async function generateContent(request) {
    const button = byId("generateContentButton");

    setButtonLoading(button, true, "Creating content...");
    setStatus("contentStatus", "Working");

    try {
      const data = await requestJSON(CONFIG.api.content, {
        method: "POST",
        body: JSON.stringify({
          action: "generate",
          ...request
        })
      });

      const content =
        data.content ||
        data.text ||
        data.result ||
        data.response;

      if (!content) {
        throw new Error("The content service returned no content.");
      }

      state.currentContent = content;

      const output = byId("contentOutput");

      if (output) {
        output.innerHTML = "";

        const result = document.createElement("div");
        result.className = "generated-content";
        result.textContent = content;

        output.appendChild(result);
      }

      byId("copyContentButton").disabled = false;
      byId("downloadContentButton").disabled = false;
      byId("regenerateContentButton").disabled = false;

      const item = {
        id: makeId(),
        type: "content",
        title: request.subject.slice(0, 70),
        content,
        request,
        createdAt: new Date().toISOString()
      };

      state.contentHistory.unshift(item);
      state.projects.unshift(item);

      state.contentHistory = state.contentHistory.slice(0, 100);

      safeWrite(CONFIG.storage.content, state.contentHistory);
      saveProjects();

      renderContentHistory();

      setStatus("contentStatus", "Complete");
      setFeedback("contentFeedback", "Your content is ready.");

      recordActivity("Generated content", "content");
    } catch (error) {
      setStatus("contentStatus", "Unavailable");
      setFeedback("contentFeedback", error.message);
      showToast(error.message, "error");
    } finally {
      setButtonLoading(button, false);
    }
  }

  function renderContentHistory() {
    const container = byId("contentHistoryList");
    if (!container) return;

    if (!state.contentHistory.length) {
      container.innerHTML = `
        <div class="empty-state compact-empty">
          <span>◷</span>
          <p>Your generated content will be saved here.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = "";

    state.contentHistory.forEach(item => {
      const card = document.createElement("article");
      card.className = "project-card";

      const title = document.createElement("h3");
      title.textContent = item.title || "Untitled content";

      const date = document.createElement("p");
      date.textContent = formatDate(item.createdAt);

      const open = document.createElement("button");
      open.type = "button";
      open.className = "secondary-button";
      open.textContent = "Open content";

      open.addEventListener("click", () => {
        state.currentContent = item.content;

        const output = byId("contentOutput");
        if (output) {
          output.textContent = item.content;
        }

        byId("copyContentButton").disabled = false;
        byId("downloadContentButton").disabled = false;
        byId("regenerateContentButton").disabled = false;

        openPage("content-studio");
      });

      card.append(title, date, open);
      container.appendChild(card);
    });
  }

   /* =======================================================
     REMOTE WORK
     ======================================================= */

  function setupRemoteWork() {
    byId("jobsForm")?.addEventListener("submit", handleJobSearch);

    byId("scanOpportunitiesButton")?.addEventListener("click", () => {
      openPage("remote-work");
      byId("jobsForm")?.requestSubmit();
    });

    renderApplications();
  }

  async function handleJobSearch(event) {
    event.preventDefault();

    const button = byId("findJobsButton");

    const category = byId("jobCategory")?.value || "all";
    const location = byId("jobLocation")?.value || "Nigeria";
    const keywords = byId("jobKeywords")?.value.trim() || "";

    setButtonLoading(button, true, "Searching...");
    setStatus("jobsStatus", "Searching");

    setFeedback(
      "jobsFeedback",
      "Checking the job search service for available listings."
    );

    try {
      const params = new URLSearchParams({
        category,
        location,
        keywords
      });

      const data = await requestJSON(
        `${CONFIG.api.jobs}?${params.toString()}`,
        { method: "GET" }
      );

      const jobs = Array.isArray(data.jobs)
        ? data.jobs
        : Array.isArray(data.results)
          ? data.results
          : [];

      state.lastJobResults = jobs;

      renderJobs(jobs);

      setStatus("jobsStatus", `${jobs.length} results`);

      setFeedback(
        "jobsFeedback",
        jobs.length
          ? "Review each listing and confirm its eligibility before applying."
          : "No listings were returned. Try another category or search later."
      );

      recordActivity("Searched for remote work", "jobs");
      renderAutopilotStats();
    } catch (error) {
      setStatus("jobsStatus", "Unavailable");
      setFeedback("jobsFeedback", error.message);

      renderJobs([]);
      showToast(error.message, "error");
    } finally {
      setButtonLoading(button, false);
    }
  }

  function renderJobs(jobs) {
    const container = byId("jobsResults");
    if (!container) return;

    container.innerHTML = "";

    if (!jobs.length) {
      container.innerHTML = `
        <div class="empty-state">
          <span>↗</span>
          <h3>No results to display</h3>
          <p>The search service returned no job listings.</p>
        </div>
      `;
      return;
    }

    jobs.forEach(job => {
      const card = document.createElement("article");
      card.className = "job-card";

      const title = document.createElement("h3");
      title.textContent = job.title || "Untitled opportunity";

      const company = document.createElement("p");
      company.textContent = job.company || "Company not specified";

      const details = document.createElement("p");
      details.textContent = [
        job.location,
        job.jobType,
        job.salary
      ].filter(Boolean).join(" • ");

      const description = document.createElement("p");
      description.textContent = job.description || "";

      const actions = document.createElement("div");
      actions.className = "job-actions";

      const apply = document.createElement("button");
      apply.type = "button";
      apply.className = "secondary-button";
      apply.textContent = "View original listing";

      apply.addEventListener("click", () => {
        openExternalLink(job.url || job.applyUrl);
      });

      const save = document.createElement("button");
      save.type = "button";
      save.className = "secondary-button";
      save.textContent = "Save opportunity";

      save.addEventListener("click", () => {
        saveJobApplication(job);
      });

      actions.append(apply, save);
      card.append(title, company, details, description, actions);

      container.appendChild(card);
    });
  }

  function openExternalLink(url) {
    try {
      const parsed = new URL(url);

      if (!["https:", "http:"].includes(parsed.protocol)) {
        throw new Error("Invalid link.");
      }

      window.open(parsed.href, "_blank", "noopener,noreferrer");
    } catch {
      showToast("This listing has no valid source link.", "warning");
    }
  }

  function saveJobApplication(job) {
    if (!job || (!job.url && !job.applyUrl)) {
      showToast("This listing has no original source link.", "warning");
      return;
    }

    const exists = state.applications.some(
      item => item.jobUrl === (job.url || job.applyUrl)
    );

    if (exists) {
      showToast("This opportunity is already saved.", "warning");
      return;
    }

    state.applications.unshift({
      id: makeId(),
      title: job.title || "Untitled opportunity",
      company: job.company || "",
      jobUrl: job.url || job.applyUrl,
      status: "Saved",
      createdAt: new Date().toISOString()
    });

    safeWrite(CONFIG.storage.applications, state.applications);

    renderApplications();
    renderAutopilotStats();

    showToast("Opportunity saved. You have not applied yet.");
  }

  function renderApplications() {
    const container = byId("jobApplicationsList");
    if (!container) return;

    if (!state.applications.length) {
      container.innerHTML = `
        <div class="empty-state compact-empty">
          <span>▤</span>
          <p>Your saved opportunities will appear here.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = "";

    state.applications.forEach(application => {
      const card = document.createElement("article");
      card.className = "project-card";

      const title = document.createElement("h3");
      title.textContent = application.title;

      const company = document.createElement("p");
      company.textContent = application.company || "Company not specified";

      const status = document.createElement("p");
      status.textContent = `Status: ${application.status}`;

      const open = document.createElement("button");
      open.type = "button";
      open.className = "secondary-button";
      open.textContent = "Open listing";

      open.addEventListener("click", () => {
        openExternalLink(application.jobUrl);
      });

      card.append(title, company, status, open);
      container.appendChild(card);
    });
  }

    /* =======================================================
     AUTOPILOT
     ======================================================= */

  function renderAutopilotStats() {
    const opportunityCount = byId("autopilotOpportunityCount");
    const taskCount = byId("autopilotTaskCount");
    const completedCount = byId("autopilotCompletedCount");

    if (opportunityCount) {
      opportunityCount.textContent = state.lastJobResults.length;
    }

    if (taskCount) {
      taskCount.textContent = state.applications.length;
    }

    if (completedCount) {
      completedCount.textContent = state.applications.filter(
        item => item.status === "Completed"
      ).length;
    }
  }

  /* =======================================================
     PROJECT LIBRARY
     ======================================================= */

  function saveGenericProject(project, type) {
    if (!project) {
      showToast("Create a project first.", "warning");
      return;
    }

    const exists = state.projects.some(
      item => item.id === project.id
    );

    if (!exists) {
      state.projects.unshift({
        ...project,
        type,
        savedAt: new Date().toISOString()
      });

      saveProjects();
    }

    showToast(`${type} project saved locally.`);
    recordActivity(`Saved a ${type} project`, type);
  }

  function renderProjects(filter = "all") {
    const container = byId("allProjectsList");
    if (!container) return;

    const items = filter === "all"
      ? state.projects
      : state.projects.filter(item => item.type === filter);

    if (!items.length) {
      container.innerHTML = `
        <div class="empty-state">
          <span>▣</span>
          <h3>No projects found</h3>
          <p>Create and save a project to see it here.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = "";

    items.forEach(project => {
      const card = document.createElement("article");
      card.className = "project-card";

      const title = document.createElement("h3");
      title.textContent =
        project.name ||
        project.title ||
        "Untitled project";

      const type = document.createElement("p");
      type.textContent = `Type: ${project.type || "Project"}`;

      const date = document.createElement("p");
      date.textContent = formatDate(
        project.savedAt || project.createdAt
      );

      const download = document.createElement("button");
      download.type = "button";
      download.className = "secondary-button";
      download.textContent = "Export project";

      download.addEventListener("click", () => {
        downloadJSON(
          `joseph-ai-${project.type || "project"}.json`,
          project
        );
      });

      card.append(title, type, date, download);
      container.appendChild(card);
    });
  }

  function setupProjectFilters() {
    $$("[data-project-filter]").forEach(button => {
      button.addEventListener("click", () => {
        $$("[data-project-filter]").forEach(item => {
          item.classList.toggle("active", item === button);
        });

        renderProjects(button.dataset.projectFilter);
      });
    });
  }

  /* =======================================================
     HISTORY
     ======================================================= */

  function renderHistory() {
    const container = byId("conversationHistoryList");
    if (!container) return;

    if (!state.conversations.length) {
      container.innerHTML = `
        <div class="empty-state">
          <span>◷</span>
          <h3>No conversation history yet</h3>
          <p>Your saved conversations will appear here.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = "";

    state.conversations.forEach(conversation => {
      const card = document.createElement("article");
      card.className = "history-item";

      const title = document.createElement("strong");
      title.textContent = conversation.title || "New conversation";

      const date = document.createElement("small");
      date.textContent = formatDate(conversation.updatedAt);

      const open = document.createElement("button");
      open.type = "button";
      open.className = "secondary-button";
      open.textContent = "Open";

      open.addEventListener("click", () => {
        state.activeConversationId = conversation.id;
        state.messages = conversation.messages || [];

        saveConversations();
        renderMessages();
        openPage("brain");
      });

      card.append(title, date, open);
      container.appendChild(card);
    });
  }

  function renderActivityHistory() {
    const container = byId("activityHistoryList");
    if (!container) return;

    if (!state.activity.length) {
      container.innerHTML = `
        <div class="empty-state compact-empty">
          <p>Your recent activity will appear here.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = "";

    state.activity.forEach(item => {
      const row = document.createElement("div");
      row.className = "history-item";

      const title = document.createElement("strong");
      title.textContent = item.title;

      const date = document.createElement("small");
      date.textContent = formatDate(item.createdAt);

      row.append(title, date);
      container.appendChild(row);
    });
  }

  function setupHistory() {
    byId("clearHistoryButton")?.addEventListener("click", () => {
      const confirmed = window.confirm(
        "Clear all locally saved conversations? This cannot be undone."
      );

      if (!confirmed) return;

      state.conversations = [];
      state.messages = [];
      state.activeConversationId = null;

      safeWrite(CONFIG.storage.conversations, []);
      safeWrite(CONFIG.storage.activeConversation, null);

      createConversation(false);
      renderHistory();

      showToast("Conversation history cleared.");
    });
  }

  
  /* =======================================================
     MEMORY
     ======================================================= */

  function renderMemory() {
    const container = byId("memoryList");
    if (!container) return;

    if (!state.memory.length) {
      container.innerHTML = `
        <div class="empty-state compact-empty">
          <span>◈</span>
          <p>No saved memory items yet.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = "";

    state.memory.forEach(item => {
      const row = document.createElement("div");
      row.className = "memory-item";

      const text = document.createElement("p");
      text.textContent = item.text;

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "text-button";
      remove.textContent = "Delete";

      remove.addEventListener("click", () => {
        state.memory = state.memory.filter(
          memory => memory.id !== item.id
        );

        safeWrite(CONFIG.storage.memory, state.memory);
        renderMemory();
      });

      row.append(text, remove);
      container.appendChild(row);
    });
  }

  function setupMemory() {
    byId("memoryForm")?.addEventListener("submit", event => {
      event.preventDefault();

      const input = byId("memoryInput");
      const text = input?.value.trim();

      if (!text) {
        showToast("Enter something to save.", "warning");
        return;
      }

      if (byId("memoryEnabled")?.checked === false) {
        showToast("Enable memory before saving an item.", "warning");
        return;
      }

      state.memory.unshift({
        id: makeId(),
        text,
        createdAt: new Date().toISOString()
      });

      safeWrite(CONFIG.storage.memory, state.memory);

      input.value = "";
      renderMemory();

      showToast("Memory saved in this browser.");
    });

    byId("memoryEnabled")?.addEventListener("change", event => {
      setStatus(
        "memoryStatus",
        event.target.checked ? "Enabled locally" : "Disabled"
      );
    });
  }

    /* =======================================================
     SETTINGS AND THEME
     ======================================================= */

  function getSettings() {
    return safeRead(CONFIG.storage.settings, {
      theme: "dark",
      compact: false,
      defaultModel: "auto",
      webSearch: true,
      speakResponses: false,
      voiceLanguage: "en-US"
    });
  }

  function applySettings(settings) {
    const theme = settings.theme || "dark";

    document.documentElement.dataset.theme =
      theme === "system"
        ? (
            window.matchMedia("(prefers-color-scheme: light)").matches
              ? "light"
              : "dark"
          )
        : theme;

    state.compactMode = Boolean(settings.compact);

    document.body.classList.toggle(
      "compact-mode",
      state.compactMode
    );

    if (byId("appearanceSetting")) {
      byId("appearanceSetting").value = theme;
    }

    if (byId("compactModeSetting")) {
      byId("compactModeSetting").checked = state.compactMode;
    }

    if (byId("defaultModelSetting")) {
      byId("defaultModelSetting").value =
        settings.defaultModel || "auto";
    }

    if (byId("webSearchSetting")) {
      byId("webSearchSetting").checked =
        settings.webSearch !== false;
    }

    if (byId("speakResponsesSetting")) {
      byId("speakResponsesSetting").checked =
        Boolean(settings.speakResponses);
    }

    if (byId("voiceLanguageSetting")) {
      byId("voiceLanguageSetting").value =
        settings.voiceLanguage || "en-US";
    }

    if (byId("voiceLanguage")) {
      byId("voiceLanguage").value =
        settings.voiceLanguage || "en-US";
    }

    state.speechLanguage = settings.voiceLanguage || "en-US";
  }

  function updateSettings() {
    const settings = {
      theme: byId("appearanceSetting")?.value || "dark",
      compact: byId("compactModeSetting")?.checked || false,
      defaultModel: byId("defaultModelSetting")?.value || "auto",
      webSearch: byId("webSearchSetting")?.checked !== false,
      speakResponses:
        byId("speakResponsesSetting")?.checked || false,
      voiceLanguage:
        byId("voiceLanguageSetting")?.value || "en-US"
    };

    safeWrite(CONFIG.storage.settings, settings);
    applySettings(settings);
  }

  function setupSettings() {
    [
      "appearanceSetting",
      "compactModeSetting",
      "defaultModelSetting",
      "webSearchSetting",
       "speakResponsesSetting",
      "voiceLanguageSetting"
    ].forEach(id => {
      byId(id)?.addEventListener("change", updateSettings);
    });

    byId("themeButton")?.addEventListener("click", () => {
      const current =
        document.documentElement.dataset.theme || "dark";

      const next = current === "dark" ? "light" : "dark";

      if (byId("appearanceSetting")) {
        byId("appearanceSetting").value = next;
      }

      updateSettings();
    });

    byId("profileButton")?.addEventListener("click", () => {
      openPage("settings");
    });

    byId("exportDataButton")?.addEventListener(
      "click",
      exportWorkspaceData
    );

    byId("clearLocalDataButton")?.addEventListener(
      "click",
      clearLocalWorkspaceData
    );
  }

  function exportWorkspaceData() {
    const data = {
      exportedAt: new Date().toISOString(),
      conversations: state.conversations,
      projects: state.projects,
      websites: state.websites,
      contentHistory: state.contentHistory,
      activity: state.activity,
      memory: state.memory,
      applications: state.applications,
      settings: getSettings()
    };

    downloadJSON("joseph-ai-workspace-backup.json", data);

    showToast("Workspace backup exported.");
  }

  function clearLocalWorkspaceData() {
    const confirmed = window.confirm(
      "This will delete locally stored Joseph AI conversations, projects, memory, settings and history from this browser. Export a backup first if you need one. Continue?"
    );

    if (!confirmed) return;

    Object.values(CONFIG.storage).forEach(key => {
      localStorage.removeItem(key);
    });

    stopSpeaking();
    stopVoiceRecognition();

    state.conversations = [];
    state.messages = [];
    state.projects = [];
    state.websites = [];
    state.contentHistory = [];
    state.activity = [];
    state.memory = [];
    state.applications = [];
    state.activeConversationId = null;

    state.currentWebsite = null;
    state.currentApp = null;
    state.currentGame = null;
    state.currentContent = "";

    applySettings({
      theme: "dark",
      compact: false,
      defaultModel: "auto",
      webSearch: true,
      speakResponses: false,
      voiceLanguage: "en-US"
    });

    createConversation(false);
    renderAll();

    showToast("Local workspace data cleared.");
  }

  /* =======================================================
     PUBLISHING AND INTEGRATIONS
     ======================================================= */

  function setupPublishingMessages() {
    byId("connectSocialButton")?.addEventListener("click", () => {
      showToast(
        "Social account connection is not configured yet. It needs a secure authorization integration.",
        "warning"
      );
    });

    byId("openContentCalendarButton")?.addEventListener("click", () => {
      showToast(
        "Content scheduling will be connected after the calendar and publishing backend are built.",
        "warning"
      );
    });
  }

  /* =======================================================
     STARTUP
     ======================================================= */

  function init() {
    loadData();

    setupNavigation();
    setupBrain();
    setupVoice();
    setupResearch();
    setupImageStudio();
    setupVideoStudio();
    setupWebsiteBuilder();
    setupAppBuilder();
    setupGameBuilder();
    setupContentStudio();
    setupRemoteWork();
    setupProjectFilters();
    setupHistory();
    setupMemory();
    setupSettings();
    setupPublishingMessages();

    renderAttachments();

    console.log("Joseph AI V2 frontend initialized.");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  return {
    openPage,
    sendBrainMessage,
    createConversation,
    exportWorkspaceData,
    getState: () => state
  };
})();
