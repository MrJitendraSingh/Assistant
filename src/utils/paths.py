import os
import sys
from pathlib import Path

def get_base_dir() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS)
    return Path(__file__).resolve().parent.parent.parent

def get_user_data_dir() -> Path:
    home = Path.home()
    if sys.platform == "darwin":
        path = home / "Library" / "Application Support" / "LocalAIChat"
    elif sys.platform == "win32":
        path = home / "AppData" / "Roaming" / "LocalAIChat"
    else:
        path = home / ".local" / "share" / "localaichat"
    
    path.mkdir(parents=True, exist_ok=True)
    return path