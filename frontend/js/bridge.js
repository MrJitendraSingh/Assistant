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
      const bridgeObj = channel.objects.pyBridge || channel.objects.bridge || channel.objects.backend;
      
      if (!bridgeObj) {
        console.error("[Bridge] CRITICAL: Python bridge object not found in QWebChannel.");
        return;
      }
      this.pyBridge = bridgeObj;
      console.log("[Bridge] PySide Bridge connected successfully");

      // 1. Streaming Signals
      if (this.pyBridge.tokenReceived) {
        this.pyBridge.tokenReceived.connect((token) => this.emit("stream:token", token));
      }
      if (this.pyBridge.responseComplete) {
        this.pyBridge.responseComplete.connect(() => this.emit("stream:end"));
      }

      // 2. Settings Signals (Updated to handle 7 arguments)
      if (this.pyBridge.modelsLoaded) {
        this.pyBridge.modelsLoaded.connect((modelsJson) => this.emit("settings:models", modelsJson));
      }
      if (this.pyBridge.settingsLoaded) {
        this.pyBridge.settingsLoaded.connect((model, temp, prompt, userName, userOverview, aiName, voiceProfile) => {
          this.emit("settings:loaded", { model, temp, prompt, userName, userOverview, aiName, voiceProfile });
        });
      }

      // 3. Chat History & Session Signals
      if (this.pyBridge.historyLoaded) {
        this.pyBridge.historyLoaded.connect((payload) => {
          try {
            const data = JSON.parse(payload);
            this.emit("storage:history", data);
          } catch (e) {
            console.error("[Bridge] Error parsing history", e);
          }
        });
      }
      
      if (this.pyBridge.sessionDataLoaded) {
        this.pyBridge.sessionDataLoaded.connect((id, messagesJson) => {
          try {
            const messages = JSON.parse(messagesJson);
            this.emit("storage:messages", { id, messages });
          } catch (e) {
            console.error("[Bridge] Error parsing messages", e);
            this.emit("storage:messages", { id, messages: [] });
          }
        });
      }

      // 4. Mark Ready
      this.isReady = true;
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

  sendMessage(sessionId, text, modelName) {
    if (this.pyBridge) this.pyBridge.send_message(sessionId, text, modelName);
  }

  loadInitialState() {
    if (this.pyBridge) {
      this.pyBridge.load_initial_state();
    } else {
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