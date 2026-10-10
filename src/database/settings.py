import json
from pathlib import Path
from src.utils.paths import get_user_data_dir

SETTINGS_FILE = get_user_data_dir() / "settings.json"

DEFAULT_SETTINGS = {
    "theme": "dark",
    "window_width": 1180,
    "window_height": 820,
    "selected_model": "default",
    "temperature": 0.7
}

class SettingsManager:
    @staticmethod
    def get_all():
        if not SETTINGS_FILE.exists():
            SettingsManager.save_all(DEFAULT_SETTINGS)
            return DEFAULT_SETTINGS.copy()
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return {**DEFAULT_SETTINGS, **data}
        except Exception:
            return DEFAULT_SETTINGS.copy()

    @staticmethod
    def get(key, default=None):
        return SettingsManager.get_all().get(key, default)

    @staticmethod
    def set(key, value):
        data = SettingsManager.get_all()
        data[key] = value
        SettingsManager.save_all(data)

    @staticmethod
    def save_all(data):
        temp_file = SETTINGS_FILE.with_suffix(".tmp")
        with open(temp_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        temp_file.replace(SETTINGS_FILE)