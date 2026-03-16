// static/js/dashboard.js

async function initDashboard() {
    refreshDashboardFiles();
    simulateSystemStatus();
}

async function refreshDashboardFiles() {
    if (!currentToken) return;
    
    const list = document.getElementById('dash-recent-files');
    if(!list) return;

    try {
        // Reuse the files API route we built for the editor!
        const res = await fetch('/api/files', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({token: currentToken}) 
        });
        const data = await res.json();
        
        list.innerHTML = '';
        
        if (data.files && data.files.length > 0) {
            // Get up to 4 files to display in the widget
            const recentFiles = data.files.slice(0, 4);
            
            recentFiles.forEach(f => {
                const ext = f.split('.').pop();
                let icon = "📄";
                if(ext === 'py') icon = "🐍";
                else if(ext === 'js') icon = "⚡";
                else if(ext === 'html') icon = "🌐";
                else if(ext === 'css') icon = "🎨";

                const html = `
                    <div class="recent-file-item" onclick="openFileFromDashboard('${f}')">
                        <div class="recent-file-icon">${icon}</div>
                        <div class="recent-file-info">
                            <h4>${f}</h4>
                            <p>Workspace File</p>
                        </div>
                    </div>
                `;
                list.insertAdjacentHTML('beforeend', html);
            });
        } else {
            list.innerHTML = `<div style="color: var(--text-muted); font-size: 12px; text-align: center; padding: 20px 0;">No files found in workspace.</div>`;
        }
    } catch(e) {
        console.error("Dashboard failed to load files", e);
    }
}

// Navigates directly to the editor and opens the selected file
function openFileFromDashboard(filename) {
    // Switch to Editor view
    switchView('editor-view', document.querySelectorAll('.nav-item')[2]);
    // Call the openFile function from editor.js
    if (typeof openFile === "function") {
        openFile(filename);
    }
}

// Simulates slight fluctuations in CPU/RAM to make the dashboard feel alive
function simulateSystemStatus() {
    setInterval(() => {
        const cpuEl = document.getElementById('stat-cpu');
        const cpuBar = document.getElementById('bar-cpu');
        if(cpuEl && cpuBar) {
            const val = Math.floor(Math.random() * (25 - 5 + 1) + 5); // Random between 5-25%
            cpuEl.innerText = `${val}%`;
            cpuBar.style.width = `${val}%`;
        }

        const ramEl = document.getElementById('stat-ram');
        const ramBar = document.getElementById('bar-ram');
        if(ramEl && ramBar) {
            const val = Math.floor(Math.random() * (45 - 30 + 1) + 30); // Random between 30-45%
            ramEl.innerText = `${val}%`;
            ramBar.style.width = `${val}%`;
        }
    }, 3000); // Update every 3 seconds
}
