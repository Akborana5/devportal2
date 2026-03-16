// static/js/terminal.js

let ws;
const frames = ["/", "-", "\\", "|"];
let frameIdx = 0;
let loaderInterval;

function initTerminal() {
    if (!currentToken) return;

    // Update the command prompt with the username
    const promptEl = document.getElementById('prompt-text');
    if(promptEl) promptEl.innerText = `${currentUser}@devportal:~$`;

    // Establish WebSocket connection
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws/${currentToken}`);

    ws.onmessage = (e) => {
        const data = JSON.parse(e.data);
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

    ws.onclose = () => {
        const out = document.getElementById('terminal-output');
        if(out) {
            const div = document.createElement('div');
            div.className = `term-msg error`;
            div.textContent = `[Connection Lost. Please refresh the page.]`;
            out.appendChild(div);
        }
    };

    // Handle Input - MOBILE OPTIMIZED
    const input = document.getElementById('terminal-input');
    if (input) {
        const newInput = input.cloneNode(true);
        input.parentNode.replaceChild(newInput, input);
        
        // 1. Block the physical 'Enter' key from creating new lines on mobile
        newInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.keyCode === 13) {
                e.preventDefault(); 
            }
        });
        
        // 2. Actually execute the command on keyup (much more reliable on Android)
        newInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter' || e.keyCode === 13) {
                e.preventDefault();
                
                const cmd = newInput.value.trim();
                if (cmd && ws.readyState === WebSocket.OPEN) {
                    // Echo user command to screen
                    const div = document.createElement('div');
                    div.className = 'term-msg user';
                    div.textContent = `${document.getElementById('prompt-text').innerText} ${cmd}`;
                    document.getElementById('terminal-output').appendChild(div);
                    
                    // Send to backend
                    ws.send(JSON.stringify({ command: cmd }));
                    newInput.value = '';
                }
            }
        });
    }
}

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
