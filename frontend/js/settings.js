/**
 * settings.js - Dynamic Template Fetching & Settings Controller
 */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 1. Fetch and inject the HTML template dynamically
    const response = await fetch("templates/settings.html");
    if (!response.ok) throw new Error("Failed to load settings template");
    const html = await response.text();
    document.getElementById("settings-mount-point").innerHTML = html;

    // 2. Wire up all DOM elements after injection
    initializeSettingsUI();
  } catch (error) {
    console.error("Template injection error:", error);
  }
});

function initializeSettingsUI() {
  const chatView = document.getElementById("chat-view");
  const settingsView = document.getElementById("settings-view");
  const openSettingsBtn = document.getElementById("open-settings-btn");
  const closeSettingsBtn = document.getElementById("close-settings-btn");
  const saveBtn = document.getElementById("save-all-settings-btn");

  const tabButtons = document.querySelectorAll(".settings-tab-btn");
  const tabPanels = document.querySelectorAll(".tab-panel");
  const tempSlider = document.getElementById("setting-temperature");
  const tempDisplay = document.getElementById("temp-val-display");
  const modelSelect = document.getElementById("setting-model-select");

  // View Switching
  openSettingsBtn.addEventListener("click", () => {
    // We no longer hide the chat-view, we just animate the settings overlay on top
    settingsView.classList.add("show-settings");
    
    if (window.bridgeService?.pyBridge) {
      window.bridgeService.pyBridge.fetch_installed_models();
    }
  });

  const hideSettings = () => {
    // Animate settings away
    settingsView.classList.remove("show-settings");
  };

  closeSettingsBtn.addEventListener("click", hideSettings);
  
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && settingsView.classList.contains("show-settings")) {
      hideSettings();
    }
  });

  // Tab Navigation
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabButtons.forEach(b => b.classList.remove("active"));
      tabPanels.forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
    });
  });

  // Temperature Slider
  tempSlider.addEventListener("input", () => {
    tempDisplay.textContent = parseFloat(tempSlider.value).toFixed(2);
  });

  // Python Bridge Connection
  function hookBridgeEvents() {
    if (!window.bridgeService?.pyBridge) {
      setTimeout(hookBridgeEvents, 100);
      return;
    }

    window.bridgeService.pyBridge.modelsLoaded.connect((modelsJson) => {
      try {
        const models = JSON.parse(modelsJson);
        const chatModelSelect = document.getElementById("chat-model-select"); // The new UI dropdown
        
        modelSelect.innerHTML = models.length === 0 ? `<option value="" disabled selected>No models detected</option>` : "";
        if (chatModelSelect) chatModelSelect.innerHTML = "";
        
        models.forEach(model => {
          modelSelect.add(new Option(model, model));
          if (chatModelSelect) chatModelSelect.add(new Option(model, model));
        });
        
        if (models.length > 0) window.bridgeService.pyBridge.load_model_settings(modelSelect.value);
      } catch (err) { console.error("Error parsing models:", err); }
    });

    window.bridgeService.pyBridge.settingsLoaded.connect((modelName, temp, prompt, userName, userOverview, aiName, voiceProfile) => {
      // Sliders & Textareas
      tempSlider.value = temp;
      tempDisplay.textContent = parseFloat(temp).toFixed(2);
      document.getElementById("setting-model-overview").value = prompt || "";
      
      // New Profile & Voice inputs
      document.getElementById("setting-user-name").value = userName || "";
      document.getElementById("setting-user-overview").value = userOverview || "";
      document.getElementById("setting-ai-name").value = aiName || "";
      
      const voiceSelect = document.getElementById("setting-voice-select");
      if (voiceSelect) {
        voiceSelect.value = voiceProfile || "system-default";
        window.activeVoiceProfile = voiceSelect.value; 
      }
    });
  }
  hookBridgeEvents();

  modelSelect.addEventListener("change", () => {
    const selectedModel = modelSelect.value;
    
    // 1. Load the temperature and prompt into the UI for the newly selected model
    window.bridgeService.pyBridge.load_model_settings(selectedModel);
    
    // 2. Immediately update the active model display in the chat header
    const activeHeader = document.getElementById("active-model-display");
    if (activeHeader) activeHeader.textContent = selectedModel;
    
    // 3. Tell the Python backend to save this as the global active model
    if (window.bridgeService?.pyBridge?.set_active_model) {
      window.bridgeService.pyBridge.set_active_model(selectedModel);
    }
  });

  saveBtn.addEventListener("click", () => {
      const selectedModel = modelSelect.value;
      const temp = parseFloat(tempSlider.value);
      const prompt = document.getElementById("setting-model-overview").value;
      
      // Grab values from the new form fields
      const userName = document.getElementById("setting-user-name").value;
      const userOverview = document.getElementById("setting-user-overview").value;
      const aiName = document.getElementById("setting-ai-name").value;
      const voiceProfile = document.getElementById("setting-voice-select").value;
      
      if (window.bridgeService?.pyBridge && selectedModel) {
        // Send all 7 parameters to Python
        window.bridgeService.pyBridge.save_model_settings(
          selectedModel, temp, prompt, userName, userOverview, aiName, voiceProfile
        );
        
        const activeHeader = document.getElementById("chat-model-select");
        if (activeHeader) activeHeader.value = selectedModel;
        
        hideSettings();
      }
    });

    const chatModelSelect = document.getElementById("chat-model-select");
    if (chatModelSelect) {
    chatModelSelect.addEventListener("change", () => {
      const selectedModel = chatModelSelect.value;
      
      // 1. Sync the hidden settings menu to match
      modelSelect.value = selectedModel;
      window.bridgeService.pyBridge.load_model_settings(selectedModel);
      
      // 2. Tell Python to update the last_used timestamp in the database
      if (window.bridgeService?.pyBridge?.switch_active_model) {
        window.bridgeService.pyBridge.switch_active_model(selectedModel);
      }
    });
  }

}