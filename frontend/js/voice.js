/**
 * voice.js - Microphone and Speech-to-Text Controller
 */
document.addEventListener("DOMContentLoaded", () => {
  const micBtn = document.getElementById("mic-btn");
  const promptInput = document.getElementById("prompt-input");

  if (!micBtn || !promptInput) return;

  // Define the sleek SVGs for the mic button
  const iconMic = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>`;
  const iconStop = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><rect x="6" y="6" width="12" height="12"></rect></svg>`;

  function initializeVoiceFeatures() {
    if (!window.bridgeService || !window.bridgeService.pyBridge) {
      setTimeout(initializeVoiceFeatures, 100); 
      return;
    }

    window.bridgeService.pyBridge.isListening.connect((isListening) => {
      // Tell input.js the mic status and force the send button to visually update
      window.isMicActive = isListening;
      if (typeof window.updateButtonState === "function") {
        window.updateButtonState();
      }

      if (isListening) {
        // Swap to the red stop square
        micBtn.innerHTML = iconStop;
        promptInput.placeholder = "Listening...";
        promptInput.disabled = true;
      } else {
        // Restore the original mic SVG
        micBtn.innerHTML = iconMic;
        promptInput.placeholder = "Ask Gemini...";
        promptInput.disabled = false;
        promptInput.focus();
      }
    });

    window.bridgeService.pyBridge.speechRecognized.connect((text) => {
      if (text) {
        promptInput.value = text;
        promptInput.dispatchEvent(new Event("input"));

        // NEW: If the user clicked the Send button while recording, send it instantly
        if (window.autoSendTranscription) {
          window.autoSendTranscription = false;
          
          // Small delay to ensure the UI has time to update the text box
          setTimeout(() => {
            const sendBtn = document.getElementById("send-btn");
            if (sendBtn) sendBtn.click();
          }, 100);
        }
      } else {
        // If transcription failed or was empty, reset the flag
        window.autoSendTranscription = false;
      }
    });

    micBtn.addEventListener("click", () => {
      if (window.isStreaming) return; 
      window.bridgeService.pyBridge.start_listening();
    });
  }

  initializeVoiceFeatures();
});