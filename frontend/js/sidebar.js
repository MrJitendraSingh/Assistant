/**
 * sidebar.js - Session list, new chat, and conversation switcher
 */
window.SidebarManager = {
  sessions: {},
  currentSessionId: null,

  init() {
    this.chatList = document.getElementById("chat-list");
    this.newChatBtn = document.getElementById("new-chat-btn");
    this.sidebar = document.getElementById("sidebar");
    this.toggleBtn = document.getElementById("toggle-sidebar");

    if (this.toggleBtn && this.sidebar) {
      this.toggleBtn.addEventListener("click", () => this.sidebar.classList.toggle("collapsed"));
    }

    if (this.newChatBtn) {
      this.newChatBtn.addEventListener("click", () => this.createNewSession());
    }

    document.addEventListener("click", () => this.closeAllDropdowns());

    window.bridgeService.on("storage:history", ({ sessions: dbSessions }) => {
      console.log("[Sidebar] Loaded history from SQLite:", dbSessions.length, "sessions");
      this.sessions = {};
      if (dbSessions && dbSessions.length > 0) {
        dbSessions.forEach((s) => {
          this.sessions[s.id] = { id: s.id, title: s.title, messages: [] };
        });
        this.currentSessionId = dbSessions[0].id;
        this.render();
        window.bridgeService.emit("session:switched", this.currentSessionId);
        window.bridgeService.loadSession(this.currentSessionId);
      } else {
        this.createNewSession();
      }
    });

    if (window.bridgeService.isReady) {
      window.bridgeService.loadInitialState();
    } else {
      window.bridgeService.on("bridge:ready", () => window.bridgeService.loadInitialState());
    }
  },

  createNewSession() {
    if (window.isStreaming) return;
    const id = "session_" + Date.now();
    console.log("[Sidebar] Creating new session:", id);
    this.sessions[id] = { id: id, title: "New chat", messages: [] };
    window.bridgeService.saveSessionMeta(id, "New chat");
    this.switchSession(id);
  },

  switchSession(sessionId) {
    if (window.isStreaming) {
      console.warn("[Sidebar] Blocked switch: AI is typing.");
      return;
    }
    if (this.currentSessionId === sessionId) {
      console.log("[Sidebar] Ignored switch: Already on session", sessionId);
      return;
    }

    console.log("[Sidebar] Switching active session to:", sessionId);
    this.currentSessionId = sessionId;
    this.render();
    window.bridgeService.emit("session:switched", sessionId);
    window.bridgeService.loadSession(sessionId);
  },

  deleteSession(sessionId) {
    if (window.isStreaming) return;
    console.log("[Sidebar] Deleting session:", sessionId);
    
    window.bridgeService.deleteSession(sessionId);
    delete this.sessions[sessionId];
    
    const keys = Object.keys(this.sessions);
    this.currentSessionId = null; 

    if (keys.length > 0) {
      this.switchSession(keys[0]);
    } else {
      this.createNewSession();
    }
  },

  updateTitle(sessionId, newTitle) {
    if (this.sessions[sessionId]) {
      this.sessions[sessionId].title = newTitle;
      window.bridgeService.renameSession(sessionId, newTitle);
      this.render();
    }
  },

  closeAllDropdowns() {
    document.querySelectorAll(".chat-dropdown").forEach((el) => el.remove());
    document.querySelectorAll(".chat-item.menu-open").forEach((el) => el.classList.remove("menu-open"));
  },

  render() {
    if (!this.chatList) return;
    this.chatList.innerHTML = "";
    
    Object.keys(this.sessions).forEach((id) => {
      const session = this.sessions[id];
      const li = document.createElement("li");
      li.className = `chat-item ${id === this.currentSessionId ? "active" : ""}`;

      li.innerHTML = `
        <div class="chat-item-left">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <span class="chat-title">${session.title}</span>
        </div>
        <button class="chat-menu-btn" title="More options">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
          </svg>
        </button>
      `;

      li.querySelector(".chat-item-left").addEventListener("click", () => this.switchSession(id));
      
      li.querySelector(".chat-menu-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        this.openMenu(li, id);
      });

      this.chatList.appendChild(li);
    });
  },

  openMenu(li, sessionId) {
    if (li.classList.contains("menu-open")) {
      this.closeAllDropdowns();
      return;
    }
    
    this.closeAllDropdowns();
    li.classList.add("menu-open");
    
    const menu = document.createElement("div");
    menu.className = "chat-dropdown";
    menu.innerHTML = `
      <button class="dropdown-item rename"><span>Rename</span></button>
      <button class="dropdown-item delete"><span>Delete</span></button>
    `;

    menu.querySelector(".rename").addEventListener("click", (e) => {
      e.stopPropagation();
      this.closeAllDropdowns();
      const newTitle = prompt("New title:", this.sessions[sessionId].title);
      if (newTitle && newTitle.trim()) this.updateTitle(sessionId, newTitle.trim());
    });

    menu.querySelector(".delete").addEventListener("click", (e) => {
      e.stopPropagation();
      this.closeAllDropdowns();
      this.deleteSession(sessionId);
    });

    li.appendChild(menu);
  }
};

document.addEventListener("DOMContentLoaded", () => window.SidebarManager.init());