// static/js/terminal.js

let ws;
const frames = ["/", "-", "\\", "|"];
let frameIdx = 0;
let loaderInterval;

// ⚡ FIX: Force functions into global window scope
window.initTerminal = function() {
    if (!currentToken) return;

    const promptEl = document.getElementById('prompt-text');
    if(promptEl) promptEl.innerText = `${currentUser}@devportal:~$`;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws/${currentToken}`);

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
        const out = document.getElementById('terminal-output');
        if(out) {
            const div = document.createElement('div');
            div.className = `term-msg error`;
            div.textContent = `[Connection Lost. Please refresh the page.]`;
            out.appendChild(div);
        }
    };
};

window.sendTerminalCommand = function() {
    const input = document.getElementById('terminal-input');
    if (!input) return;

    const cmd = input.value.trim();
    if (!cmd) return;

    if (!ws || ws.readyState !== WebSocket.OPEN) {
        alert("Terminal disconnected. Please refresh the page.");
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
