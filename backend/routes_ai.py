import os
import json
import re
import httpx
import subprocess
import asyncio
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

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

@router.post("/api/chat")
async def chat_with_ai(data: dict):
    token = data.get("token")
    user_msg = data.get("message")
    history = data.get("history", [])
    model = data.get("model", "nvidia/llama3-chatqa-1.5-8b")
    user_key = data.get("api_key", "").strip()
    sys_prompt = data.get("system_prompt", "You are a helpful coding assistant.")

    # Priority: User Key -> Env OPENROUTER_API_KEY -> Env NVIDIA_API_KEY
    api_key = user_key if user_key else OPENROUTER_API_KEY
    base_url = API_URL

    if not api_key:
        async def err_stream(): yield "Error: No API Key provided in Settings or Environment."
        return StreamingResponse(err_stream(), media_type="text/plain")

    messages = [{"role": "system", "content": sys_prompt}] + history + [{"role": "user", "content": user_msg}]
    payload = {"model": model, "messages": messages, "stream": True}

    async def stream_generator():
        headers = {"Authorization": f"Bearer {api_key}", "HTTP-Referer": REFERER_URL}
        try:
            async with httpx.AsyncClient(trust_env=False) as client:
                async with client.stream("POST", base_url, headers=headers, json=payload, timeout=60.0) as response:
                    if response.status_code != 200:
                        err = await response.aread()
                        yield f"API Error: {err.decode('utf-8')}"
                        return

                    async for line in response.aiter_lines():
                        if line.startswith("data: ") and line != "data: [DONE]":
                            try:
                                data_chunk = json.loads(line[6:])
                                content = data_chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                                if content:
                                    yield content
                            except json.JSONDecodeError:
                                pass
        except Exception as e:
            yield f"\n\n**Network Error:** {str(e)}"

    return StreamingResponse(stream_generator(), media_type="text/plain")
