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
