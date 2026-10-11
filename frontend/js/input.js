/**
 * input.js - Chat Input & Prompt Submission
 */
window.isMicActive = false; 

document.addEventListener("DOMContentLoaded", () => {
  const promptInput = document.getElementById("prompt-input");
  const sendBtn = document.getElementById("send-btn");
  const dynamicIcon = document.getElementById("dynamic-btn-icon");
  
  const iconVoiceWave = `<path d="M12 2v20M17 7v10M7 7v10M22 10v4M2 10v4"/>`;
  const iconUpArrow = `<line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline>`;

  window.autoSendTranscription = false; 

  window.updateButtonState = function() {
    if (!promptInput || !dynamicIcon || !sendBtn) return;
    
    const hasText = promptInput.value.trim().length > 0;
    
    // Show the send arrow if there is text OR if the mic is actively recording
    if (hasText || window.isMicActive) {
      dynamicIcon.innerHTML = iconUpArrow;
      sendBtn.classList.add("active-send");
      sendBtn.title = "Send message";
    } else {
      dynamicIcon.innerHTML = iconVoiceWave;
      sendBtn.classList.remove("active-send");
      sendBtn.title = "Voice Mode";
    }
  };

  function submitPrompt() {
    // Intercept the click if the microphone is currently recording (dictation mode)
    if (window.isMicActive) {
      window.autoSendTranscription = true;
      if (window.bridgeService?.pyBridge) {
        window.bridgeService.pyBridge.stop_listening();
      }
      if (promptInput) promptInput.placeholder = "Processing voice...";
      return; 
    }

    const text = promptInput.value.trim();
    
    // NEW: If input is empty and user clicks the button, launch Full Voice Mode
    if (!text && !window.isStreaming) {
      if (typeof window.toggleVoiceMode === "function") {
        window.toggleVoiceMode();
      }
      return;
    }
    
    if (!text || window.isStreaming) return;
    
    // Stop any ongoing speech if a new text prompt is submitted manually
    if (window.speechSynthesis) window.speechSynthesis.cancel();

    const currentId = window.SidebarManager.currentSessionId;
    
    if (window.ChatMessages.length === 0) {
      const title = text.length > 25 ? text.slice(0, 25) + "..." : text;
      window.SidebarManager.updateTitle(currentId, title);
    }
    
    window.ChatMessages.push({ role: "user", content: text });
    
    if (typeof window.appendUserMessage === "function") {
      window.appendUserMessage(text);
    }
    
    promptInput.value = "";
    promptInput.style.height = "auto";
    window.updateButtonState();
    
    if (typeof window.scrollToBottom === "function") {
      window.scrollToBottom();
    }
    
    // Read the active model from the new header dropdown
    const activeModel = document.getElementById("chat-model-select").value;
    window.bridgeService.sendMessage(currentId, text, activeModel);
  }

  if (sendBtn) sendBtn.addEventListener("click", submitPrompt);

  if (promptInput) {
    promptInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        // Prevent enter from triggering voice mode if empty
        if (promptInput.value.trim().length > 0) submitPrompt();
      }
    });

    promptInput.addEventListener("input", () => {
      promptInput.style.height = "auto";
      promptInput.style.height = `${Math.min(promptInput.scrollHeight, 180)}px`;
      window.updateButtonState(); 
    });
  }

  document.addEventListener("stream:started", () => {
    if (promptInput) promptInput.disabled = true;
    if (sendBtn) sendBtn.disabled = true;
  });

  document.addEventListener("stream:ended", () => {
    if (promptInput) promptInput.disabled = false;
    if (sendBtn) sendBtn.disabled = false;
    if (promptInput && !window.isVoiceModeActive) promptInput.focus();
  });

  window.updateButtonState();
});