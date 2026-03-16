import os
import json
import re
import httpx
import subprocess
from fastapi import APIRouter

router = APIRouter()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
API_URL = "https://" + "openrouter.ai/api/v1/chat/completions"
REFERER_URL = "https://" + "huggingface.co/"

@router.post("/api/ai_edit")
async def ai_edit(data: dict):
    prompt, content = data.get("prompt"), data.get("content")
    messages = [
        {"role": "system", "content": "You are an expert coder. Rewrite the provided code based on the user's request. Output ONLY the raw updated code. Do not use markdown blocks like ```python. No conversational text."},
        {"role": "user", "content": f"Current Code:\n{content}\n\nRequest: {prompt}"}
    ]
    payload = {"model": "openrouter/auto", "messages": messages}
    
    try:
        headers = {"Authorization": f"Bearer {OPENROUTER_API_KEY}", "HTTP-Referer": REFERER_URL}
        async with httpx.AsyncClient(trust_env=False) as client:
            res = await client.post(API_URL, headers=headers, json=payload, timeout=60.0)
            if res.status_code != 200:
                return {"code": f"# API_ERROR: {res.text}"}
            new_code = res.json()['choices'][0]['message']['content']
    except Exception as httpx_err:
        try:
            cmd = [
                "curl", "--noproxy", "*", "-s", "-X", "POST", API_URL,
                "-H", f"Authorization: Bearer {OPENROUTER_API_KEY}",
                "-H", "Content-Type: application/json",
                "-H", f"HTTP-Referer: {REFERER_URL}",
                "-d", json.dumps(payload)
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            if result.returncode != 0:
                return {"code": f"# CURL_NETWORK_ERROR: {result.stderr}\n# HTTPX_ERROR: {str(httpx_err)}"}
            res_json = json.loads(result.stdout)
            new_code = res_json['choices'][0]['message']['content']
        except Exception as curl_err:
            return {"code": f"# FATAL_NETWORK_ERROR. HTTPX: {str(httpx_err)} | CURL: {str(curl_err)}"}

    new_code = re.sub(r"^```[a-z]*\n", "", new_code)
    new_code = re.sub(r"\n```$", "", new_code)
    return {"code": new_code.strip()}

async def ask_openrouter(messages) -> str:
    if not OPENROUTER_API_KEY:
        return "API_ERROR: OPENROUTER_API_KEY is not set in Spaces Secrets."
    data = {"model": "openrouter/auto", "messages": messages}
    try:
        headers = {"Authorization": f"Bearer {OPENROUTER_API_KEY}", "HTTP-Referer": REFERER_URL}
        async with httpx.AsyncClient(trust_env=False) as client:
            response = await client.post(API_URL, headers=headers, json=data, timeout=45.0)
            if response.status_code != 200: return f"API_ERROR: {response.text}"
            return response.json()['choices'][0]['message']['content']
    except Exception as e:
        httpx_error = str(e)
        try:
            cmd = [
                "curl", "--noproxy", "*", "-s", "-X", "POST", API_URL,
                "-H", f"Authorization: Bearer {OPENROUTER_API_KEY}",
                "-H", "Content-Type: application/json",
                "-H", f"HTTP-Referer: {REFERER_URL}",
                "-d", json.dumps(data)
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=45)
            if result.returncode != 0:
                return f"CURL_NETWORK_ERROR: {result.stderr}\nHTTPX_ERROR: {httpx_error}"
            res_json = json.loads(result.stdout)
            if "error" in res_json:
                return f"API_ERROR: {json.dumps(res_json['error'])}"
            return res_json['choices'][0]['message']['content']
        except Exception as curl_e:
            return f"FATAL_NETWORK_ERROR\nHTTPX Error: {httpx_error}\nCURL Error: {str(curl_e)}"
            