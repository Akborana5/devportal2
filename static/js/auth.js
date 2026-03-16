// static/js/auth.js

let currentToken = null;
let currentUser = "";

// Safely check local storage
try {
    currentToken = localStorage.getItem("devportal_token");
    currentUser = localStorage.getItem("devportal_user");
} catch(e) {
    console.warn("Local storage is blocked.");
}

window.onload = () => {
    if(currentToken) {
        // Bypass login screen if already authenticated
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('app-layout').style.display = 'flex';
        if (typeof initTerminal === "function") initTerminal(); // Boot Terminal WebSocket
        if (typeof initEditor === "function") initEditor();
    }
};

function toggleAuthMode(mode) {
    const btn = document.querySelector('.auth-btn');
    const switchText = document.querySelector('.auth-switch');
    
    if(mode === 'register') {
        btn.innerHTML = `Create Account <span>→</span>`;
        btn.setAttribute('onclick', "handleAuth('register')");
        switchText.innerHTML = `Already have an account? <a onclick="toggleAuthMode('login')">Sign In</a>`;
    } else {
        btn.innerHTML = `Sign In <span>→</span>`;
        btn.setAttribute('onclick', "handleAuth('login')");
        switchText.innerHTML = `Don't have an account? <a onclick="toggleAuthMode('register')">Create Account</a>`;
    }
}

async function handleAuth(action) {
    const errDiv = document.getElementById('auth-error');
    errDiv.innerText = "Authenticating...";
    errDiv.style.color = "var(--accent-main)";

    try {
        const u = document.getElementById('auth-username').value.trim();
        const p = document.getElementById('auth-password').value.trim();
        
        if (!u || !p) {
            errDiv.style.color = "var(--error-color)";
            errDiv.innerText = "Credentials cannot be empty.";
            return;
        }

        const res = await fetch(`/api/${action}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username: u, password: p})
        });
        
        const data = await res.json();
        
        if(data.success) {
            try { 
                localStorage.setItem("devportal_token", data.token);
                localStorage.setItem("devportal_user", data.username);
            } catch(e) {}
            
            currentToken = data.token;
            currentUser = data.username;
            
            // Hide auth, show app
            document.getElementById('auth-screen').style.display = 'none';
            document.getElementById('app-layout').style.display = 'flex';
            
            if (typeof initTerminal === "function") initTerminal();
            if (typeof initEditor === "function") initEditor();
        } else {
            errDiv.style.color = "var(--error-color)";
            errDiv.innerText = data.error;
        }
    } catch (err) {
        errDiv.style.color = "var(--error-color)";
        errDiv.innerText = "Network Error: Cannot reach server.";
    }
}

function logout() { 
    try { 
        localStorage.removeItem("devportal_token"); 
        localStorage.removeItem("devportal_user");
    } catch(e){} 
    location.reload(); 
}