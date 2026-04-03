function switchView(viewId, navItem) {
    // Hide all views
    document.querySelectorAll('.view-container').forEach(el => el.classList.remove('active'));
    // Show selected view
    document.getElementById(viewId).classList.add('active');

    // Update nav active state
    if (navItem) {
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        navItem.classList.add('active');

        // Close mobile sidebar
        // Load projects if switching to projects view
        if (viewId === 'projects-view') loadPublishedProjects();
        if (viewId === 'ai-chat-view') loadAIChatHistory();
        if (viewId === 'apps-view') checkGithubStatus();

        if(window.innerWidth <= 768) {
             document.getElementById('sidebar').classList.remove('open');
        }
    }
}

// Fix app.js toggleTheme to sync with settings page
window.toggleTheme = function() {
    const root = document.documentElement;
    const isLight = root.classList.toggle('light-theme');
    const themeIcon = document.getElementById('theme-icon');
    
    if (isLight) {
        localStorage.setItem('theme', 'light');
        if (themeIcon) {
            themeIcon.classList.remove('fa-moon');
            themeIcon.classList.add('fa-sun');
        }
    } else {
        localStorage.setItem('theme', 'dark');
        if (themeIcon) {
            themeIcon.classList.remove('fa-sun');
            themeIcon.classList.add('fa-moon');
        }
    }

    // Refresh ace editors if they exist
    if (typeof editor !== 'undefined' && editor) {
        editor.setTheme(isLight ? "ace/theme/github" : "ace/theme/tomorrow_night_eighties");
    }

    // Sync settings dropdown if it exists
    const settingsSelect = document.getElementById('setting-theme-mode');
    if (settingsSelect) {
        settingsSelect.value = isLight ? 'light' : 'dark';
    }
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    const themeIcon = document.getElementById('theme-icon');
    if (savedTheme === 'light') {
        document.documentElement.classList.add('light-theme');
        if (themeIcon) {
            themeIcon.classList.remove('fa-moon');
            themeIcon.classList.add('fa-sun');
        }
    }
}

// Initialize things on load
document.addEventListener('DOMContentLoaded', () => {
    loadTheme();

    // Configure marked.js if available
    if (typeof marked !== 'undefined') {
        marked.setOptions({
            highlight: function(code, lang) {
                if (typeof hljs !== 'undefined') {
                    const language = hljs.getLanguage(lang) ? lang : 'plaintext';
                    return hljs.highlight(code, { language }).value;
                }
                return code;
            },
            breaks: true,
            gfm: true
        });
    }
});

