/**
 * bridge.js - IPC Event Bus
 */
class QtBridgeService {
  constructor() {
    this.pyBridge = null;
    this.eventListeners = new Map();
    this.isReady = false;
    this.init();
  }

  init() {
    if (typeof QWebChannel === "undefined" || typeof qt === "undefined" || !qt.webChannelTransport) {
      setTimeout(() => this.init(), 40);
      return;
    }

    new QWebChannel(qt.webChannelTransport, (channel) => {
      this.pyBridge = channel.objects.bridge;
      this.isReady = true;

      if (this.pyBridge.tokenReceived) {
        this.pyBridge.tokenReceived.connect((token) => this.emit("stream:token", token));
      }
      if (this.pyBridge.streamFinished) {
        this.pyBridge.streamFinished.connect(() => this.emit("stream:end"));
      }
      if (this.pyBridge.historyLoaded) {
        this.pyBridge.historyLoaded.connect((jsonStr) => {
          this.emit("storage:history", JSON.parse(jsonStr));
        });
      }
      if (this.pyBridge.sessionDataLoaded) {
        this.pyBridge.sessionDataLoaded.connect((id, msgsJson) => {
          console.log(`[Bridge] 📦 Raw packet arrived from Python for: ${id}`);
          try {
            const parsed = JSON.parse(msgsJson);
            console.log(`[Bridge] ✅ Successfully unpacked JSON for: ${id}`);
            this.emit("storage:messages", { id, messages: parsed });
          } catch (err) {
            console.error(`[Bridge] 🚨 DEADLY JSON PARSE ERROR:`, err);
            console.error(`[Bridge] The broken string was:`, msgsJson);
            // Emergency fallback so the UI doesn't freeze
            this.emit("storage:messages", { id, messages: [] }); 
          }
        });
      }

      this.emit("bridge:ready");
    });
  }

  on(event, handler) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(handler);
  }

  emit(event, data) {
    const handlers = this.eventListeners.get(event);
    if (handlers) handlers.forEach((fn) => fn(data));
  }

  sendMessage(sessionId, prompt) {
    if (this.pyBridge) this.pyBridge.send_user_message(sessionId, prompt);
  }

  loadInitialState() {
    if (this.pyBridge) {
      this.pyBridge.load_initial_state();
    } else {
      // Retry once ready
      this.on("bridge:ready", () => this.pyBridge.load_initial_state());
    }
  }

  loadSession(sessionId) {
    if (this.pyBridge) this.pyBridge.load_session_messages(sessionId);
  }

  saveSessionMeta(sessionId, title) {
    if (this.pyBridge) this.pyBridge.save_session_meta(sessionId, title);
  }

  renameSession(sessionId, title) {
    if (this.pyBridge) this.pyBridge.rename_session(sessionId, title);
  }

  deleteSession(sessionId) {
    if (this.pyBridge) this.pyBridge.delete_session(sessionId);
  }
}

window.bridgeService = new QtBridgeService();