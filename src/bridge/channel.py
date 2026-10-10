import json
import requests
from PySide6.QtCore import QObject, Slot, Signal, QThread
from src.database.repository import ChatRepository
from src.database.settings import SettingsManager
import speech_recognition as sr
from src.workers.audio_worker import AudioListenWorker





class OllamaStreamWorker(QThread):
    token_received = Signal(str)
    stream_finished = Signal(str, str)

    def __init__(self, session_id, prompt, model_name="llama3.2"): 
        super().__init__()
        self.session_id = session_id
        self.prompt = prompt
        self.model_name = model_name

    def run(self):
        # 1. Fetch full conversation history from SQLite for context memory
        db_messages = ChatRepository.get_session_messages(self.session_id)
        
        messages = []
        for msg in db_messages:
            messages.append({"role": msg["role"], "content": msg["content"]})
            
        full_response = ""
        
        try:
            # 2. Call local Ollama API with streaming enabled
            response = requests.post(
                "http://localhost:11434/api/chat",
                json={"model": self.model_name, "messages": messages},
                stream=True,
                timeout=10
            )
            response.raise_for_status()

            # 3. Read the stream chunk by chunk and emit to JS
            for line in response.iter_lines():
                if line:
                    data = json.loads(line)
                    if "message" in data and "content" in data["message"]:
                        chunk = data["message"]["content"]
                        full_response += chunk
                        self.token_received.emit(chunk)

        except requests.exceptions.ConnectionError:
            error_msg = "\n\n**Error:** Cannot connect to Ollama. Is the Ollama app running in the background?"
            full_response += error_msg
            self.token_received.emit(error_msg)
        except Exception as e:
            error_msg = f"\n\n**Error:** {str(e)}"
            full_response += error_msg
            self.token_received.emit(error_msg)

        # 4. Signal completion to save to DB and unlock the UI
        self.stream_finished.emit(self.session_id, full_response)


class BridgeChannel(QObject):
    tokenReceived = Signal(str)
    streamFinished = Signal()
    historyLoaded = Signal(str)
    sessionDataLoaded = Signal(str, str)

    def __init__(self, webview=None):
        super().__init__()
        self.webview = webview
        self.worker = None

    @Slot()
    def load_initial_state(self):
        try:
            sessions = ChatRepository.get_all_sessions()
            settings = SettingsManager.get_all()
            payload = json.dumps({"sessions": sessions, "settings": settings})
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

    @Slot(str, str)
    def send_user_message(self, session_id: str, prompt: str):
        ChatRepository.save_message(session_id, "user", prompt)

        # Change "qwen:4b" to "llama3.2" right here:
        self.worker = OllamaStreamWorker(session_id, prompt, model_name="llama3.2") 
        self.worker.token_received.connect(self.tokenReceived)
        self.worker.stream_finished.connect(self._on_stream_complete)
        self.worker.start()

    # CRITICAL: @Slot decorator ensures thread safety when worker finishes
    @Slot(str, str)
    def _on_stream_complete(self, session_id: str, full_response: str):
        ChatRepository.save_message(session_id, "assistant", full_response)
        self.streamFinished.emit()


    tokenReceived = Signal(str)
    streamFinished = Signal()
    historyLoaded = Signal(str)
    sessionDataLoaded = Signal(str, str)
    
    # NEW Audio signals
    speechRecognized = Signal(str)
    isListening = Signal(bool)

    # ... existing init and slots ...

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