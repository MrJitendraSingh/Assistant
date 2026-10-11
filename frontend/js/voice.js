/**
 * voice.js - Continuous Voice Loop & Live Text Controller
 */
document.addEventListener("DOMContentLoaded", () => {
  const voiceView = document.getElementById("voice-view");
  const orb = document.getElementById("voice-orb");
  const closeVoiceBtn = document.getElementById("close-voice-btn");
  const liveTextDisplay = document.getElementById("voice-live-text");
  
  window.isVoiceModeActive = false;
  let currentVoiceResponse = "";

  function setOrbState(state) {
    if (!orb) return;
    orb.className = ""; 
    orb.classList.add(`orb-${state}`);
  }

  window.toggleVoiceMode = function() {
    window.isVoiceModeActive = true;
    if (voiceView) voiceView.classList.remove("hidden-view");
    if (liveTextDisplay) liveTextDisplay.innerText = "Listening...";
    setOrbState("listening");
    if (window.bridgeService?.pyBridge) window.bridgeService.pyBridge.start_listening();
  };

  if (closeVoiceBtn) {
    closeVoiceBtn.addEventListener("click", () => {
      window.isVoiceModeActive = false;
      if (voiceView) voiceView.classList.add("hidden-view");
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      if (window.bridgeService?.pyBridge) {
        window.bridgeService.pyBridge.abort_generation();
        window.bridgeService.pyBridge.stop_listening();
      }
    });
  }

  // 1. Core Interruption & Speech Loop
  if (window.bridgeService?.pyBridge) {
    window.bridgeService.pyBridge.speechRecognized.connect((text) => {
      if (!window.isVoiceModeActive) return;

      const cleanText = text ? text.trim() : "";
      console.log("[Voice] Recognized Text:", cleanText || "(Empty)");

      if (!cleanText) {
        // If STT fails or hears silence, just restart the mic
        window.bridgeService.pyBridge.start_listening();
        return;
      }

      // INTERRUPTION TRIGGER
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      if (window.bridgeService?.pyBridge?.abort_generation) {
        window.bridgeService.pyBridge.abort_generation();
      }

      setOrbState("idle");
      currentVoiceResponse = "";
      if (liveTextDisplay) liveTextDisplay.innerText = cleanText;

      const currentId = window.SidebarManager.currentSessionId;
      let activeModel = document.getElementById("chat-model-select")?.value || "llama3.2";
      
      if (typeof window.appendUserMessage === "function") window.appendUserMessage(cleanText);
      window.ChatMessages.push({ role: "user", content: cleanText });
      
      console.log("[Voice] Sending to Ollama...");
      window.bridgeService.sendMessage(currentId, cleanText, activeModel);

      // Force mic back on to allow interrupting the AI while it thinks/speaks
      setTimeout(() => { window.bridgeService.pyBridge.start_listening(); }, 500);
    });
  }

  // 2. Live Text Syncing
  window.bridgeService.on("stream:token", (token) => {
    if (window.isVoiceModeActive) {
      currentVoiceResponse += token;
      // Strip markdown symbols for clean display
      const cleanVisualText = currentVoiceResponse.replace(/[*#`_]/g, '');
      if (liveTextDisplay) liveTextDisplay.innerText = cleanVisualText;
    }
  });

  document.addEventListener("stream:started", () => {
    if (window.isVoiceModeActive) setOrbState("speaking");
  });

  // 3. Trigger Text-to-Speech when generation ends
  window.bridgeService.on("stream:end", () => {
    if (window.isVoiceModeActive && currentVoiceResponse) {
      const cleanText = currentVoiceResponse.replace(/[*#`_]/g, '').trim();
      console.log("[Voice] Stream ended. Triggering TTS with text:", cleanText);
      
      if (cleanText && typeof window.speakResponse === "function") {
        window.speakResponse(cleanText);
      }
    }
  });

  // 4. Loop reset after AI stops speaking
  document.addEventListener("tts:ended", () => {
    if (window.isVoiceModeActive) {
      console.log("[Voice] TTS finished. Ready for next prompt.");
      setOrbState("listening");
      if (liveTextDisplay) liveTextDisplay.innerText = "Listening...";
      if (window.bridgeService?.pyBridge) window.bridgeService.pyBridge.start_listening();
    }
  });
});