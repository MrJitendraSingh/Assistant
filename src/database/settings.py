import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'chat_history.db')

class SettingsRepository:
    @staticmethod
    def initialize():
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS model_settings (
                    model_name TEXT PRIMARY KEY,
                    temperature REAL DEFAULT 0.7,
                    system_prompt TEXT DEFAULT ''
                )
            """)
            conn.commit()

    @staticmethod
    def get_settings(model_name: str):
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT temperature, system_prompt FROM model_settings WHERE model_name = ?",
                (model_name,)
            )
            row = cursor.fetchone()
            if row:
                return {"temperature": row[0], "system_prompt": row[1]}
            return {"temperature": 0.7, "system_prompt": ""}

    @staticmethod
    def get_all():
        """Returns all configured models as a dictionary keyed by model_name."""
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT model_name, temperature, system_prompt FROM model_settings")
            rows = cursor.fetchall()
            return {
                row[0]: {"temperature": row[1], "system_prompt": row[2]}
                for row in rows
            }

    @staticmethod
    def save_settings(model_name: str, temperature: float, system_prompt: str):
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute("""
                INSERT INTO model_settings (model_name, temperature, system_prompt)
                VALUES (?, ?, ?)
                ON CONFLICT(model_name) DO UPDATE SET
                    temperature = excluded.temperature,
                    system_prompt = excluded.system_prompt
            """, (model_name, temperature, system_prompt))
            conn.commit()