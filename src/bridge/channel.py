import json
import requests
from PySide6.QtCore import QObject, Slot, Signal

from src.database.repository import ChatRepository
from src.database.settings import SettingsRepository
from src.workers.audio_worker import AudioListenWorker
from src.workers.ollama_worker import OllamaStreamWorker

class BridgeChannel(QObject):
    tokenReceived = Signal(str)
    streamFinished = Signal()
    historyLoaded = Signal(str)
    sessionDataLoaded = Signal(str, str)
    responseComplete = Signal()
    modelsLoaded = Signal(str)
    
    # FIX: Update this signature to accept all 7 arguments
    settingsLoaded = Signal(str, float, str, str, str, str, str) 
    
    speechRecognized = Signal(str)
    isListening = Signal(bool)

    def __init__(self, webview=None):
        super().__init__()
        self.webview = webview
        self.worker = None

    @Slot()
    def load_initial_state(self):
        try:
            sessions = ChatRepository.get_all_sessions()
            settings = SettingsRepository.get_all()
            
            # FIX: Use the new timestamp-based method to get the active model
            active_model = SettingsRepository.get_latest_model()
            
            payload = json.dumps({
                "sessions": sessions, 
                "settings": settings,
                "active_model": active_model
            })
            self.historyLoaded.emit(payload)
        except Exception as e:
            print(f"[Python] ERROR loading database: {e}")

    @Slot(str)
    def load_session_messages(self, session_id: str):
        try:
            messages = ChatRepository.get_session_messages(session_id)
            self.sessionDataLoaded.emit(session_id, json.dumps(messages))
        except Exception as e:
            print(f"[Python] CRITICAL DATABASE ERROR: {e}")

    @Slot(str, str)
    def save_session_meta(self, session_id: str, title: str):
        ChatRepository.create_or_update_session(session_id, title)

    @Slot(str)
    def delete_session(self, session_id: str):
        ChatRepository.delete_session(session_id)

    @Slot(str, str)
    def rename_session(self, session_id: str, new_title: str):
        ChatRepository.rename_session(session_id, new_title)

    @Slot(str, str, str)
    def send_message(self, session_id: str, prompt: str, active_model: str):
        # 1. Save the user's prompt to the SQLite database
        ChatRepository.save_message(session_id, "user", prompt)
        
        # 2. Pass the user's selected model to the worker thread
        self.worker = OllamaStreamWorker(session_id, prompt, model_name=active_model) 
        self.worker.token_received.connect(self.tokenReceived)
        self.worker.stream_finished.connect(self._on_stream_complete)
        self.worker.start()

    @Slot(str, str)
    def _on_stream_complete(self, session_id: str, full_response: str):
        ChatRepository.save_message(session_id, "assistant", full_response)
        
        # FIX: Change from self.streamFinished.emit() to match the JS listener
        self.responseComplete.emit()

    @Slot()
    def start_listening(self):
        # Prevent starting a new thread if one is already actively recording
        if hasattr(self, 'audio_worker') and self.audio_worker.isRunning():
            print("[Python] Microphone is already active. Ignoring click.")
            return

        # Spin up the isolated audio worker
        self.audio_worker = AudioListenWorker()
        self.audio_worker.transcription_ready.connect(self.speechRecognized.emit)
        self.audio_worker.listening_status.connect(self.isListening.emit)
        self.audio_worker.start()

    @Slot()
    def stop_listening(self):
        # DO NOT use .terminate() or it will destroy the recorded audio!
        # The speech_recognition library automatically stops listening when you pause speaking.
        if hasattr(self, 'audio_worker') and self.audio_worker.isRunning():
            print("[Python] Auto-send triggered. Waiting for final transcription...")
            # We let the thread finish naturally so it can emit the speechRecognized signal

    @Slot()
    def fetch_installed_models(self):
        try:
            # Reaches out to your local Ollama app
            response = requests.get("http://localhost:11434/api/tags", timeout=2)
            response.raise_for_status()
            data = response.json()
            
            # Extracts the names and sends them back to JavaScript
            models = [model["name"] for model in data.get("models", [])]
            self.modelsLoaded.emit(json.dumps(models))
        except Exception as e:
            print(f"[Ollama] Error fetching models: {e}")
            self.modelsLoaded.emit(json.dumps([]))

    @Slot(str)
    def load_model_settings(self, model_name: str):
        s = SettingsRepository.get_settings(model_name)
        # Emit all data back to JS
        self.settingsLoaded.emit(
            model_name, 
            s["temperature"], 
            s["system_prompt"],
            s["user_name"],
            s["user_overview"],
            s["ai_name"],
            s["voice_profile"]
        )

    # UPDATE: Slot signature expanded to match all form fields
    @Slot(str, float, str, str, str, str, str)
    def save_model_settings(self, model_name: str, temperature: float, system_prompt: str, user_name: str, user_overview: str, ai_name: str, voice_profile: str):
        SettingsRepository.save_settings(model_name, temperature, system_prompt, user_name, user_overview, ai_name, voice_profile)
        print(f"[Settings] Saved complete profile for {model_name}")

    @Slot(str)
    def switch_active_model(self, model_name: str):
        SettingsRepository.update_last_used(model_name)
        print(f"[Settings] Switched active model to {model_name} via chat screen")

    @Slot()
    def abort_generation(self):
        if self.worker and self.worker.isRunning():
            self.worker.cancel()
            self.worker.wait() # Safely shut down the thread
            print("[Python] Generation interrupted by user voice.")