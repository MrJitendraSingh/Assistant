import speech_recognition as sr
from PySide6.QtCore import QThread, Signal

class AudioListenWorker(QThread):
    transcription_ready = Signal(str)
    listening_status = Signal(bool)

    def run(self):
        self.listening_status.emit(True)
        recognizer = sr.Recognizer()
        
        try:
            with sr.Microphone() as source:
                # Calibrate to background noise
                recognizer.adjust_for_ambient_noise(source, duration=0.5)
                print("[Audio] Listening...")
                audio = recognizer.listen(source, timeout=5, phrase_time_limit=15)
                
            print("[Audio] Processing speech...")
            text = recognizer.recognize_google(audio)
            self.transcription_ready.emit(text)
            
        except sr.WaitTimeoutError:
            print("[Audio] No speech detected.")
            self.transcription_ready.emit("")
        except Exception as e:
            print(f"[Audio] STT Error: {e}")
            self.transcription_ready.emit("")
        finally:
            self.listening_status.emit(False)