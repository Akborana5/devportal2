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
