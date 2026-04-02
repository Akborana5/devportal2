import os
import subprocess
from fastapi import APIRouter
from pydantic import BaseModel
from backend.database import get_username

router = APIRouter()

class SyncReq(BaseModel):
    token: str

@router.post("/api/sync/hf")
async def sync_huggingface(data: SyncReq):
    username = get_username(data.token)
    if not username: return {"error": "Unauthorized"}

    # Assuming HF CLI is installed and user provided token in ENV or we just run the command
    # Using the command format provided by the user
    # `hf sync ./data hf://buckets/Ajitdoval/devportal2-storage`

    try:
        from huggingface_hub import HfApi

        token = os.environ.get("HF_TOKEN")
        if not token:
            return {"error": "HF_TOKEN environment variable is not set. Please add it to your Space secrets."}

        api = HfApi(token=token)

        # Ensure the repo exists (creates it if it doesn't)
        api.create_repo(
            repo_id="Ajitdoval/devportal2-storage",
            repo_type="dataset",
            exist_ok=True
        )

        # Upload the data folder
        api.upload_folder(
            folder_path="./data",
            repo_id="Ajitdoval/devportal2-storage",
            repo_type="dataset",
            commit_message="Sync Devportal2 Data"
        )

        return {"success": True, "message": "Successfully synced to HuggingFace Datasets."}
    except ImportError:
        return {"error": "huggingface_hub package is not installed."}
    except Exception as e:
        return {"error": f"Failed to execute sync command: {str(e)}"}

import zipfile
import shutil
from fastapi.responses import FileResponse
from backend.database import get_user_dir

class ImportReq(BaseModel):
    token: str
    github_url: str

@router.get("/api/export/{token}")
async def export_workspace(token: str):
    user_dir = get_user_dir(token)
    if not user_dir: return {"error": "Unauthorized"}

    zip_path = f"/tmp/workspace_{token}.zip"

    # Zip the contents of the user directory
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, _, files in os.walk(user_dir):
            for file in files:
                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, user_dir)
                zipf.write(file_path, rel_path)

    return FileResponse(path=zip_path, filename="workspace.zip", media_type='application/zip')

@router.post("/api/import/github")
async def import_github(data: ImportReq):
    user_dir = get_user_dir(data.token)
    if not user_dir: return {"error": "Unauthorized"}

    # Very basic validation of github url
    if not data.github_url.startswith("https://github.com/"):
        return {"error": "Invalid GitHub URL"}

    try:
        # Clone into a temp directory
        tmp_dir = f"/tmp/clone_{data.token}"
        if os.path.exists(tmp_dir):
            shutil.rmtree(tmp_dir)

        env = os.environ.copy()
        env["GIT_TERMINAL_PROMPT"] = "0"
        result = subprocess.run(["git", "clone", data.github_url, tmp_dir], capture_output=True, text=True, timeout=60, env=env)

        if result.returncode != 0:
            return {"error": f"Failed to clone: {result.stderr}"}

        # Copy contents to user_dir, removing .git to keep it clean
        git_dir = os.path.join(tmp_dir, ".git")
        if os.path.exists(git_dir):
            shutil.rmtree(git_dir)

        for item in os.listdir(tmp_dir):
            s = os.path.join(tmp_dir, item)
            d = os.path.join(user_dir, item)
            if os.path.isdir(s):
                shutil.copytree(s, d, dirs_exist_ok=True)
            else:
                shutil.copy2(s, d)

        shutil.rmtree(tmp_dir)
        return {"success": True, "message": "Repository imported successfully!"}

    except Exception as e:
        return {"error": f"Import error: {str(e)}"}
