import sqlite3
import bcrypt
import secrets
import json
import os
from fastapi import APIRouter
from pydantic import BaseModel
from backend.database import DB_FILE, USERS_DIR

router = APIRouter()

class UserAuth(BaseModel):
    username: str
    password: str

@router.post("/api/register")
async def register(user: UserAuth):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("SELECT username FROM users WHERE username=?", (user.username,))
    if c.fetchone(): return {"error": "Username already exists"}
    
    hashed_pw = bcrypt.hashpw(user.password.encode('utf-8'), bcrypt.gensalt())
    token = secrets.token_hex(16)
    # DEVPORTAL Default Settings
    default_settings = json.dumps({"theme": "#eacc00", "bg": "#0a0a0a", "font": "'Fira Code', monospace"})
    
    c.execute("INSERT INTO users VALUES (?, ?, ?, ?)", (user.username, hashed_pw, token, default_settings))
    conn.commit()
    conn.close()
    
    user_path = os.path.join(USERS_DIR, user.username)
    os.makedirs(user_path, exist_ok=True)
    return {"success": True, "token": token, "username": user.username, "settings": default_settings}

@router.post("/api/login")
async def login(user: UserAuth):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("SELECT password, token, settings FROM users WHERE username=?", (user.username,))
    row = c.fetchone()
    conn.close()
    
    if row and bcrypt.checkpw(user.password.encode('utf-8'), row[0]):
        return {"success": True, "token": row[1], "username": user.username, "settings": row[2]}
    return {"error": "Invalid credentials"}

@router.post("/api/settings")
async def update_settings(data: dict):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("UPDATE users SET settings=? WHERE token=?", (json.dumps(data.get("settings", {})), data.get("token")))
    conn.commit()
    conn.close()
    return {"success": True}
    