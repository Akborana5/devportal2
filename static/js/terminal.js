// static/js/terminal.js

let ws;
const frames = ["/", "-", "\\", "|"];
let frameIdx = 0;
let loaderInterval;

function initTerminal() {
    if (!currentToken) {
        console.error("[DEBUG] initTerminal failed: No currentToken found.");
        return;
    }

    console.log("[DEBUG] Initializing Terminal WebSocket...");

    // Update the command prompt with the username
    const promptEl = document.getElementById('prompt-text');
    if(promptEl) promptEl.innerText = `${currentUser}@devportal:~$`;

    // Establish WebSocket connection
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws/${currentToken}`);

    ws.onopen = () => console.log("[DEBUG] WebSocket Connection OPENED.");

    ws.onmessage = (e) => {
        const data = JSON.parse(e.data);
        console.log("[DEBUG] WS Message Received:", data.type);
        
        const out = document.getElementById('terminal-output');
        const aiChat = document.getElementById('ai-mini-chat');
        
        if (data.type === 'clear') {
            out.innerHTML = '';
        } else if (data.type === 'ai_status') {
            if (data.status === 'idle') {
                stopLoader();
            } else {
                startLoader(data.status);
            }
        } else {
            // Append message to main terminal
            const div = document.createElement('div');
            div.className = `term-msg ${data.type}`;
            div.textContent = data.content;
            out.appendChild(div);
            out.scrollTop = out.scrollHeight;

            // If it's an AI message, also show it in the shiny side panel
            if (data.type === 'ai' && aiChat) {
                const aiDiv = document.createElement('div');
                aiDiv.style.marginBottom = '10px';
                aiDiv.style.padding = '10px';
                aiDiv.style.background = 'rgba(0, 230, 118, 0.1)';
                aiDiv.style.borderLeft = '3px solid var(--success-color)';
                aiDiv.style.borderRadius = '4px';
                aiDiv.style.color = 'var(--text-primary)';
                aiDiv.textContent = data.content;
                aiChat.appendChild(aiDiv);
                aiChat.scrollTop = aiChat.scrollHeight;
            }
        }
    };

    ws.onerror = (err) => console.error("[DEBUG] WebSocket Error:", err);

    ws.onclose = () => {
        console.warn("[DEBUG] WebSocket CLOSED.");
        const out = document.getElementById('terminal-output');
        if(out) {
            const div = document.createElement('div');
            div.className = `term-msg error`;
            div.textContent = `[Connection Lost. Please refresh the page.]`;
            out.appendChild(div);
        }
    };
}

// ⚡ THE BULLETPROOF SEND FUNCTION ⚡
// This is triggered by both the mobile keyboard "Enter/Go" and the physical Send button
window.sendTerminalCommand = function() {
    const input = document.getElementById('terminal-input');
    if (!input) return;

    const cmd = input.value.trim();
    console.log("[DEBUG] Attempting to send command:", cmd);

    if (!cmd) {
        console.log("[DEBUG] Command is empty. Ignoring.");
        return;
    }

    if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.error("[DEBUG] Cannot send. WebSocket is not open! State:", ws ? ws.readyState : "Undefined");
        alert("Terminal disconnected. Please refresh the page.");
        return;
    }

    console.log("[DEBUG] Sending command to server...");
    
    // Echo user command to screen
    const div = document.createElement('div');
    div.className = 'term-msg user';
    div.textContent = `${document.getElementById('prompt-text').innerText} ${cmd}`;
    document.getElementById('terminal-output').appendChild(div);
    
    // Send to backend
    ws.send(JSON.stringify({ command: cmd }));
    
    // Clear input and keep focus
    input.value = '';
    // Optional: Only refocus if not on a very small mobile screen to prevent keyboard jumping
    if (window.innerWidth > 768) {
        input.focus(); 
    }
};

// Loader Animation Functions
function startLoader(statusText) {
    const loader = document.getElementById('ai-loader');
    if(loader) {
        loader.style.display = 'block';
        loaderInterval = setInterval(() => {
            document.getElementById('spinner').innerText = frames[frameIdx];
            frameIdx = (frameIdx + 1) % frames.length;
        }, 100);
    }
}

function stopLoader() {
    const loader = document.getElementById('ai-loader');
    if(loader) {
        loader.style.display = 'none';
        clearInterval(loaderInterval);
    }
}

// Quick Command Button Logic
function insertCmd(cmd) {
    const input = document.getElementById('terminal-input');
    if (input) {
        input.value = cmd;
        input.focus();
    }
}
