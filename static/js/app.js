// static/js/app.js
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
        if(window.innerWidth <= 768) {
             document.getElementById('sidebar').classList.remove('open');
        }
    }
}

// Theme toggling logic
function toggleTheme() {
    const root = document.documentElement;
    const isLight = root.classList.toggle('light-theme');
    const themeIcon = document.getElementById('theme-icon');
    
    if (isLight) {
        localStorage.setItem('theme', 'light');
        themeIcon.classList.remove('fa-moon');
        themeIcon.classList.add('fa-sun');
    } else {
        localStorage.setItem('theme', 'dark');
        themeIcon.classList.remove('fa-sun');
        themeIcon.classList.add('fa-moon');
    }

    // Refresh ace editors if they exist
    if (window.editor) {
        window.editor.setTheme(isLight ? "ace/theme/github" : "ace/theme/monokai");
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
