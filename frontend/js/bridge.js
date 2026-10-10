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
      // 1. Safely grab the Python object regardless of what it was named in Python
      const bridgeObj = channel.objects.pyBridge || channel.objects.bridge || channel.objects.backend;
      
      if (!bridgeObj) {
        console.error("[Bridge] CRITICAL: Python bridge object not found in QWebChannel.");
        return;
      }

      this.pyBridge = bridgeObj;
      console.log("[Bridge] PySide Bridge connected successfully");

      // 2. Connect Streaming Signals
      if (this.pyBridge.tokenReceived) {
        this.pyBridge.tokenReceived.connect((token) => this.emit("stream:token", token));
      }
      if (this.pyBridge.responseComplete) {
        this.pyBridge.responseComplete.connect(() => this.emit("stream:end"));
      }

      // 3. Connect Settings Signals
      if (this.pyBridge.modelsLoaded) {
        this.pyBridge.modelsLoaded.connect((modelsJson) => this.emit("settings:models", modelsJson));
      }
      if (this.pyBridge.settingsLoaded) {
        this.pyBridge.settingsLoaded.connect((model, temp, prompt) => {
          this.emit("settings:loaded", { model, temp, prompt });
        });
      }
      if (this.pyBridge.userProfileLoaded) {
        this.pyBridge.userProfileLoaded.connect((name, overview) => {
          this.emit("settings:profile", { name, overview });
        });
      }

      if (this.pyBridge.sessionSwitched) {
        this.pyBridge.sessionSwitched.connect((id) => {
          this.emit("session:switched", id);
        });
      }
      
      if (this.pyBridge.messagesLoaded) {
        this.pyBridge.messagesLoaded.connect((id, messagesJson) => {
          try {
            const messages = JSON.parse(messagesJson);
            this.emit("storage:messages", { id, messages });
          } catch (e) {
            console.error("[Bridge] Error parsing messages", e);
            this.emit("storage:messages", { id, messages: [] });
          }
        });
      }

      this.emit("ready");
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

  sendMessage(sessionId, text, modelName) {
    if (this.pyBridge) {
      this.pyBridge.send_message(sessionId, text, modelName);
    } else {
      console.warn("Cannot send message: Python bridge not connected.");
    }
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