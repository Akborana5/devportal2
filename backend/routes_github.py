from fastapi.responses import HTMLResponse
import os
import httpx
import subprocess
import sqlite3
import shutil
from fastapi import APIRouter, Request, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from backend.database import get_username, get_user_dir, DB_FILE

router = APIRouter()

GITHUB_CLIENT_ID = os.environ.get("GITHUB_CLIENT_ID")
GITHUB_CLIENT_SECRET = os.environ.get("GITHUB_CLIENT_SECRET")

class RepoImportReq(BaseModel):
    token: str
    github_url: str

@router.get("/api/github/login")
async def github_login(request: Request, user_token: str = Query(...)):
    if not GITHUB_CLIENT_ID:
        return {"error": "GitHub OAuth not configured by admin."}

    # We pass the user_token in the state to map the returning code back to the user
    redirect_uri = f"https://github.com/login/oauth/authorize?client_id={GITHUB_CLIENT_ID}&scope=repo&state={user_token}"
    return RedirectResponse(redirect_uri)

@router.get("/api/github/callback")
async def github_callback(code: str, state: str):
    user_token = state
    username = get_username(user_token)

    if not username:
        return HTMLResponse("<html><body><h2>Error</h2><p>Invalid session state. Please close this window and try again.</p></body></html>")

    async with httpx.AsyncClient() as client:
        # Exchange code for access token
        resp = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": code
            }
        )
        data = resp.json()
        access_token = data.get("access_token")

        if access_token:
            # Save it to the DB
            conn = sqlite3.connect(DB_FILE)
            c = conn.cursor()
            c.execute("UPDATE users SET github_access_token=? WHERE username=?", (access_token, username))
            conn.commit()
            conn.close()

            # Using javascript to close the popup or redirect back to app
            return HTMLResponse(
                "<html><body><script>window.opener.postMessage('github_oauth_success', '*'); window.close();</script></body></html>"
            )
        else:
            return HTMLResponse(f"<html><body><h2>Error</h2><p>Failed to retrieve access token: {data}</p></body></html>")

class TokenReq(BaseModel):
    token: str

@router.post("/api/github/status")
async def github_status(req: TokenReq):
    username = get_username(req.token)
    if not username:
        return {"error": "Unauthorized"}

    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("SELECT github_access_token FROM users WHERE username=?", (username,))
    row = c.fetchone()
    conn.close()

    if row and row[0]:
        return {"connected": True}
    return {"connected": False}

@router.post("/api/github/repos")
async def get_github_repos(req: TokenReq):
    username = get_username(req.token)
    if not username:
        return {"error": "Unauthorized"}

    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("SELECT github_access_token FROM users WHERE username=?", (username,))
    row = c.fetchone()
    conn.close()

    if not row or not row[0]:
        return {"error": "Not connected to GitHub"}

    access_token = row[0]

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://api.github.com/user/repos?sort=updated&per_page=100",
            headers={"Authorization": f"Bearer {access_token}", "Accept": "application/vnd.github.v3+json"}
        )
        if resp.status_code == 200:
            return {"repos": resp.json()}
        else:
            return {"error": "Failed to fetch repos", "details": resp.text}

@router.post("/api/github/import_oauth")
async def import_oauth_repo(req: RepoImportReq):
    user_dir = get_user_dir(req.token)
    username = get_username(req.token)
    if not user_dir or not username:
        return {"error": "Unauthorized"}

    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("SELECT github_access_token FROM users WHERE username=?", (username,))
    row = c.fetchone()
    conn.close()

    access_token = row[0] if row else None

    try:
        tmp_dir = f"/tmp/clone_{req.token}"
        if os.path.exists(tmp_dir):
            shutil.rmtree(tmp_dir)

        env = os.environ.copy()
        env["GIT_TERMINAL_PROMPT"] = "0"

        clone_url = req.github_url
        if access_token and clone_url.startswith("https://"):
            clone_url = clone_url.replace("https://", f"https://oauth2:{access_token}@")

        result = subprocess.run(["git", "clone", clone_url, tmp_dir], capture_output=True, text=True, timeout=60, env=env)

        if result.returncode != 0:
            return {"error": f"Failed to clone: {result.stderr}"}

        # Create folder with name of repo
        repo_name = req.github_url.rstrip('/').split('/')[-1]
        if repo_name.endswith('.git'):
            repo_name = repo_name[:-4]

        dest_dir = os.path.join(user_dir, repo_name)
        if not os.path.exists(dest_dir):
            os.makedirs(dest_dir)

        git_dir = os.path.join(tmp_dir, ".git")
        if os.path.exists(git_dir):
            shutil.rmtree(git_dir)

        for item in os.listdir(tmp_dir):
            s = os.path.join(tmp_dir, item)
            d = os.path.join(dest_dir, item)
            if os.path.isdir(s):
                shutil.copytree(s, d, dirs_exist_ok=True)
            else:
                shutil.copy2(s, d)

        shutil.rmtree(tmp_dir)
        return {"success": True, "message": f"Imported into /{repo_name}"}

    except Exception as e:
        return {"error": f"Import error: {str(e)}"}
