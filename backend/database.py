import sqlite3
import os

DB_FILE = "devportal.db"
USERS_DIR = "user_spaces"

def init_db():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    # Create users table
    c.execute('''CREATE TABLE IF NOT EXISTS users 
                 (username TEXT PRIMARY KEY, password TEXT, token TEXT, settings TEXT)''')
    conn.commit()
    conn.close()
    
    # Ensure the master users directory exists
    if not os.path.exists(USERS_DIR):
        os.makedirs(USERS_DIR)

def get_user_dir(token: str) -> str:
    """Returns the absolute path to a specific user's secure folder based on their auth token."""
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("SELECT username FROM users WHERE token=?", (token,))
    row = c.fetchone()
    conn.close()
    
    if not row:
        return None
        
    username = row[0]
    user_path = os.path.abspath(os.path.join(USERS_DIR, username))
    
    # Auto-create if it got deleted
    if not os.path.exists(user_path):
        os.makedirs(user_path, exist_ok=True)
        
    return user_path
    