// Universal Toast System
function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconClass = 'fa-info-circle';
    let color = 'var(--info-color)';
    if (type === 'success') { iconClass = 'fa-check-circle'; color = 'var(--success-color)'; }
    if (type === 'error') { iconClass = 'fa-exclamation-circle'; color = 'var(--error-color)'; }
    if (type === 'warning') { iconClass = 'fa-exclamation-triangle'; color = 'var(--accent-main)'; }

    toast.style.cssText = `
        background: var(--bg-surface);
        color: var(--text-primary);
        border: 1px solid var(--border-color);
        border-left: 4px solid ${color};
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: var(--shadow-md);
        display: flex;
        align-items: center;
        gap: 12px;
        transform: translateX(120%);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        min-width: 250px;
        backdrop-filter: var(--backdrop-blur);
    `;

    toast.innerHTML = `<i class="fas ${iconClass}" style="color: ${color}; font-size: 1.2rem;"></i><span>${message}</span>`;
    container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
        toast.style.transform = 'translateX(0)';
    });

    // Auto remove
    setTimeout(() => {
        toast.style.transform = 'translateX(120%)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Override window.alert globally
window.alert = function(msg) {
    showToast(msg, 'info');
};

// AI Chatbot Logic
let aiChatHistory = [];

async function sendChatMessage() {
    const inputEl = document.getElementById('ai-chat-input');
    const msg = inputEl.value.trim();
    if (!msg || !currentToken) return;

    inputEl.value = '';

    // Add user message to UI (Not markdown parsed)
    appendChatMsg('user', msg);

    // Create assistant bubble placeholder
    const bubbleId = 'ai-msg-' + Date.now();
    appendChatMsg('system', '<i class="fa-solid fa-spinner fa-spin"></i> Thinking...', bubbleId);

    // Get settings
    const settingsReq = await fetch('/api/settings/get', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({token: currentToken})
    }).catch(() => ({}));

    let settings = {};
    if (settingsReq.ok) {
        const res = await settingsReq.json();
        if (res.settings) settings = res.settings;
    }

    const payload = {
        token: currentToken,
        message: msg,
        history: aiChatHistory,
        model: settings.aiModel,
        openrouter_key: settings.openrouterKey,
        nvidia_key: settings.nvidiaKey,
        system_prompt: settings.aiPrompt
    };

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const bubble = document.getElementById(bubbleId);

        // Handle streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullReply = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            fullReply += chunk;

            // Render markdown to HTML safely
            let rawHtml = marked.parse(fullReply);
            bubble.innerHTML = DOMPurify.sanitize(rawHtml);

            // Scroll to bottom
            const historyDiv = document.getElementById('ai-chat-history');
            historyDiv.scrollTop = historyDiv.scrollHeight;
        }

        // Save to history
        aiChatHistory.push({role: "user", content: msg});
        aiChatHistory.push({role: "assistant", content: fullReply});

    } catch (e) {
        document.getElementById(bubbleId).innerHTML = '<span style="color:var(--error-color)">Error reaching AI: ' + e.message + '</span>';
    }
}

function appendChatMsg(role, content, bubbleId = '') {
    const historyDiv = document.getElementById('ai-chat-history');
    const wrapper = document.createElement('div');
    wrapper.className = `chat-msg ${role}`;

    const avatar = role === 'user'
        ? `<div class="chat-avatar" style="background: var(--text-secondary); color: #000;"><i class="fa-solid fa-user"></i></div>`
        : `<div class="chat-avatar" style="background: var(--accent-main); color: #000;"><i class="fa-solid fa-robot"></i></div>`;

    wrapper.innerHTML = `
        ${avatar}
        <div class="chat-bubble markdown-body" ${bubbleId ? `id="${bubbleId}"` : ''}>
            ${content}
        </div>
    `;
    historyDiv.appendChild(wrapper);
    historyDiv.scrollTop = historyDiv.scrollHeight;
}

function handleChatInput(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
    }
}

async function loadAIChatHistory() {
    if (!currentToken) return;

    try {
        const res = await fetch('/api/chat/history', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({token: currentToken})
        });

        const data = await res.json();
        if (data.history) {
            aiChatHistory = data.history;
            const historyDiv = document.getElementById('ai-chat-history');

            // Clear default messages
            historyDiv.innerHTML = '';

            if (data.history.length === 0) {
                 appendChatMsg('system', 'Hello! I am your AI coding assistant. How can I help you build today?');
            } else {
                 data.history.forEach(msg => {
                      if (msg.role === 'system') return; // Hide system prompt from UI

                      let rawHtml = msg.role === 'assistant' ? marked.parse(msg.content) : msg.content;
                      let safeHtml = msg.role === 'assistant' ? DOMPurify.sanitize(rawHtml) : msg.content;
                      appendChatMsg(msg.role, safeHtml);
                 });
            }
        }
    } catch(e) {
        console.error("Failed to load chat history.", e);
    }
}

async function clearAIChatHistory() {
    if (!confirm("Are you sure you want to clear your chat history?")) return;

    try {
        const res = await fetch('/api/chat/history/clear', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({token: currentToken})
        });

        const data = await res.json();
        if (data.success) {
            aiChatHistory = [];
            const historyDiv = document.getElementById('ai-chat-history');
            historyDiv.innerHTML = '';
            appendChatMsg('system', 'Chat history cleared. How can I help you build today?');
        }
    } catch(e) {
        showToast("Failed to clear chat history", "error");
    }
}

