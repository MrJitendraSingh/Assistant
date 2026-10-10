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
        modelSelect.innerHTML = models.length === 0 
          ? `<option value="" disabled selected>No models detected</option>` 
          : "";
        models.forEach(model => modelSelect.add(new Option(model, model)));
        if (models.length > 0) window.bridgeService.pyBridge.load_model_settings(modelSelect.value);
      } catch (err) { console.error("Error parsing models:", err); }
    });

    window.bridgeService.pyBridge.settingsLoaded.connect((modelName, temp, prompt) => {
      tempSlider.value = temp;
      tempDisplay.textContent = parseFloat(temp).toFixed(2);
      document.getElementById("setting-model-overview").value = prompt || "";
    });
  }
  hookBridgeEvents();

  modelSelect.addEventListener("change", () => {
    window.bridgeService.pyBridge.load_model_settings(modelSelect.value);
  });

  saveBtn.addEventListener("click", () => {
    const selectedModel = modelSelect.value;
    const temp = parseFloat(tempSlider.value);
    const prompt = document.getElementById("setting-model-overview").value;

    if (window.bridgeService?.pyBridge && selectedModel) {
      window.bridgeService.pyBridge.save_model_settings(selectedModel, temp, prompt);
      const activeHeader = document.getElementById("active-model-display");
      if (activeHeader) activeHeader.textContent = selectedModel;
      hideSettings();
    }
  });
}