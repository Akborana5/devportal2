import os

# ⚡ BULLETPROOF FIX: Wipe broken proxies before anything loads
for key in list(os.environ.keys()):
    if 'proxy' in key.lower():
        del os.environ[key]

from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.requests import Request

# Auto-create directories to prevent crashes
os.makedirs("static", exist_ok=True)
os.makedirs("templates", exist_ok=True)

import shutil
try:
    from huggingface_hub import snapshot_download
    token = os.environ.get("HF_TOKEN")
    if token:
        print("Restoring data from HuggingFace dataset...")
        # Download into a temp directory first
        tmp_restore = "/tmp/hf_restore"
        snapshot_download(
            repo_id="Ajitdoval/devportal2-storage",
            repo_type="dataset",
            local_dir=tmp_restore,
            token=token,
            force_download=True
        )
        # Copy the contents from tmp_restore to ./data
        # This prevents the .git / .huggingface folders from messing up local structure
        os.makedirs("data", exist_ok=True)
        for item in os.listdir(tmp_restore):
            s = os.path.join(tmp_restore, item)
            d = os.path.join("data", item)
            if item.startswith('.'):
                continue # Skip .gitattributes, etc.
            if os.path.isdir(s):
                shutil.copytree(s, d, dirs_exist_ok=True)
            else:
                shutil.copy2(s, d)
        print("Restore complete.")
        shutil.rmtree(tmp_restore)
except Exception as e:
    print(f"Skipping HuggingFace restore: {e}")

from backend.database import init_db
from backend.routes_auth import router as auth_router
from backend.routes_files import router as files_router
from backend.routes_ai import router as ai_router
from backend.routes_terminal import router as terminal_router
from backend.routes_sync import router as sync_router

app = FastAPI()

# Mount frontend assets
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# Initialize database
init_db()

# Include modular routes
app.include_router(auth_router)
app.include_router(files_router)
app.include_router(ai_router)
app.include_router(terminal_router)
app.include_router(sync_router)

@app.get("/", response_class=HTMLResponse)
async def get(request: Request):
    # FIXED: Using keyword arguments for newer Starlette/FastAPI versions
    return templates.TemplateResponse(
        request=request,
        name="index.html"
    )
    