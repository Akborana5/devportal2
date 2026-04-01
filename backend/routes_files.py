import os
import shutil
import uuid
import sqlite3
from fastapi import APIRouter, Request
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel
from backend.database import get_user_dir, get_username, DB_FILE, PUBLISHED_DIR

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

@router.get("/preview/{token}/{file_path:path}")
async def serve_preview_file(token: str, file_path: str):
    user_dir = get_user_dir(token)
    if not user_dir:
        return HTMLResponse("<h1>Unauthorized</h1>", status_code=401)

    full_path = os.path.abspath(os.path.join(user_dir, file_path))
    if not full_path.startswith(user_dir) or not os.path.exists(full_path):
        return HTMLResponse("<h1>File Not Found</h1><p>Please create an 'index.html' file first to view the live preview.</p>", status_code=404)

    return FileResponse(full_path)

class PublishReq(BaseModel):
    token: str
    project_name: str
    project_id: str | None = None  # if updating
    files: list = []        # list of selected files

@router.post("/api/publish")
async def publish_project(data: PublishReq):
    user_dir = get_user_dir(data.token)
    username = get_username(data.token)
    if not user_dir or not username:
        return {"error": "Unauthorized"}

    if not data.files:
        return {"error": "No files selected to publish."}

    # Verify all selected files exist in the user's workspace securely
    for f in data.files:
        p = os.path.abspath(os.path.join(user_dir, f))
        if not p.startswith(user_dir) or not os.path.isfile(p):
            return {"error": f"File '{f}' not found or invalid."}

    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()

    project_id = data.project_id
    pub_path = ""

    # If the user is explicitly updating a project via the UI button
    if project_id:
        # Verify ownership
        c.execute("SELECT id FROM projects WHERE username=? AND id=?", (username, project_id))
        if not c.fetchone():
            conn.close()
            return {"error": "Project not found or you don't have permission."}

        pub_path = os.path.join(PUBLISHED_DIR, project_id)
        # We wipe the old directory to ensure files that were un-ticked are actually removed from the published site
        if os.path.exists(pub_path):
            shutil.rmtree(pub_path)

        c.execute("UPDATE projects SET name=?, created_at=CURRENT_TIMESTAMP WHERE id=?", (data.project_name, project_id))

    else:
        # Creating a brand new project record
        project_id = str(uuid.uuid4())[:8] # short unique id
        pub_path = os.path.join(PUBLISHED_DIR, project_id)
        c.execute("INSERT INTO projects (id, username, name) VALUES (?, ?, ?)", (project_id, username, data.project_name))

    conn.commit()
    conn.close()

    # Create empty directory
    os.makedirs(pub_path, exist_ok=True)

    # Selectively copy ONLY the files requested by the user
    for f in data.files:
        src = os.path.join(user_dir, f)
        dst = os.path.join(pub_path, f)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(src, dst)

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

@router.post("/api/project/files")
async def list_project_files(data: dict):
    username = get_username(data.get("token"))
    project_id = data.get("project_id")
    if not username or not project_id: return {"error": "Unauthorized"}

    # Verify ownership
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("SELECT id FROM projects WHERE username=? AND id=?", (username, project_id))
    if not c.fetchone():
        conn.close()
        return {"error": "Project not found"}
    conn.close()

    pub_path = os.path.join(PUBLISHED_DIR, project_id)
    if not os.path.exists(pub_path):
        return {"files": []}

    files = []
    for root, _, filenames in os.walk(pub_path):
        for f in filenames:
            rel_dir = os.path.relpath(root, pub_path)
            files.append(f if rel_dir == "." else f"{rel_dir}/{f}")
    return {"files": files}

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
