// static/js/settings.js

let currentAccentColor = '#ffc107';

function switchSettingsPanel(panelId, element) {
    // Hide all panels
    document.querySelectorAll('.settings-section').forEach(p => p.classList.remove('active'));
    // Show target
    document.getElementById(panelId).classList.add('active');
    
    // Update tabs
    document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
    element.classList.add('active');
}

function setAccentColor(hexCode, element) {
    currentAccentColor = hexCode;
    
    // Update swatches visually
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
    if(element) {
        element.classList.add('active');
    }
    
    // Update the custom color picker input to match if needed
    document.getElementById('custom-accent-color').value = hexCode;
    
    previewSettings();
}

function previewSettings() {
    // 1. Apply Accent Color
    document.documentElement.style.setProperty('--accent-main', currentAccentColor);
    // Generate a softer glow color based on the hex (simplified logic)
    document.documentElement.style.setProperty('--accent-glow', currentAccentColor + '40'); 
    
    // 2. Apply Theme (Light/Dark)
    const theme = document.getElementById('setting-theme-mode').value;
    const isLight = (theme === 'light');

    if (isLight) {
        document.documentElement.classList.add('light-theme');
        localStorage.setItem('theme', 'light');
        const themeIcon = document.getElementById('theme-icon');
        if (themeIcon) {
            themeIcon.classList.remove('fa-moon');
            themeIcon.classList.add('fa-sun');
        }
    } else {
        document.documentElement.classList.remove('light-theme');
        localStorage.setItem('theme', 'dark');
        const themeIcon = document.getElementById('theme-icon');
        if (themeIcon) {
            themeIcon.classList.remove('fa-sun');
            themeIcon.classList.add('fa-moon');
        }
    }

    // 3. Apply Custom Background Image
    const bgUrl = document.getElementById('setting-bg-url').value.trim();
    if (bgUrl) {
        document.body.style.backgroundImage = `url('${bgUrl}')`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
    } else {
        document.body.style.backgroundImage = 'none';
    }

    // 4. Apply Editor Settings
    const editorFont = document.getElementById('setting-editor-font').value;
    const editorSize = document.getElementById('setting-editor-font-size').value;
    const showMinimap = document.getElementById('setting-editor-minimap').value === "true";
    document.documentElement.style.setProperty('--font-mono', editorFont);
    
    if (typeof editor !== 'undefined' && editor) {
        editor.setOptions({
            fontFamily: editorFont,
            fontSize: editorSize,
            showPrintMargin: showMinimap
        });
        editor.setTheme(isLight ? "ace/theme/github" : "ace/theme/tomorrow_night_eighties");
    }

    // 5. Apply Terminal Settings
    const termSize = document.getElementById('setting-terminal-font-size').value;
    const termOutput = document.getElementById('terminal-output');
    if (termOutput) {
        termOutput.style.fontSize = termSize;
    }
}

async function saveSettings() {
    const btn = document.getElementById('save-settings-btn');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    
    // Apply them immediately
    previewSettings();

    const settingsData = {
        theme: document.getElementById('setting-theme-mode').value,
        accent: currentAccentColor,
        bgUrl: document.getElementById('setting-bg-url').value,
        editorFont: document.getElementById('setting-editor-font').value,
        editorSize: document.getElementById('setting-editor-font-size').value,
        editorMinimap: document.getElementById('setting-editor-minimap').value,
        termSize: document.getElementById('setting-terminal-font-size').value,
        openrouterKey: document.getElementById('setting-openrouter-key').value,
        nvidiaKey: document.getElementById('setting-nvidia-key').value,
        aiModel: document.getElementById('setting-ai-model').value,
        aiPrompt: document.getElementById('setting-ai-prompt').value
    };

    try {
        const res = await fetch('/api/settings', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({token: currentToken, settings: settingsData})
        });
        
        const data = await res.json();
        if(data.success) {
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Saved';
            showToast("Settings saved successfully", "success");
            setTimeout(() => btn.innerHTML = "Save Settings", 2000);
        } else {
            showToast("Failed to save settings.", "error");
            btn.innerHTML = "Save Settings";
        }
    } catch (e) {
        showToast("Network error.", "error");
        btn.innerHTML = "Save Settings";
    }
}

// Called on login/boot
async function loadSettings() {
    if(!currentUser) return;
    
    // Set username in profile
    const usernameInput = document.getElementById('setting-username');
    const avatar = document.getElementById('profile-avatar');
    if(usernameInput) usernameInput.value = currentUser;
    if(avatar) avatar.innerText = currentUser.charAt(0).toUpperCase();

    // Check localStorage for theme to sync the select box
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.getElementById('setting-theme-mode').value = savedTheme;
    }

    previewSettings();
}

function updateAIModelBadge() {
    const el = document.getElementById('setting-ai-model');
    const badge = document.getElementById('current-ai-model');
    if(el && badge) {
        badge.innerText = el.options[el.selectedIndex].text;
    }
}

async function syncHuggingFace() {
    const btn = document.getElementById('hf-sync-btn');
    const status = document.getElementById('sync-status');

    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Syncing... Please wait.';
    btn.disabled = true;
    status.innerText = "Executing hf sync. This may take a minute...";

    try {
        const res = await fetch('/api/sync/hf', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({token: currentToken})
        });
        const data = await res.json();

        if(data.success) {
            showToast("Successfully synced to Hugging Face!", "success");
            status.innerText = data.message;
            status.style.color = "var(--success-color)";
        } else {
            showToast("Failed to sync.", "error");
            status.innerText = data.error;
            status.style.color = "var(--error-color)";
        }
    } catch(e) {
        showToast("Network error during sync.", "error");
        status.innerText = "Network error occurred.";
        status.style.color = "var(--error-color)";
    } finally {
        btn.innerHTML = '<i class="fa-solid fa-rotate"></i> Sync Data to Hugging Face Bucket';
        btn.disabled = false;
    }
}

function downloadWorkspace() {
    if (!currentToken) return;
    window.location.href = `/api/export/${currentToken}`;
}

async function importGithubRepo() {
    if (!currentToken) return;

    const url = prompt("Enter a public GitHub repository URL to clone into your workspace (e.g., https://github.com/user/repo):");
    if (!url) return;

    showToast("Cloning repository... this may take a moment.", "info");

    try {
        const res = await fetch('/api/import/github', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({token: currentToken, github_url: url})
        });

        const data = await res.json();
        if (data.success) {
            showToast("Repository imported successfully!", "success");
            // If they are on the editor view, reload files
            if (typeof loadFiles !== 'undefined') loadFiles();
        } else {
            showToast("Failed to import: " + (data.error || "Unknown error"), "error");
        }
    } catch(e) {
        showToast("Network error during import.", "error");
    }
}
