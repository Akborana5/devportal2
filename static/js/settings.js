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
    if (theme === 'light') {
        document.documentElement.style.setProperty('--bg-base', '#f5f5f5');
        document.documentElement.style.setProperty('--bg-surface', '#ffffff');
        document.documentElement.style.setProperty('--text-primary', '#111111');
        document.documentElement.style.setProperty('--text-secondary', '#555555');
        document.documentElement.style.setProperty('--glass-border', '1px solid rgba(0,0,0,0.1)');
        document.documentElement.style.setProperty('--panel-bg', 'rgba(255,255,255,0.8)');
    } else {
        // Revert to Dark
        document.documentElement.style.setProperty('--bg-base', '#050505');
        document.documentElement.style.setProperty('--bg-surface', '#0a0a0a');
        document.documentElement.style.setProperty('--text-primary', '#ffffff');
        document.documentElement.style.setProperty('--text-secondary', '#a0a0a0');
        document.documentElement.style.setProperty('--glass-border', '1px solid rgba(255, 255, 255, 0.05)');
        document.documentElement.style.setProperty('--panel-bg', 'rgba(20, 20, 20, 0.6)');
    }

    // 3. Apply Editor Settings
    const editorFont = document.getElementById('setting-editor-font').value;
    const editorSize = document.getElementById('setting-editor-font-size').value;
    document.documentElement.style.setProperty('--font-mono', editorFont);
    
    if (typeof editor !== 'undefined' && editor) {
        editor.setOptions({
            fontFamily: editorFont,
            fontSize: editorSize
        });
    }

    // 4. Apply Terminal Settings
    const termSize = document.getElementById('setting-terminal-font-size').value;
    const termOutput = document.getElementById('terminal-output');
    if (termOutput) {
        termOutput.style.fontSize = termSize;
    }
}

async function saveSettings() {
    const btn = document.getElementById('save-settings-btn');
    btn.innerText = "Saving...";
    
    const settingsData = {
        theme: document.getElementById('setting-theme-mode').value,
        accent: currentAccentColor,
        editorFont: document.getElementById('setting-editor-font').value,
        editorSize: document.getElementById('setting-editor-font-size').value,
        termSize: document.getElementById('setting-terminal-font-size').value
    };

    try {
        const res = await fetch('/api/settings', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({token: currentToken, settings: settingsData})
        });
        
        const data = await res.json();
        if(data.success) {
            btn.innerText = "✓ Saved";
            setTimeout(() => btn.innerText = "Save Settings", 2000);
        } else {
            showToast("Failed to save settings.");
            btn.innerText = "Save Settings";
        }
    } catch (e) {
        showToast("Network error.");
        btn.innerText = "Save Settings";
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

    // In a full app, we would fetch the user's specific settings from the DB here via a GET route.
    // For now, we apply the default UI state so everything looks perfect immediately.
    previewSettings();
}
