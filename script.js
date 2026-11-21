(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const STORE = "nexagpt_conversations_v3";
  const OLD_STORE = "nexagpt_conversations_v2";

  function loadConversations() {
    try {
      const current = JSON.parse(localStorage.getItem(STORE) || "null");
      if (Array.isArray(current)) return current;
      const old = JSON.parse(localStorage.getItem(OLD_STORE) || "[]");
      return Array.isArray(old) ? old.map(item => ({ ...item, pinned: !!item.pinned })) : [];
    } catch {
      return [];
    }
  }

  let conversations = loadConversations();
  let activeId = conversations[0]?.id || crypto.randomUUID();
  let attachments = [];
  let busy = false;
  let navigationStack = [];
  let ignorePop = false;

  const messagesEl = $("#chatMessages");
  const input = $("#brainInput");
  const send = $("#sendBtn");
  const sidebar = $("#sidebar");
  const scrim = $("#sidebarScrim");

  function persist() {
    localStorage.setItem(STORE, JSON.stringify(conversations));
    renderHistory();
  }

  function active() {
    let conversation = conversations.find(item => item.id === activeId);
    if (!conversation) {
      conversation = { id: activeId, title: "New conversation", messages: [], updated: Date.now(), pinned: false };
      conversations.unshift(conversation);
    }
    return conversation;
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[char]));
  }

  function toast(message) {
    const element = $("#toast");
    if (!element) return;
    element.textContent = message;
    element.classList.add("show");
    setTimeout(() => element.classList.remove("show"), 2400);
  }

  function renderHistory() {
    const query = ($("#searchChats")?.value || "").toLowerCase();
    const list = $("#historyList");
    if (!list) return;

    const filtered = conversations
      .filter(item => (item.title || "New conversation").toLowerCase().includes(query))
      .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || (b.updated || 0) - (a.updated || 0))
      .slice(0, 60);

    list.innerHTML = filtered.map(item => `
      <div class="history-row ${item.id === activeId ? "active" : ""}" data-row="${esc(item.id)}">
        <button class="history-item ${item.id === activeId ? "active" : ""}" data-open="${esc(item.id)}" type="button">
          ${item.pinned ? "📌 " : ""}${esc(item.title || "New conversation")}
        </button>
        <button class="history-more" data-menu="${esc(item.id)}" type="button" aria-label="Conversation actions">⋯</button>
      </div>`).join("");

    $("#chatCount").textContent = conversations.length;
  }

  function render() {
    const conversation = active();
    messagesEl.innerHTML = "";

    if (!conversation.messages.length) {
      const welcome = $("#welcome");
      if (welcome) {
        messagesEl.innerHTML = welcome.outerHTML;
        wireSuggestions();
      }
      renderHistory();
      return;
    }

    conversation.messages.forEach(message => {
      const element = document.createElement("article");
      element.className = "message " + (message.role === "user" ? "user" : "assistant");
      element.innerHTML = `
        <div class="message-avatar">${message.role === "user" ? "Y" : "N"}</div>
        <div class="message-body">
          <div class="message-role">${message.role === "user" ? "You" : "NexaGPT"}</div>
          <div class="message-text">${esc(message.content)}</div>
          <div class="message-extra"></div>
        </div>`;
      messagesEl.appendChild(element);

      const extra = element.querySelector(".message-extra");
      if (message.concepts?.length) renderConcepts(extra, message.concepts, message.originalPrompt || "");
      if (message.artifact) renderArtifact(extra, message.artifact);
    });

    scrollBottom();
    renderHistory();
  }

  function wireSuggestions() {
    messagesEl.querySelectorAll("[data-prompt]").forEach(button => {
      button.addEventListener("click", () => {
        input.value = button.dataset.prompt;
        sendMessage();
      });
    });
  }

  function scrollBottom() {
    const area = $("#chatScrollArea");
    if (area) area.scrollTop = area.scrollHeight;
  }

  function add(role, content, extra = {}) {
    const conversation = active();
    conversation.messages.push({ role, content, ...extra });
    conversation.updated = Date.now();

    if (conversation.title === "New conversation" && role === "user") {
      conversation.title = content.slice(0, 42) || "New conversation";
    }
    persist();
    render();
  }

  function renderConcepts(host, concepts, originalPrompt) {
    if (window.NexaProjectRenderer?.mountConcepts) {
      window.NexaProjectRenderer.mountConcepts(host, concepts, { originalPrompt });
      host.addEventListener("nexa:concept-selected", event => {
        sendSelection(originalPrompt, event.detail.concept);
      });
      return;
    }

    const grid = document.createElement("div");
    grid.className = "concept-grid";
    concepts.forEach((concept, index) => {
      const card = document.createElement("article");
      card.className = "concept-card";
      card.innerHTML = `<span class="concept-number">CONCEPT ${index + 1}</span><strong>${esc(concept.title)}</strong><p>${esc(concept.description)}</p><button class="primary-btn" type="button">Choose this design</button>`;
      card.querySelector("button").onclick = () => sendSelection(originalPrompt, concept);
      grid.appendChild(card);
    });
    host.appendChild(grid);
  }

  function renderArtifact(host, artifact) {
    if (window.NexaProjectRenderer?.mount) {
      window.NexaProjectRenderer.mount(host, artifact);
      return;
    }
    const box = document.createElement("div");
    box.className = "artifact";
    box.innerHTML = `<h3>${esc(artifact.title || "Generated project")}</h3><p>${esc(artifact.summary || "Project files created.")}</p>`;
    host.appendChild(box);
  }

  async function callBrain(payload) {
    const response = await fetch("/api/brain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({ error: "The server returned an invalid response." }));
    if (!response.ok || data.success === false) {
      throw new Error(data.error || `Request failed (${response.status}).`);
    }
    return data;
  }

  async function sendSelection(original, concept) {
    if (busy) return;
    add("user", `I choose concept: ${concept.title}`);
    await request({
      message: original,
      selection: concept,
      history: active().messages.slice(0, -1).map(item => ({ role: item.role, content: item.content }))
    });
  }

  async function sendMessage() {
    if (busy) return;
    const message = input.value.trim();
    if (!message && !attachments.length) return;

    input.value = "";
    const files = attachments.slice();
    attachments = [];
    $("#attachmentStrip").hidden = true;
    add("user", message || "Please analyse the attached image.");

    await request({
      message,
      attachments: files,
      history: active().messages.slice(0, -1).map(item => ({ role: item.role, content: item.content })),
      settings: { webSearch: $("#webSearch").checked }
    });
  }

  async function request(payload) {
    busy = true;
    send.disabled = true;

    const typing = document.createElement("div");
    typing.className = "typing";
    typing.textContent = "NexaGPT is thinking…";
    messagesEl.appendChild(typing);
    scrollBottom();

    try {
      const data = await callBrain(payload);
      typing.remove();
      add("assistant", data.reply || "The task finished.", {
        concepts: data.concepts || null,
        originalPrompt: payload.message,
        artifact: data.artifact || null
      });
    } catch (error) {
      typing.remove();
      add("assistant", `I couldn't complete that request: ${error.message}`);
    } finally {
      busy = false;
      send.disabled = false;
    }
  }

  function openSidebar() {
    sidebar.classList.add("open");
    scrim.classList.add("show");
  }

  function closeSidebar() {
    sidebar.classList.remove("open");
    scrim.classList.remove("show");
  }

  function navigateTo(view, panel = "assistant") {
    navigationStack.push({
      view: $("#workspaceView").hidden ? "assistant" : "workspace",
      panel: document.querySelector("[data-panel].active")?.dataset.panel || "assistant",
      activeId
    });
    history.pushState({ nexa: true, view, panel }, "");
    document.querySelectorAll("[data-panel]").forEach(button => {
      button.classList.toggle("active", button.dataset.panel === panel);
    });

    if (view === "assistant") {
      $("#chatView").hidden = false;
      $("#workspaceView").hidden = true;
    } else {
      $("#chatView").hidden = true;
      $("#workspaceView").hidden = false;
      $("#workspaceContent").innerHTML = `
        <h1>${esc(panel.charAt(0).toUpperCase() + panel.slice(1))}</h1>
        <div class="workspace-card">This workspace is being connected. Use the main chat to ask NexaGPT to create or find something.</div>`;
    }
    closeSidebar();
  }

  function goBack() {
    if (sidebar.classList.contains("open")) {
      closeSidebar();
      return;
    }
    if (navigationStack.length) {
      const previous = navigationStack.pop();
      activeId = previous.activeId || activeId;
      document.querySelectorAll("[data-panel]").forEach(button => {
        button.classList.toggle("active", button.dataset.panel === previous.panel);
      });
      $("#chatView").hidden = previous.view !== "assistant";
      $("#workspaceView").hidden = previous.view !== "workspace";
      if (previous.view === "workspace") {
        $("#workspaceContent").innerHTML = `<h1>${esc(previous.panel)}</h1><div class="workspace-card">Workspace</div>`;
      }
      render();
      return;
    }
    navigateTo("assistant", "assistant");
  }

  function startNewChat() {
    activeId = crypto.randomUUID();
    conversations.unshift({ id: activeId, title: "New conversation", messages: [], updated: Date.now(), pinned: false });
    persist();
    render();
    navigateTo("assistant", "assistant");
  }

  $("#chatForm").addEventListener("submit", event => {
    event.preventDefault();
    sendMessage();
  });

  input.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  $("#newChat").onclick = startNewChat;
  $("#historyList").addEventListener("click", event => {
    const open = event.target.closest("[data-open]");
    const menu = event.target.closest("[data-menu]");

    if (menu) {
      const id = menu.dataset.menu;
      const conversation = conversations.find(item => item.id === id);
      if (!conversation) return;
      const action = window.prompt("Type PIN to pin/unpin, or DELETE to delete this conversation.");
      if (!action) return;
      if (action.trim().toUpperCase() === "PIN") {
        conversation.pinned = !conversation.pinned;
        persist();
      } else if (action.trim().toUpperCase() === "DELETE") {
        if (!window.confirm("Delete this conversation permanently from this browser?")) return;
        conversations = conversations.filter(item => item.id !== id);
        if (activeId === id) activeId = conversations[0]?.id || crypto.randomUUID();
        persist();
        render();
      }
      return;
    }

    if (open) {
      activeId = open.dataset.open;
      closeSidebar();
      render();
    }
  });

  $("#searchChats").oninput = renderHistory;
  $("#fileInput").onchange = async event => {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("Only image attachments are enabled in this build.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast("Image must be 5 MB or smaller.");
      return;
    }
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    attachments.push({ name: file.name, type: file.type, data });
    $("#attachmentList").innerHTML = attachments.map(item => `<span class="attachment-chip">${esc(item.name)}</span>`).join("");
    $("#attachmentStrip").hidden = false;
    event.target.value = "";
  };

  $("#clearAttachment").onclick = () => {
    attachments = [];
    $("#attachmentStrip").hidden = true;
  };

  $("#openSidebar").onclick = openSidebar;
  $("#closeSidebar").onclick = closeSidebar;
  scrim.onclick = closeSidebar;

  // Edge-swipe inward from either screen edge opens the dashboard.
  let touchStart = null;
  document.addEventListener("touchstart", event => {
    if (!event.touches || event.touches.length !== 1) return;
    const touch = event.touches[0];
    const edge = 24;
    if (touch.clientX <= edge || touch.clientX >= window.innerWidth - edge) {
      touchStart = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    } else {
      touchStart = null;
    }
  }, { passive: true });

  document.addEventListener("touchend", event => {
    if (!touchStart || !event.changedTouches?.length) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStart.x;
    const dy = Math.abs(touch.clientY - touchStart.y);
    const elapsed = Date.now() - touchStart.time;
    if (dy < 85 && elapsed < 700 && Math.abs(dx) > 65) {
      if (touchStart.x <= 24 && dx > 0) openSidebar();
      if (touchStart.x >= window.innerWidth - 24 && dx < 0) openSidebar();
    }
    touchStart = null;
  }, { passive: true });

  window.addEventListener("popstate", () => {
    if (sidebar.classList.contains("open")) {
      closeSidebar();
      return;
    }
    goBack();
  });

  $("#themeToggle").onclick = () => {
    const light = document.documentElement.dataset.theme !== "light";
    document.documentElement.dataset.theme = light ? "light" : "dark";
    localStorage.setItem("nexagpt_theme", light ? "light" : "dark");
  };
  document.documentElement.dataset.theme = localStorage.getItem("nexagpt_theme") || "dark";

  document.querySelectorAll("[data-panel]").forEach(button => {
    button.addEventListener("click", () => {
      const panel = button.dataset.panel;
      navigateTo(panel === "assistant" ? "assistant" : "workspace", panel);
    });
  });

  render();
})();