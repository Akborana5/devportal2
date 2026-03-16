import os
import json
import re
import asyncio
import subprocess
import traceback
import urllib.request
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from backend.database import get_user_dir, USERS_DIR
from backend.routes_ai import ask_openrouter

router = APIRouter()

SYSTEM_PROMPT = """You are DEVPORTAL AI, an advanced terminal assistant. 
You are operating within a user's private Linux directory.
To execute a bash command, output it wrapped EXACTLY in <EXEC> and </EXEC> tags.
Wait for the system to provide the output before taking further action. Keep responses concise."""

@router.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str):
    await websocket.accept()
    user_dir = get_user_dir(token)
    if not user_dir:
        await websocket.send_text(json.dumps({"type": "error", "content": "Authentication failed."}))
        await websocket.close()
        return

    current_dir = user_dir
    session_history = [{"role": "system", "content": SYSTEM_PROMPT}]
    
    await websocket.send_text(json.dumps({"type": "system", "content": f"Secure DEVPORTAL environment established. Type 'debug net' to run network diagnostics."}))

    def run_cmd(cmd):
        nonlocal current_dir
        if cmd.startswith("cd "):
            target = cmd[3:].strip()
            new_dir = os.path.abspath(os.path.join(current_dir, target))
            if not new_dir.startswith(os.path.abspath(USERS_DIR)): return "Permission denied."
            current_dir = new_dir
            return f"Directory changed to {current_dir}"
        else:
            try:
                result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=current_dir, timeout=25)
                out = result.stdout + result.stderr
                return out if out else "[Executed successfully with no output]"
            except Exception as e: return f"[Execution Error: {str(e)}]"

    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            command = payload.get("command", "").strip()
            if not command: continue
            
            if command.lower() == "debug net":
                debug_info = "=== NETWORK DIAGNOSTICS ===\n"
                for k, v in os.environ.items():
                    if 'proxy' in k.lower(): debug_info += f"   {k} = {v}\n"
                debug_info += f"\n2. Python internal getproxies():\n   {urllib.request.getproxies()}\n"
                await websocket.send_text(json.dumps({"type": "output", "content": debug_info}))
                continue
                
            if command.lower().startswith("ai "):
                prompt = command[3:].strip()
                await websocket.send_text(json.dumps({"type": "ai_status", "status": "thinking"}))
                session_history.append({"role": "user", "content": prompt})
                if len(session_history) > 21: session_history = [session_history[0]] + session_history[-20:]
                
                for _ in range(5):
                    ai_response = await ask_openrouter(session_history)
                    if "ERROR:" in ai_response:
                        await websocket.send_text(json.dumps({"type": "error", "content": ai_response}))
                        session_history.pop() 
                        break
                        
                    match = re.search(r'<EXEC>(.*?)</EXEC>', ai_response, re.DOTALL)
                    if match:
                        exec_cmd = match.group(1).strip()
                        text_before = ai_response[:match.start()].strip()
                        
                        full_ai_message = ""
                        if text_before:
                            await websocket.send_text(json.dumps({"type": "ai", "content": text_before}))
                            full_ai_message += text_before + "\n"
                            
                        await websocket.send_text(json.dumps({"type": "system", "content": f"⚙️ AI is running: {exec_cmd}"}))
                        await websocket.send_text(json.dumps({"type": "ai_status", "status": f"executing..."}))
                        
                        full_ai_message += f"<EXEC>{exec_cmd}</EXEC>"
                        session_history.append({"role": "assistant", "content": full_ai_message})
                        
                        output = run_cmd(exec_cmd)
                        await websocket.send_text(json.dumps({"type": "output", "content": output}))
                        session_history.append({"role": "user", "content": f"Command Output:\n{output}"})
                        await asyncio.sleep(1)
                    else:
                        await websocket.send_text(json.dumps({"type": "ai", "content": ai_response}))
                        session_history.append({"role": "assistant", "content": ai_response})
                        break
                await websocket.send_text(json.dumps({"type": "ai_status", "status": "idle"}))
            else:
                if command.lower() == "clear":
                    await websocket.send_text(json.dumps({"type": "clear", "content": ""}))
                else:
                    output = run_cmd(command)
                    await websocket.send_text(json.dumps({"type": "output", "content": output}))
    except WebSocketDisconnect:
        pass
        