// Connected Apps functionality
window.addEventListener('message', async (event) => {
    if (event.data === 'github_oauth_success') {
        showToast("GitHub connected successfully!", "success");
        checkGithubStatus();
    }
});

function connectGithub() {
    if (!currentToken) return;
    const width = 600, height = 700;
    const left = (screen.width - width) / 2;
    const top = (screen.height - height) / 2;
    window.open(`/api/github/login?user_token=${currentToken}`, 'github_oauth', `width=${width},height=${height},top=${top},left=${left}`);
}

async function checkGithubStatus() {
    if (!currentToken) return;
    try {
        const res = await fetch('/api/github/status', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({token: currentToken})
        });
        const data = await res.json();

        const statusDiv = document.getElementById('github-auth-status');
        const reposSection = document.getElementById('github-repos-section');

        if (data.connected) {
            statusDiv.innerHTML = '<span style="color: var(--success-color); font-weight: bold;"><i class="fa-solid fa-check-circle"></i> Connected</span>';
            reposSection.style.display = 'block';
            fetchGithubRepos();
        } else {
            statusDiv.innerHTML = '<button class="editor-btn primary" onclick="connectGithub()">Connect GitHub</button>';
            reposSection.style.display = 'none';
        }
    } catch(e) {
        console.error(e);
    }
}

async function fetchGithubRepos() {
    const list = document.getElementById('github-repos-list');
    list.innerHTML = '<p style="color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading repositories...</p>';

    try {
        const res = await fetch('/api/github/repos', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({token: currentToken})
        });
        const data = await res.json();

        if (data.error) {
            list.innerHTML = `<p style="color: var(--error-color);">${data.error}</p>`;
            return;
        }

        list.innerHTML = '';
        if (data.repos.length === 0) {
            list.innerHTML = '<p style="color: var(--text-muted);">No repositories found.</p>';
            return;
        }

        data.repos.forEach(repo => {
            const isPrivate = repo.private ? '<span style="font-size: 10px; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; margin-left: 10px;"><i class="fa-solid fa-lock"></i> Private</span>' : '';

            list.innerHTML += `
                <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); padding: 15px; border-radius: 8px; display: flex; flex-direction: column; justify-content: space-between;">
                    <div>
                        <h4 style="margin: 0 0 10px 0; color: var(--accent-main); display: flex; align-items: center; word-break: break-all;">
                            ${repo.name} ${isPrivate}
                        </h4>
                        <p style="margin: 0 0 15px 0; font-size: 13px; color: var(--text-secondary); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; height: 36px;">
                            ${repo.description || 'No description available.'}
                        </p>
                    </div>
                    <button class="editor-btn" style="width: 100%; justify-content: center;" onclick="importOauthRepo('${repo.clone_url}')">
                        <i class="fa-solid fa-download"></i> Import
                    </button>
                </div>
            `;
        });
    } catch(e) {
        list.innerHTML = `<p style="color: var(--error-color);">Error fetching repositories.</p>`;
    }
}

async function importOauthRepo(cloneUrl) {
    document.getElementById('import-loading-overlay').style.display = 'flex';

    try {
        const res = await fetch('/api/github/import_oauth', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({token: currentToken, github_url: cloneUrl})
        });

        const data = await res.json();
        if (data.success) {
            showToast(data.message, "success");
            if (typeof loadFiles !== 'undefined') loadFiles();
        } else {
            showToast("Failed to import: " + (data.error || "Unknown error"), "error");
        }
    } catch(e) {
        showToast("Network error during import.", "error");
    } finally {
        document.getElementById('import-loading-overlay').style.display = 'none';
    }
}
