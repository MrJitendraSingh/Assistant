/**
 * input.js - Chat Input & Prompt Submission
 */
window.isMicActive = false; // NEW: Global state for the microphone

document.addEventListener("DOMContentLoaded", () => {
  const promptInput = document.getElementById("prompt-input");
  const sendBtn = document.getElementById("send-btn");
  const dynamicIcon = document.getElementById("dynamic-btn-icon");

  const iconVoiceWave = `<path d="M12 2v20M17 7v10M7 7v10M22 10v4M2 10v4"/>`;
  const iconUpArrow = `<line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline>`;

  // Make this globally accessible so voice.js can trigger it
  window.updateButtonState = function() {
    const hasText = promptInput.value.trim().length > 0;
    
    if (dynamicIcon) {
      // NEW: Show the send arrow if there is text OR if the mic is actively recording
      if (hasText || window.isMicActive) {
        dynamicIcon.innerHTML = iconUpArrow;
        sendBtn.classList.add("active-send");
        sendBtn.title = "Send message";
      } else {
        dynamicIcon.innerHTML = iconVoiceWave;
        sendBtn.classList.remove("active-send");
        sendBtn.title = "Voice Mode";
      }
    }
  };

  // NEW: Global flag to track if we should send immediately after transcribing
  window.autoSendTranscription = false; 

  function submitPrompt() {
    // Intercept the click if the microphone is currently recording
    if (window.isMicActive) {
      window.autoSendTranscription = true;
      window.bridgeService.pyBridge.stop_listening();
      
      // Update UI to show we are processing the voice
      const promptInput = document.getElementById("prompt-input");
      promptInput.placeholder = "Processing voice...";
      return; 
    }

    const text = promptInput.value.trim();
    if (!text || window.isStreaming) return;

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

    window.bridgeService.sendMessage(currentId, text);
  }

  sendBtn.addEventListener("click", submitPrompt);
  
  promptInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitPrompt();
    }
  });
  
  promptInput.addEventListener("input", () => {
    promptInput.style.height = "auto";
    promptInput.style.height = `${Math.min(promptInput.scrollHeight, 180)}px`;
    window.updateButtonState(); 
  });

  document.addEventListener("stream:started", () => {
    promptInput.disabled = true;
    sendBtn.disabled = true;
  });

  document.addEventListener("stream:ended", () => {
    promptInput.disabled = false;
    sendBtn.disabled = false;
    promptInput.focus();
  });
  
  window.updateButtonState();
});