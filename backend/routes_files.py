import os
from fastapi import APIRouter
from pydantic import BaseModel
from backend.database import get_user_dir

router = APIRouter()

class FileReq(BaseModel):
    token: str
    filename: str = ""
    content: str = ""
    new_name: str = ""

@router.post("/api/files")
async def list_files(data: dict):
    user_dir = get_user_dir(data.get("token"))
    if not user_dir: return {"error": "Unauthorized"}
    files = []
    for root, _, filenames in os.walk(user_dir):
        for f in filenames:
            rel_dir = os.path.relpath(root, user_dir)
            files.append(f if rel_dir == "." else f"{rel_dir}/{f}")
    return {"files": files}

@router.post("/api/file/read")
async def read_file(data: FileReq):
    user_dir = get_user_dir(data.token)
    if not user_dir: return {"error": "Unauthorized"}
    filepath = os.path.abspath(os.path.join(user_dir, data.filename))
    if not filepath.startswith(user_dir): return {"error": "Access denied"}
    try:
        with open(filepath, "r") as f: return {"content": f.read()}
    except Exception as e: return {"error": str(e)}

@router.post("/api/file/save")
async def save_file(data: FileReq):
    user_dir = get_user_dir(data.token)
    if not user_dir: return {"error": "Unauthorized"}
    filepath = os.path.abspath(os.path.join(user_dir, data.filename))
    if not filepath.startswith(user_dir): return {"error": "Access denied"}
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    try:
        with open(filepath, "w") as f: f.write(data.content)
        return {"success": True}
    except Exception as e:
        return {"error": str(e)}

@router.post("/api/file/rename")
async def rename_file(data: FileReq):
    user_dir = get_user_dir(data.token)
    if not user_dir: return {"error": "Unauthorized"}
    old_path = os.path.abspath(os.path.join(user_dir, data.filename))
    new_path = os.path.abspath(os.path.join(user_dir, data.new_name))
    if not old_path.startswith(user_dir) or not new_path.startswith(user_dir): return {"error": "Access denied"}
    os.rename(old_path, new_path)
    return {"success": True}

from fastapi.responses import FileResponse
from fastapi import Request

@router.get("/preview/{token}/{file_path:path}")
async def serve_preview_file(token: str, file_path: str):
    user_dir = get_user_dir(token)
    if not user_dir:
        return {"error": "Unauthorized"}

    full_path = os.path.abspath(os.path.join(user_dir, file_path))
    if not full_path.startswith(user_dir) or not os.path.exists(full_path):
        return {"error": "Not found"}

    return FileResponse(full_path)

import shutil
import uuid
import sqlite3
from backend.database import DB_FILE, PUBLISHED_DIR, get_username
from fastapi.responses import HTMLResponse

class PublishReq(BaseModel):
    token: str
    project_name: str

@router.post("/api/publish")
async def publish_project(data: PublishReq):
    user_dir = get_user_dir(data.token)
    username = get_username(data.token)
    if not user_dir or not username:
        return {"error": "Unauthorized"}

    if not os.path.exists(os.path.join(user_dir, "index.html")):
        return {"error": "No index.html found. A project must have an index.html file to be published."}

    # Generate unique ID
    project_id = str(uuid.uuid4())[:8] # short unique id

    # Check if this name already exists for this user to update it instead of creating new
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("SELECT id FROM projects WHERE username=? AND name=?", (username, data.project_name))
    existing = c.fetchone()

    if existing:
        project_id = existing[0]
        # Delete old published files
        pub_path = os.path.join(PUBLISHED_DIR, project_id)
        if os.path.exists(pub_path):
            shutil.rmtree(pub_path)
    else:
        # Insert new project record
        c.execute("INSERT INTO projects (id, username, name) VALUES (?, ?, ?)", (project_id, username, data.project_name))

    conn.commit()
    conn.close()

    # Copy files
    pub_path = os.path.join(PUBLISHED_DIR, project_id)
    shutil.copytree(user_dir, pub_path)

    return {"success": True, "project_id": project_id, "url": f"/p/{project_id}/index.html"}

@router.post("/api/projects")
async def list_published_projects(data: dict):
    username = get_username(data.get("token"))
    if not username: return {"error": "Unauthorized"}

    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("SELECT id, name, created_at FROM projects WHERE username=? ORDER BY created_at DESC", (username,))
    projects = c.fetchall()
    conn.close()

    return {"projects": [{"id": p[0], "name": p[1], "created_at": p[2], "url": f"/p/{p[0]}/index.html"} for p in projects]}

@router.get("/p/{project_id}/{file_path:path}")
async def serve_published_file(project_id: str, file_path: str):
    pub_path = os.path.abspath(os.path.join(PUBLISHED_DIR, project_id))
    full_path = os.path.abspath(os.path.join(pub_path, file_path))

    if not full_path.startswith(pub_path) or not os.path.exists(full_path):
        return HTMLResponse("<h1>404 Not Found</h1>", status_code=404)

    # If it's an HTML file, inject the badge
    if file_path.endswith(".html"):
        with open(full_path, "r", encoding="utf-8") as f:
            content = f.read()

        badge = """
        <div style="position: fixed; bottom: 10px; right: 10px; z-index: 999999; background: rgba(0,0,0,0.8); color: white; padding: 5px 10px; border-radius: 4px; font-family: monospace; font-size: 11px; border: 1px solid rgba(255,193,7,0.5); backdrop-filter: blur(4px); pointer-events: none; opacity: 0.8;">
            ⚡ Created using <span style="color: #ffc107; font-weight: bold;">DEVPORTAL</span>
        </div>
        """
        # Inject just before </body> if it exists, else append
        if "</body>" in content:
            content = content.replace("</body>", badge + "\n</body>")
        else:
            content += badge

        return HTMLResponse(content)

    return FileResponse(full_path)
