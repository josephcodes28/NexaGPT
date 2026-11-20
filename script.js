(() => {
  "use strict";

  const API_URL = "/api/chat";
  const MAX_FILE_BYTES = 5 * 1024 * 1024;
  const MAX_ATTACHMENTS = 5;
  const STORAGE = {
    chats: "NEXAGPT_CONVERSATIONS_V1",
    active: "NEXAGPT_ACTIVE_CONVERSATION_V1",
    settings: "NEXAGPT_SETTINGS_V1"
  };
  const LEGACY = {
    chats: "JOSEPH_V2_CONVERSATIONS",
    active: "JOSEPH_V2_ACTIVE_CONVERSATION",
    settings: "JOSEPH_V2_SETTINGS"
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const welcomeTemplate = $("#welcomeScreen");
  const state = {
    conversations: [],
    activeId: null,
    attachments: [],
    sending: false,
    abortController: null,
    settings: { theme: "dark", provider: "auto", webSearch: true, speak: false, voiceLanguage: "en-US" },
    recognition: null,
    showingArchived: false,
    scrollPositions: {},
    viewIndex: 0,
    views: [{ panel: "chat", chatId: null }]
  };

  const els = {
    sidebar: $("#sidebar"), scrim: $("#sidebarScrim"), history: $("#conversationHistoryList"),
    count: $("#chatCount"), chat: $("#chatMessages"), scroll: $("#chatScrollArea"),
    welcome: $("#welcomeScreen"), input: $("#brainInput"), form: $("#brainForm"),
    send: $("#sendBrainButton"), typing: $("#typingIndicator"), status: $("#connectionText"),
    dot: $("#connectionDot"), attach: $("#brainFileInput"), image: $("#brainImageInput"),
    attachments: $("#attachmentPreview"), attachmentList: $("#attachmentList"),
    toast: $("#toast"), workspace: $("#workspaceView"), chatView: $("#chatView"),
    panelTitle: $("#panelTitle"), panelDescription: $("#panelDescription"),
    panelEyebrow: $("#panelEyebrow"), panelContent: $("#panelContent")
  };

  function safeParse(value, fallback) {
    try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
  }
  function loadState() {
    const savedChats = localStorage.getItem(STORAGE.chats) || localStorage.getItem(LEGACY.chats);
    const chats = safeParse(savedChats, []);
    state.conversations = Array.isArray(chats) ? chats.map(chat => ({
      ...chat,
      pinned: !!chat.pinned,
      archived: !!chat.archived
    })) : [];
    state.activeId = localStorage.getItem(STORAGE.active) || localStorage.getItem(LEGACY.active) || null;
    const settings = safeParse(localStorage.getItem(STORAGE.settings) || localStorage.getItem(LEGACY.settings), {});
    state.settings = { ...state.settings, ...(settings && typeof settings === "object" ? settings : {}) };
    if (!state.activeId || !state.conversations.some(c => c.id === state.activeId)) state.activeId = null;
    if (state.conversations.length && !state.activeId) state.activeId = state.conversations[0].id;
    persist();
  }
  function persist() {
    localStorage.setItem(STORAGE.chats, JSON.stringify(state.conversations));
    localStorage.setItem(STORAGE.active, state.activeId || "");
    localStorage.setItem(STORAGE.settings, JSON.stringify(state.settings));
  }
  function id() { return "chat_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function activeChat() { return state.conversations.find(c => c.id === state.activeId) || null; }
  function toast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => els.toast.classList.remove("show"), 2600);
  }
  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
  }
  function newChat() {
    state.activeId = null;
    navigate({ panel: "chat", chatId: null });
    els.workspace.hidden = true; els.chatView.hidden = false;
    document.querySelectorAll(".nav-item[data-panel]").forEach(button => button.classList.toggle("active", button.dataset.panel === "chat"));
    state.attachments = [];
    render();
    renderAttachments();
    closeSidebar();
    els.input.focus();
  }
  function ensureChat(firstMessage) {
    let chat = activeChat();
    if (!chat) {
      chat = { id: id(), title: (firstMessage || "New conversation").trim().slice(0, 48), updatedAt: Date.now(), messages: [] };
      state.conversations.unshift(chat);
      state.activeId = chat.id;
    }
    return chat;
  }
  function renderHistory(filter = "") {
    const query = filter.trim().toLowerCase();
    const visible = state.conversations.filter(chat => !!chat.archived === state.showingArchived);
    const chats = visible.filter(chat => !query || (chat.title || "").toLowerCase().includes(query) || (chat.messages || []).some(m => String(m.content || "").toLowerCase().includes(query)));
    els.history.replaceChildren();
    $("#chatCount").textContent = String(visible.length);
    $("#toggleArchivedButton").classList.toggle("selected", state.showingArchived);
    $("#toggleArchivedButton").querySelector("span").textContent = state.showingArchived ? "Back to conversations" : "Archived chats";
    if (!chats.length) {
      const p = document.createElement("p");
      p.className = "muted small history-empty";
      p.textContent = query ? "No matching conversations." : state.showingArchived ? "No archived conversations." : "Your chats will appear here.";
      els.history.append(p);
      return;
    }
    chats.sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || (b.updatedAt || 0) - (a.updatedAt || 0));
    chats.slice(0, 100).forEach(chat => {
      const row = document.createElement("div");
      row.className = "history-row" + (chat.id === state.activeId ? " active" : "");
      const open = document.createElement("button");
      open.className = "history-item" + (chat.id === state.activeId ? " active" : "");
      open.type = "button";
      const label = document.createElement("span");
      label.textContent = (chat.pinned ? "📌 " : "") + (chat.title || "New conversation");
      open.append(label);
      open.addEventListener("click", () => {
        if (state.activeId) state.scrollPositions[state.activeId] = els.scroll.scrollTop;
        state.activeId = chat.id;
        state.scrollPositions[chat.id] ??= 0;
        navigate({ panel: "chat", chatId: chat.id });
        showChat(false); persist(); render(); closeSidebar();
      });
      const menuButton = document.createElement("button");
      menuButton.className = "history-menu-button";
      menuButton.type = "button";
      menuButton.setAttribute("aria-label", "Conversation actions");
      menuButton.title = "Conversation actions";
      menuButton.textContent = "⋯";
      menuButton.addEventListener("click", event => {
        event.stopPropagation();
        document.querySelectorAll(".history-actions.open").forEach(menu => menu.classList.remove("open"));
        const menu = row.querySelector(".history-actions");
        menu.classList.toggle("open");
      });
      const actions = document.createElement("div");
      actions.className = "history-actions";
      const addAction = (labelText, action, danger = false) => {
        const button = document.createElement("button");
        button.type = "button"; button.textContent = labelText;
        if (danger) button.className = "danger-action";
        button.addEventListener("click", event => {
          event.stopPropagation();
          actions.classList.remove("open");
          action(chat);
        });
        actions.append(button);
      };
      addAction(chat.pinned ? "Unpin" : "Pin", item => {
        item.pinned = !item.pinned; item.updatedAt = Date.now(); persist(); renderHistory($("#conversationSearch").value);
        toast(item.pinned ? "Conversation pinned." : "Conversation unpinned.");
      });
      addAction(chat.archived ? "Unarchive" : "Archive", item => {
        item.archived = !item.archived;
        if (item.archived && state.activeId === item.id) {
          state.activeId = null;
          navigate({ panel: "chat", chatId: null });
          showChat(false); render();
        }
        persist(); renderHistory($("#conversationSearch").value);
        toast(item.archived ? "Conversation archived." : "Conversation restored.");
      });
      addAction("Delete", item => {
        if (!confirm("Delete this conversation permanently? This cannot be undone.")) return;
        state.conversations = state.conversations.filter(c => c.id !== item.id);
        delete state.scrollPositions[item.id];
        if (state.activeId === item.id) {
          state.activeId = null;
          navigate({ panel: "chat", chatId: null });
          showChat(false); render();
        } else renderHistory($("#conversationSearch").value);
        persist(); toast("Conversation deleted.");
      }, true);
      row.append(open, menuButton, actions);
      els.history.append(row);
    });
  }
  function addMessage(role, content, extra = {}) {
    const chat = ensureChat(content);
    chat.messages.push({ role, content: String(content || ""), ...extra, createdAt: Date.now() });
    chat.updatedAt = Date.now();
    if (chat.messages.length === 1 && role === "user") chat.title = String(content).replace(/\s+/g, " ").slice(0, 48);
    persist();
    render();
  }
  function renderMessage(message) {
    const article = document.createElement("article");
    article.className = "message " + (message.role === "user" ? "user" : "assistant");
    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = message.role === "user" ? "Y" : "N";
    const body = document.createElement("div");
    body.className = "message-body";
    const role = document.createElement("div");
    role.className = "message-role";
    role.textContent = message.role === "user" ? "You" : "NexaGPT";
    const text = document.createElement("div");
    text.className = "message-text";
    text.textContent = message.content || "";
    body.append(role, text);

    if (Array.isArray(message.sources) && message.sources.length) {
      const sourceList = document.createElement("div");
      sourceList.className = "source-list";
      message.sources.slice(0, 10).forEach(source => {
        const url = typeof source === "string" ? source : (source.url || source.link || "");
        const title = typeof source === "string" ? source : (source.title || source.name || url);
        try {
          const parsed = new URL(url);
          if (!["http:", "https:"].includes(parsed.protocol)) return;
          const link = document.createElement("a");
          link.className = "source-link";
          link.href = parsed.href; link.target = "_blank"; link.rel = "noopener noreferrer";
          link.textContent = title || parsed.hostname;
          sourceList.append(link);
        } catch {}
      });
      if (sourceList.childNodes.length) body.append(sourceList);
    }

    if (message.artifact && typeof message.artifact === "object") {
      const artifact = document.createElement("div");
      artifact.className = "artifact";
      const heading = document.createElement("h3");
      heading.textContent = message.artifact.title || "Created result";
      artifact.append(heading);
      if (message.artifact.type === "content" && message.artifact.content) {
        const pre = document.createElement("pre"); pre.textContent = message.artifact.content; artifact.append(pre);
      } else if (message.artifact.files && typeof message.artifact.files === "object") {
        ["html", "css", "js"].forEach(key => {
          if (typeof message.artifact.files[key] !== "string") return;
          const details = document.createElement("details");
          const summary = document.createElement("summary"); summary.textContent = key + (key === "html" ? " — index.html" : key === "css" ? " — style.css" : " — script.js");
          const pre = document.createElement("pre"); pre.textContent = message.artifact.files[key];
          details.append(summary, pre); artifact.append(details);
        });
      }
      body.append(artifact);
    }

    if (message.role === "assistant") {
      const actions = document.createElement("div"); actions.className = "message-actions";
      const copy = document.createElement("button"); copy.textContent = "Copy";
      copy.addEventListener("click", async () => { try { await navigator.clipboard.writeText(message.content || ""); toast("Copied to clipboard."); } catch { toast("Copy is not available in this browser."); } });
      actions.append(copy);
      if ("speechSynthesis" in window) {
        const speak = document.createElement("button"); speak.textContent = "Read aloud";
        speak.addEventListener("click", () => { speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(message.content || ""); utterance.lang = state.settings.voiceLanguage; speechSynthesis.speak(utterance); });
        actions.append(speak);
      }
      body.append(actions);
    }
    article.append(avatar, body);
    return article;
  }
  function render(options = {}) {
    const previousScroll = els.scroll.scrollTop;
    const chat = activeChat();
    els.chat.replaceChildren();
    if (!chat || !chat.messages.length) {
      const welcome = welcomeTemplate.cloneNode(true);
      welcome.hidden = false;
      els.chat.append(welcome);
      welcome.querySelectorAll("[data-prompt]").forEach(button => button.addEventListener("click", () => { els.input.value = button.dataset.prompt; resizeInput(); els.input.focus(); }));
    } else {
      chat.messages.forEach(message => els.chat.append(renderMessage(message)));
    }
    renderHistory($("#conversationSearch").value);
    requestAnimationFrame(() => {
      if (options.scrollBottom) els.scroll.scrollTop = els.scroll.scrollHeight;
      else if (chat && state.scrollPositions[chat.id] !== undefined) els.scroll.scrollTop = state.scrollPositions[chat.id];
      else if (!chat) els.scroll.scrollTop = 0;
      else els.scroll.scrollTop = previousScroll;
    });
  }
  function resizeInput() {
    els.input.style.height = "auto";
    els.input.style.height = Math.min(els.input.scrollHeight, 180) + "px";
  }
  function renderAttachments() {
    els.attachmentList.replaceChildren();
    state.attachments.forEach(file => {
      const chip = document.createElement("span"); chip.className = "attachment-chip"; chip.textContent = file.name; els.attachmentList.append(chip);
    });
    els.attachments.hidden = state.attachments.length === 0;
  }
  async function addFiles(files) {
    for (const file of Array.from(files || [])) {
      if (state.attachments.length >= MAX_ATTACHMENTS) { toast("You can attach up to five files."); break; }
      if (file.size > MAX_FILE_BYTES) { toast(file.name + " is larger than 5 MB."); continue; }
      if (!file.type.startsWith("image/")) { toast("This version currently supports image attachments only."); continue; }
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file);
      }).catch(() => null);
      if (data) state.attachments.push({ name: file.name, mimeType: file.type, data });
    }
    renderAttachments();
  }
  async function sendMessage(event) {
    event?.preventDefault();
    if (state.sending) return;
    const message = els.input.value.trim();
    if (!message && !state.attachments.length) return;
    const chat = ensureChat(message || "Image conversation");
    const history = chat.messages.slice(-20).map(m => ({ role: m.role, content: m.content }));
    const outgoingAttachments = state.attachments.map(({ name, mimeType, data }) => ({ name, mimeType, data }));
    addMessage("user", message || "Please analyze the attached image.", { attachmentNames: outgoingAttachments.map(a => a.name) });
    requestAnimationFrame(() => { els.scroll.scrollTop = els.scroll.scrollHeight; });
    els.input.value = ""; resizeInput();
    state.attachments = []; renderAttachments();
    state.sending = true; els.send.disabled = true; els.typing.hidden = false;
    els.status.textContent = "Working"; els.dot.style.background = "#d5a957";
    state.abortController = new AbortController();
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          message,
          history,
          attachments: outgoingAttachments,
          provider: state.settings.provider,
          settings: { webSearch: $("#webSearchSetting").checked, speak: state.settings.speak }
        }),
        signal: state.abortController.signal
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) throw new Error(data.error || "NexaGPT could not complete the request.");
      const reply = data.reply || data.text || "The request completed, but no text response was returned.";
      const chatNow = activeChat();
      chatNow.messages.push({ role: "assistant", content: reply, sources: data.sources || [], artifact: data.artifact || null, provider: data.provider || null, createdAt: Date.now() });
      chatNow.updatedAt = Date.now(); persist(); render({ scrollBottom: true });
      if (state.settings.speak && "speechSynthesis" in window) {
        speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(reply));
      }
    } catch (error) {
      const messageText = error.name === "AbortError" ? "The request was stopped." : (error.message || "A connection error occurred.");
      addMessage("assistant", messageText);
    } finally {
      state.sending = false; state.abortController = null; els.send.disabled = false; els.typing.hidden = true;
      els.status.textContent = "Ready"; els.dot.style.background = "#52bd83";
    }
  }
  function closeSidebar() {
    els.sidebar.classList.remove("open"); els.scrim.classList.remove("show");
    if (history.state?.nexaDrawer) history.back();
  }
  function openSidebar() {
    if (els.sidebar.classList.contains("open")) return;
    els.sidebar.classList.add("open"); els.scrim.classList.add("show");
    history.pushState({ nexaDrawer: true, nexaIndex: state.viewIndex }, "", location.pathname + location.search + location.hash);
  }
  function applyView(view) {
    if (!view || view.panel === "chat") {
      state.activeId = view?.chatId || null;
      els.workspace.hidden = true; els.chatView.hidden = false;
      document.querySelectorAll(".nav-item[data-panel]").forEach(button => button.classList.toggle("active", button.dataset.panel === "chat"));
      render();
    } else {
      state.activeId = view.chatId || state.activeId;
      showPanel(view.panel, false);
    }
  }
  function navigate(view, addHistory = true) {
    const current = state.views[state.viewIndex];
    if (current && current.panel === view.panel && current.chatId === view.chatId) return;
    state.views = state.views.slice(0, state.viewIndex + 1);
    state.views.push({ ...view });
    state.viewIndex = state.views.length - 1;
    if (addHistory) {
      const nextState = { nexaIndex: state.viewIndex };
      if (history.state?.nexaDrawer) history.replaceState(nextState, "", location.pathname + location.search + location.hash);
      else history.pushState(nextState, "", location.pathname + location.search + location.hash);
    }
  }
  function showPanel(name, recordNavigation = true) {
    const panels = {
      projects: ["PROJECTS", "Projects", "Your saved work and generated project files.", "Projects created during this session will appear in chat. Persistent project storage will be connected when its API is ready."],
      media: ["MEDIA", "Images & media", "Your visual creation workspace.", "Image and video generation require connected generation services. Image understanding is available through supported AI providers."],
      tasks: ["TASKS", "Tasks & schedule", "Organize work and reminders.", "Task scheduling and calendar integrations are not connected yet. NexaGPT will not claim to create reminders until a scheduler is connected."],
      library: ["LIBRARY", "Library", "Files and resources for your work.", "Your uploaded files can be discussed in chat when file processing is connected. This workspace panel is ready for that integration."],
      tools: ["TOOLS", "Tools & apps", "Capabilities NexaGPT can route requests to.", "Currently configured engines: AI chat and internet research, website generation, and content generation. Other tools will appear when their engines are implemented."],
      memory: ["MEMORY", "Memory", "Information used to personalize future conversations.", "Conversation history is currently stored in this browser. Persistent cross-device memory is not connected in this frontend."],
      settings: ["SETTINGS", "Settings", "Control your NexaGPT experience.", ""]
    };
    const panel = panels[name]; if (!panel) return;
    if (recordNavigation) navigate({ panel: name, chatId: state.activeId });
    els.chatView.hidden = true; els.workspace.hidden = false;
    els.panelEyebrow.textContent = panel[0]; els.panelTitle.textContent = panel[1]; els.panelDescription.textContent = panel[2];
    els.panelContent.replaceChildren();
    if (name === "settings") {
      const wrapper = document.createElement("div"); wrapper.className = "panel-list";
      wrapper.innerHTML = `<label class="panel-row">Theme<br><select id="panelTheme"><option value="dark">Dark</option><option value="light">Light</option></select></label><label class="panel-row">AI provider<br><select id="panelProvider"><option value="auto">Automatic</option><option value="gemini">Gemini</option><option value="groq">Groq</option></select></label><label class="panel-row"><input type="checkbox" id="panelSpeak"> Read responses aloud</label><button class="secondary-btn" id="exportChats">Export conversations</button><button class="secondary-btn" id="clearChats">Clear conversation history</button>`;
      els.panelContent.append(wrapper);
      $("#panelTheme").value = state.settings.theme; $("#panelProvider").value = state.settings.provider; $("#panelSpeak").checked = !!state.settings.speak;
      $("#panelTheme").addEventListener("change", e => { state.settings.theme = e.target.value; applyTheme(); persist(); });
      $("#panelProvider").addEventListener("change", e => { state.settings.provider = e.target.value; persist(); toast("Provider preference saved."); });
      $("#panelSpeak").addEventListener("change", e => { state.settings.speak = e.target.checked; persist(); });
      $("#exportChats").addEventListener("click", exportChats);
      $("#clearChats").addEventListener("click", () => { if (confirm("Clear all conversations stored in this browser?")) { state.conversations = []; state.activeId = null; persist(); renderHistory(); showPanel("settings"); toast("Conversation history cleared."); } });
    } else {
      const p = document.createElement("p"); p.className = "muted"; p.textContent = panel[3]; els.panelContent.append(p);
      if (name === "projects") {
        const note = document.createElement("div"); note.className = "panel-row"; note.innerHTML = "<b>Build from chat</b><small>Try: “Create a professional website for my business.”</small>"; els.panelContent.append(note);
      }
    }
    document.querySelectorAll(".nav-item[data-panel]").forEach(button => button.classList.toggle("active", button.dataset.panel === name));
    closeSidebar();
  }
  function showChat(recordNavigation = true) {
    if (recordNavigation) navigate({ panel: "chat", chatId: state.activeId });
    els.workspace.hidden = true; els.chatView.hidden = false;
    document.querySelectorAll(".nav-item[data-panel]").forEach(button => button.classList.toggle("active", button.dataset.panel === "chat"));
    closeSidebar();
  }
  function exportChats() {
    const blob = new Blob([JSON.stringify(state.conversations, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "nexagpt-conversations.json"; a.click(); URL.revokeObjectURL(url);
  }
  function applyTheme() {
    document.documentElement.dataset.theme = state.settings.theme === "light" ? "light" : "dark";
    document.querySelector('meta[name="theme-color"]').content = state.settings.theme === "light" ? "#f7f8fb" : "#101116";
  }
  function setupVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const button = $("#brainVoiceButton");
    if (!SpeechRecognition) { button.addEventListener("click", () => toast("Voice input is not supported by this browser.")); return; }
    button.addEventListener("click", () => {
      if (state.recognition) { state.recognition.stop(); state.recognition = null; return; }
      const recognition = new SpeechRecognition(); recognition.lang = state.settings.voiceLanguage; recognition.interimResults = false;
      recognition.onresult = event => { els.input.value = (els.input.value + " " + event.results[0][0].transcript).trim(); resizeInput(); els.input.focus(); };
      recognition.onerror = () => toast("Voice input could not start.");
      recognition.onend = () => { state.recognition = null; };
      state.recognition = recognition; recognition.start();
    });
  }

  $("#newChatButton").addEventListener("click", newChat);
  $("#brandHome").addEventListener("click", event => { event.preventDefault(); showChat(); newChat(); });
  $("#openSidebar").addEventListener("click", openSidebar);
  els.scroll.addEventListener("scroll", () => { if (state.activeId) state.scrollPositions[state.activeId] = els.scroll.scrollTop; }, { passive: true });
  $("#closeSidebar").addEventListener("click", closeSidebar);
  els.scrim.addEventListener("click", closeSidebar);
  $("#backToChat").addEventListener("click", showChat);
  $("#toggleArchivedButton").addEventListener("click", () => { state.showingArchived = !state.showingArchived; renderHistory($("#conversationSearch").value); });
  document.querySelectorAll(".nav-item[data-panel]").forEach(button => button.addEventListener("click", () => button.dataset.panel === "chat" ? showChat() : showPanel(button.dataset.panel)));
  $("#conversationSearch").addEventListener("input", e => renderHistory(e.target.value));
  $("#themeButton").addEventListener("click", () => { state.settings.theme = state.settings.theme === "light" ? "dark" : "light"; applyTheme(); persist(); });
  $("#modelSelector").addEventListener("click", () => { showPanel("settings"); });
  $("#attachFileButton").addEventListener("click", () => els.attach.click());
  $("#brainImageButton").addEventListener("click", () => els.image.click());
  els.attach.addEventListener("change", e => addFiles(e.target.files));
  els.image.addEventListener("change", e => addFiles(e.target.files));
  $("#clearAttachmentsButton").addEventListener("click", () => { state.attachments = []; renderAttachments(); });
  $("#brainForm").addEventListener("submit", sendMessage);
  els.input.addEventListener("input", resizeInput);
  els.input.addEventListener("keydown", event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendMessage(); } });
  $("#stopSpeakingButton").addEventListener("click", () => { if (state.abortController) state.abortController.abort(); if ("speechSynthesis" in window) speechSynthesis.cancel(); });
  $("#webSearchSetting").checked = state.settings.webSearch !== false;
  $("#webSearchSetting").addEventListener("change", e => { state.settings.webSearch = e.target.checked; persist(); });
  // Android/browser Back restores the previous in-app screen or conversation.
  history.replaceState({ nexaIndex: 0 }, "", location.pathname + location.search + location.hash);
  window.addEventListener("popstate", event => {
    if (els.sidebar.classList.contains("open")) { closeSidebar(); return; }
    if (event.state?.nexaDrawer) { closeSidebar(); return; }
    const nextIndex = Number.isInteger(event.state?.nexaIndex) ? event.state.nexaIndex : Math.max(0, state.viewIndex - 1);
    state.viewIndex = Math.max(0, Math.min(nextIndex, state.views.length - 1));
    applyView(state.views[state.viewIndex]);
  });

  // Swipe right from the left screen edge to open the drawer; swipe left to close it.
  let touchStartX = 0, touchStartY = 0, touchTracking = false;
  document.addEventListener("touchstart", event => {
    if (!event.touches || event.touches.length !== 1) return;
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
    touchTracking = touchStartX <= 26 || els.sidebar.classList.contains("open");
  }, { passive: true });
  document.addEventListener("touchend", event => {
    if (!touchTracking || !event.changedTouches?.length) return;
    const dx = event.changedTouches[0].clientX - touchStartX;
    const dy = event.changedTouches[0].clientY - touchStartY;
    touchTracking = false;
    if (Math.abs(dx) < 65 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
    if (dx > 0 && touchStartX <= 26) openSidebar();
    else if (dx < 0 && els.sidebar.classList.contains("open")) closeSidebar();
  }, { passive: true });
  document.addEventListener("click", event => {
    if (!event.target.closest(".history-row")) document.querySelectorAll(".history-actions.open").forEach(menu => menu.classList.remove("open"));
  });

  setupVoice();
  loadState(); applyTheme(); render();
})();