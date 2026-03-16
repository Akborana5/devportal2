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

from backend.database import init_db
from backend.routes_auth import router as auth_router
from backend.routes_files import router as files_router
from backend.routes_ai import router as ai_router
from backend.routes_terminal import router as terminal_router

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

@app.get("/", response_class=HTMLResponse)
async def get(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})
    