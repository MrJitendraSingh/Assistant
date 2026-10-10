from src.database.db import get_connection

class ChatRepository:
    @staticmethod
    def get_all_sessions():
        with get_connection() as conn:
            cursor = conn.execute("""
                SELECT id, title, created_at, updated_at 
                FROM sessions 
                ORDER BY updated_at DESC
            """)
            return [dict(row) for row in cursor.fetchall()]

    @staticmethod
    def create_or_update_session(session_id: str, title: str):
        with get_connection() as conn:
            conn.execute("""
                INSERT INTO sessions (id, title, updated_at) 
                VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(id) DO UPDATE SET 
                    title = excluded.title,
                    updated_at = CURRENT_TIMESTAMP
            """, (session_id, title))

    @staticmethod
    def delete_session(session_id: str):
        with get_connection() as conn:
            conn.execute("DELETE FROM sessions WHERE id = ?", (session_id,))

    @staticmethod
    def rename_session(session_id: str, new_title: str):
        with get_connection() as conn:
            conn.execute("""
                UPDATE sessions SET title = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            """, (new_title, session_id))

    @staticmethod
    def save_message(session_id: str, role: str, content: str):
        with get_connection() as conn:
            conn.execute("""
                INSERT INTO messages (session_id, role, content) 
                VALUES (?, ?, ?)
            """, (session_id, role, content))
            conn.execute("""
                UPDATE sessions SET updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            """, (session_id,))

    @staticmethod
    def get_session_messages(session_id: str):
        with get_connection() as conn:
            cursor = conn.execute("""
                SELECT role, content, timestamp 
                FROM messages 
                WHERE session_id = ? 
                ORDER BY id ASC
            """, (session_id,))
            return [dict(row) for row in cursor.fetchall()]