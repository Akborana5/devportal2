import sqlite3
import os

DB_FILE = "devportal.db"
USERS_DIR = "user_spaces"
PUBLISHED_DIR = "published_projects"

def init_db():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    # Create users table
    c.execute('''CREATE TABLE IF NOT EXISTS users 
                 (username TEXT PRIMARY KEY, password TEXT, token TEXT, settings TEXT)''')

    # Create published projects table
    c.execute('''CREATE TABLE IF NOT EXISTS projects
                 (id TEXT PRIMARY KEY, username TEXT, name TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)''')

    conn.commit()
    conn.close()
    
    # Ensure the master users directory exists
    if not os.path.exists(USERS_DIR):
        os.makedirs(USERS_DIR)

    # Ensure the published directory exists
    if not os.path.exists(PUBLISHED_DIR):
        os.makedirs(PUBLISHED_DIR)

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

def get_username(token: str) -> str:
    """Returns the username associated with a token."""
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("SELECT username FROM users WHERE token=?", (token,))
    row = c.fetchone()
    conn.close()
    return row[0] if row else None
