/**
 * chat.js - Chat Canvas & Streaming Display
 */
window.isStreaming = false; 
window.ChatMessages = []; // Exposed globally so input.js can read the message count

document.addEventListener("DOMContentLoaded", () => {
  const scrollArea = document.getElementById("chat-scroll-area");
  const chatContainer = document.getElementById("chat-container");

  let currentRawMarkdown = "";
  let activePayload = null;
  let activeWrapper = null;
  let isLoading = false;

  // Expose these functions globally so input.js can trigger them
  window.scrollToBottom = () => {
    scrollArea.scrollTop = scrollArea.scrollHeight;
  };

  window.appendUserMessage = (text) => {
    const welcome = chatContainer.querySelector(".welcome-container");
    if (welcome) welcome.remove();

    const row = document.createElement("div");
    row.className = "message-row user";
    row.innerHTML = `<div class="user-bubble">${escapeHtml(text)}</div>`;
    chatContainer.appendChild(row);
    window.scrollToBottom();
  };

  function renderMarkdownSafe(text) {
    if (typeof marked !== "undefined" && typeof marked.parse === "function") {
      return marked.parse(text);
    }
    return text.replace(/\n/g, "<br>");
  }

  window.renderCanvas = () => {
    chatContainer.innerHTML = "";
    
    if (isLoading) {
      chatContainer.innerHTML = `
        <div class="welcome-container" style="text-align: center; margin-top: 15vh;">
          <p style="font-size: 15px; color: var(--text-dim);">Loading conversation...</p>
        </div>
      `;
      return;
    }

    if (!window.ChatMessages || window.ChatMessages.length === 0) {
      chatContainer.innerHTML = `
        <div class="welcome-container" style="text-align: center; margin-top: 15vh; color: var(--text-dim);">
          <h1 style="font-size: 32px; font-weight: 500; margin-bottom: 8px;">
            <span style="background: linear-gradient(90deg, #4285f4, #9b72cb, #d96570); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Hello</span>
          </h1>
          <p style="font-size: 16px; color: var(--text-muted);">How can I help you today?</p>
        </div>
      `;
      return;
    }

    try {
      window.ChatMessages.forEach((msg) => {
        if (msg.role === "user") {
          window.appendUserMessage(msg.content);
        } else {
          const nodes = createAssistantNode();
          nodes.payload.innerHTML = renderMarkdownSafe(msg.content);
          attachCodeButtons(nodes.payload);
          appendActions(nodes.wrapper, msg.content);
        }
      });
      window.scrollToBottom();
    } catch (err) {
      console.error("[Chat] CRITICAL RENDER ERROR:", err);
    }
  };

  function createAssistantNode() {
    const welcome = chatContainer.querySelector(".welcome-container");
    if (welcome) welcome.remove();

    const row = document.createElement("div");
    row.className = "message-row assistant";
    row.innerHTML = `
      <div class="assistant-sparkle">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="url(#sparkle-grad)">
          <path d="M12 2C12 7.5 7.5 12 2 12C7.5 12 12 16.5 12 22C12 16.5 16.5 12 22 12C16.5 12 12 7.5 12 2Z"/>
        </svg>
      </div>
      <div class="assistant-body">
        <div class="markdown-payload"></div>
      </div>
    `;
    chatContainer.appendChild(row);
    return {
      payload: row.querySelector(".markdown-payload"),
      wrapper: row.querySelector(".assistant-body")
    };
  }

  function attachCodeButtons(container) {
    container.querySelectorAll("pre:not([data-copy-ready])").forEach((pre) => {
      pre.setAttribute("data-copy-ready", "true");
      pre.style.position = "relative";
      const btn = document.createElement("button");
      btn.className = "copy-code-btn";
      btn.innerText = "Copy";
      btn.addEventListener("click", () => {
        navigator.clipboard.writeText(pre.querySelector("code")?.innerText || "");
        btn.innerText = "Copied!";
        setTimeout(() => (btn.innerText = "Copy"), 2000);
      });
      pre.appendChild(btn);
    });
  }

  function appendActions(wrapper, text) {
    const bar = document.createElement("div");
    bar.className = "action-bar";
    bar.innerHTML = `
      <button class="action-btn" title="Good">👍</button>
      <button class="action-btn" title="Bad">👎</button>
      <button class="action-btn copy-all" title="Copy">📋</button>
    `;
    bar.querySelector(".copy-all").addEventListener("click", () => navigator.clipboard.writeText(text));
    wrapper.appendChild(bar);
  }

  function escapeHtml(t) {
    const d = document.createElement("div");
    d.innerText = t;
    return d.innerHTML;
  }

  // --- Bridge Synchronization ---
  window.bridgeService.on("session:switched", (sessionId) => {
    window.ChatMessages = [];
    isLoading = true;
    window.renderCanvas();
  });

  window.bridgeService.on("storage:messages", ({ id, messages }) => {
    if (window.SidebarManager.currentSessionId === id) {
      isLoading = false;
      window.ChatMessages = messages || [];
      window.renderCanvas();
    }
  });

  window.bridgeService.on("stream:token", (token) => {
    if (!window.isStreaming) {
      window.isStreaming = true;
      currentRawMarkdown = "";
      const nodes = createAssistantNode();
      activePayload = nodes.payload;
      activeWrapper = nodes.wrapper;
      
      // Dispatch event to tell input.js to lock the input box
      document.dispatchEvent(new Event("stream:started"));
    }
    currentRawMarkdown += token;
    activePayload.innerHTML = renderMarkdownSafe(currentRawMarkdown);
    window.scrollToBottom();
  });

  window.bridgeService.on("stream:end", () => {
    if (activePayload) {
      activePayload.innerHTML = renderMarkdownSafe(currentRawMarkdown);
      attachCodeButtons(activePayload);
      if (activeWrapper) appendActions(activeWrapper, currentRawMarkdown);
      
      // NEW: Speak the final clean text out loud
      if (typeof window.speakResponse === "function" && !window.isVoiceModeActive) {
        // innerText strips out HTML and Markdown, giving us plain readable text
        window.speakResponse(activePayload.innerText); 
      }
    }
    window.ChatMessages.push({ role: "assistant", content: currentRawMarkdown });
    
    window.isStreaming = false;
    activePayload = null;
    activeWrapper = null;
    
    document.dispatchEvent(new Event("stream:ended"));
  });
});