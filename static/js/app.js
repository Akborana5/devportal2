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
