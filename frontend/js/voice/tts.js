window.speakResponse = function(text) {
  console.log("[TTS] Attempting to speak...");
  
  if (!window.speechSynthesis) {
    console.error("[TTS] Web Speech API is not supported in this environment.");
    document.dispatchEvent(new Event("tts:ended"));
    return;
  }

  window.speechSynthesis.cancel();
  window.currentUtterance = new SpeechSynthesisUtterance(text);
  
  const voiceName = window.activeVoiceProfile;
  if (voiceName && voiceName !== "system-default") {
    const voices = window.speechSynthesis.getVoices();
    const selectedVoice = voices.find(v => v.name.toLowerCase().includes(voiceName.toLowerCase()));
    if (selectedVoice) {
      window.currentUtterance.voice = selectedVoice;
    }
  }

  window.currentUtterance.rate = 1.05; 
  
  window.currentUtterance.onend = () => {
    document.dispatchEvent(new Event("tts:ended"));
  };

  window.currentUtterance.onerror = (e) => {
    console.error("[TTS] Error during speech playback:", e);
    document.dispatchEvent(new Event("tts:ended"));
  };
  
  window.speechSynthesis.speak(window.currentUtterance);
};