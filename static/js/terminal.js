// static/js/terminal.js

let ws;
const frames = ["/", "-", "\\", "|"];
let frameIdx = 0;
let loaderInterval;

function updateConnectionStatus(status) {
    const dot = document.getElementById('connection-dot');
    const text = document.getElementById('connection-text');
    if (!dot || !text) return;

    if (status === 'connected') {
        dot.style.background = 'var(--success-color)';
        dot.style.boxShadow = '0 0 8px var(--success-color)';
        text.innerText = 'Connected';
        text.style.color = 'var(--success-color)';
    } else if (status === 'disconnected') {
        dot.style.background = 'var(--error-color)';
        dot.style.boxShadow = '0 0 8px var(--error-color)';
        text.innerText = 'Disconnected';
        text.style.color = 'var(--error-color)';
    } else if (status === 'connecting') {
        dot.style.background = 'var(--accent-main)';
        dot.style.boxShadow = '0 0 8px var(--accent-main)';
        text.innerText = 'Connecting...';
        text.style.color = 'var(--accent-main)';
    }
}

// ⚡ FIX: Force functions into global window scope
window.initTerminal = function() {
    if (!currentToken) return;

    const promptEl = document.getElementById('prompt-text');
    if(promptEl) promptEl.innerText = `${currentUser}@devportal:~$`;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    updateConnectionStatus('connecting');

    ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws/${currentToken}`);

    ws.onopen = () => {
        updateConnectionStatus('connected');
        showToast("Terminal connected successfully", "success");
    };

    ws.onmessage = (e) => {
        const data = JSON.parse(e.data);
        const out = document.getElementById('terminal-output');
        const aiChat = document.getElementById('ai-mini-chat');
        
        if (data.type === 'clear') {
            out.innerHTML = '';
        } else if (data.type === 'ai_status') {
            if (data.status === 'idle') window.stopLoader();
            else window.startLoader(data.status);
        } else {
            const div = document.createElement('div');
            div.className = `term-msg ${data.type}`;
            div.textContent = data.content;
            out.appendChild(div);
            out.scrollTop = out.scrollHeight;

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

    ws.onclose = () => {
        updateConnectionStatus('disconnected');
        showToast("Terminal connection lost", "error");
        const out = document.getElementById('terminal-output');
        if(out) {
            const div = document.createElement('div');
            div.className = `term-msg error`;
            div.textContent = `[Connection Lost. Please refresh the page.]`;
            out.appendChild(div);
        }
    };

    ws.onerror = () => {
        updateConnectionStatus('disconnected');
    };
};

window.sendTerminalCommand = function() {
    const input = document.getElementById('terminal-input');
    if (!input) return;

    const cmd = input.value.trim();
    if (!cmd) return;

    if (!ws || ws.readyState !== WebSocket.OPEN) {
        showToast("Terminal disconnected. Please refresh the page.", "error");
        return;
    }

    const div = document.createElement('div');
    div.className = 'term-msg user';
    div.textContent = `${document.getElementById('prompt-text').innerText} ${cmd}`;
    document.getElementById('terminal-output').appendChild(div);
    
    ws.send(JSON.stringify({ command: cmd }));
    input.value = '';
    
    if (window.innerWidth > 768) {
        input.focus(); 
    }
};

window.startLoader = function(statusText) {
    const loader = document.getElementById('ai-loader');
    if(loader) {
        loader.style.display = 'block';
        loaderInterval = setInterval(() => {
            document.getElementById('spinner').innerText = frames[frameIdx];
            frameIdx = (frameIdx + 1) % frames.length;
        }, 100);
    }
};

window.stopLoader = function() {
    const loader = document.getElementById('ai-loader');
    if(loader) {
        loader.style.display = 'none';
        clearInterval(loaderInterval);
    }
};

window.insertCmd = function(cmd) {
    const input = document.getElementById('terminal-input');
    if (input) {
        input.value = cmd;
        input.focus();
    }
};

let ctrlActive = false;

window.toggleTermuxCtrl = function() {
    ctrlActive = !ctrlActive;
    const btn = document.getElementById('termux-ctrl-btn');
    if (ctrlActive) {
        btn.style.background = 'var(--accent-main)';
        btn.style.color = '#000';
    } else {
        btn.style.background = 'rgba(255,193,7,0.1)';
        btn.style.color = 'var(--text-primary)';
    }
    document.getElementById('terminal-input').focus();
};

document.getElementById('terminal-input').addEventListener('keydown', function(e) {
    if (ctrlActive && e.key.length === 1) {
        // e.key is the letter pressed, e.g., 'c'
        const letter = e.key.toUpperCase();

        if (ws && ws.readyState === WebSocket.OPEN) {
            // For Ctrl+C, send \x03
            if (letter === 'C') {
                ws.send(JSON.stringify({ command: '\x03' }));
                showToast("Sent Ctrl+C", "info");
            }
            // For Ctrl+Z, send \x1a
            else if (letter === 'Z') {
                ws.send(JSON.stringify({ command: '\x1a' }));
                showToast("Sent Ctrl+Z", "info");
            }
            // Add other standard mappings if needed
            else {
                 showToast(`Sent Ctrl+${letter}`, "info");
            }
        }

        e.preventDefault(); // Stop the letter from typing
        toggleTermuxCtrl(); // Turn off Ctrl after one use
    }
});

window.sendTerminalKey = function(key) {
    const input = document.getElementById('terminal-input');
    if (!input) return;

    if (key === 'ESC') {
        input.value += '\\e';
    } else if (key === 'TAB') {
        input.value += '\\t';
    } else if (key === 'UP') {
         showToast("Arrow keys not fully supported in this interface yet.", "warning");
    } else if (key === 'DOWN') {
         showToast("Arrow keys not fully supported in this interface yet.", "warning");
    }
    input.focus();
};
