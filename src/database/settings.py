import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'chat_history.db')

class SettingsRepository:
    @staticmethod
    def initialize():
        with sqlite3.connect(DB_PATH) as conn:
            # Added 4 new columns for user profile, ai persona name, and voice
            conn.execute("""
                CREATE TABLE IF NOT EXISTS model_settings (
                    model_name TEXT PRIMARY KEY,
                    temperature REAL DEFAULT 0.7,
                    system_prompt TEXT DEFAULT '',
                    user_name TEXT DEFAULT '',
                    user_overview TEXT DEFAULT '',
                    ai_name TEXT DEFAULT '',
                    voice_profile TEXT DEFAULT 'system-default',
                    last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.commit()

    @staticmethod
    def get_latest_model():
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT model_name FROM model_settings ORDER BY last_used DESC LIMIT 1")
            row = cursor.fetchone()
            return row[0] if row else "llama3.2"

    @staticmethod
    def get_settings(model_name: str):
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT temperature, system_prompt, user_name, user_overview, ai_name, voice_profile 
                FROM model_settings WHERE model_name = ?
            """, (model_name,))
            row = cursor.fetchone()
            if row:
                return {
                    "temperature": row[0], "system_prompt": row[1],
                    "user_name": row[2], "user_overview": row[3],
                    "ai_name": row[4], "voice_profile": row[5]
                }
            # Default fallback if model has no saved settings yet
            return {
                "temperature": 0.7, "system_prompt": "",
                "user_name": "", "user_overview": "",
                "ai_name": "", "voice_profile": "system-default"
            }


    @staticmethod
    def get_all():
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT model_name, temperature, system_prompt, user_name, user_overview, ai_name, voice_profile 
                FROM model_settings
            """)
            rows = cursor.fetchall()
            return {
                row[0]: {
                    "temperature": row[1], 
                    "system_prompt": row[2],
                    "user_name": row[3],
                    "user_overview": row[4],
                    "ai_name": row[5],
                    "voice_profile": row[6]
                }
                for row in rows
            }

    @staticmethod
    def save_settings(model_name: str, temperature: float, system_prompt: str, user_name: str, user_overview: str, ai_name: str, voice_profile: str):
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute("""
                INSERT INTO model_settings 
                (model_name, temperature, system_prompt, user_name, user_overview, ai_name, voice_profile, last_used)
                VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(model_name) DO UPDATE SET
                    temperature = excluded.temperature,
                    system_prompt = excluded.system_prompt,
                    user_name = excluded.user_name,
                    user_overview = excluded.user_overview,
                    ai_name = excluded.ai_name,
                    voice_profile = excluded.voice_profile,
                    last_used = CURRENT_TIMESTAMP
            """, (model_name, temperature, system_prompt, user_name, user_overview, ai_name, voice_profile))
            conn.commit()