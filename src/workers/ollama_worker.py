import json
import requests
from PySide6.QtCore import QThread, Signal
from src.database.repository import ChatRepository

class OllamaStreamWorker(QThread):
    token_received = Signal(str)
    stream_finished = Signal(str, str)

    def __init__(self, session_id, prompt, model_name="llama3.2"): 
        super().__init__()
        self.session_id = session_id
        self.prompt = prompt
        self.model_name = model_name

    def run(self):
        db_messages = ChatRepository.get_session_messages(self.session_id)
        messages = [{"role": msg["role"], "content": msg["content"]} for msg in db_messages]
        full_response = ""
        
        try:
            response = requests.post(
                "http://localhost:11434/api/chat",
                json={"model": self.model_name, "messages": messages},
                stream=True,
                timeout=10
            )
            response.raise_for_status()
            
            for line in response.iter_lines():
                if line:
                    data = json.loads(line)
                    if "message" in data and "content" in data["message"]:
                        chunk = data["message"]["content"]
                        full_response += chunk
                        self.token_received.emit(chunk)
                        
        except requests.exceptions.ConnectionError:
            error_msg = "\n\n**Error:** Cannot connect to Ollama. Is the Ollama app running?"
            full_response += error_msg
            self.token_received.emit(error_msg)
        except Exception as e:
            error_msg = f"\n\n**Error:** {str(e)}"
            full_response += error_msg
            self.token_received.emit(error_msg)
            
        self.stream_finished.emit(self.session_id, full_response)