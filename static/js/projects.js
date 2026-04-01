// static/js/projects.js

async function loadPublishedProjects() {
    if(!currentToken) return;

    try {
        const res = await fetch('/api/projects', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({token: currentToken})
        });
        const data = await res.json();

        const grid = document.getElementById('projects-grid');
        if(!grid) return;

        grid.innerHTML = '';

        if (data.projects && data.projects.length > 0) {
            data.projects.forEach(p => {
                const card = document.createElement('div');
                card.style.cssText = `
                    background: rgba(15, 15, 18, 0.7);
                    backdrop-filter: var(--backdrop-blur);
                    border: var(--glass-border);
                    border-radius: 12px;
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                `;

                const date = new Date(p.created_at).toLocaleDateString();
                const url = window.location.origin + p.url;

                card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <h3 style="margin: 0; color: var(--accent-main); font-size: 16px;">${p.name}</h3>
                        <span style="font-size: 11px; color: var(--text-muted);">${date}</span>
                    </div>
                    <div style="font-size: 13px; color: var(--text-secondary); background: rgba(0,0,0,0.3); padding: 8px; border-radius: 6px; word-break: break-all;">
                        <a href="${url}" target="_blank" style="color: #3b82f6; text-decoration: none;">${url}</a>
                    </div>
                    <div style="margin-top: 10px; display: flex; gap: 10px;">
                        <button class="editor-btn" onclick="window.open('${url}', '_blank')" style="flex: 1;"><i class="fa-solid fa-external-link"></i> Visit</button>
                        <button class="editor-btn success" onclick="publishCurrentWorkspace('${p.name}')" style="flex: 1;"><i class="fa-solid fa-arrows-rotate"></i> Update Code</button>
                    </div>
                `;
                grid.appendChild(card);
            });
        } else {
            grid.innerHTML = `
                <div style="text-align: center; color: var(--text-muted); grid-column: 1 / -1; padding: 40px; background: rgba(15,15,18,0.5); border-radius: 12px; border: var(--glass-border);">
                    <i class="fa-solid fa-box-open" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i>
                    <p>No published projects yet.</p>
                    <p style="font-size: 12px;">Click 'Publish Current Workspace' to make your code live!</p>
                </div>
            `;
        }
    } catch (e) {
        showToast("Error loading projects.", "error");
    }
}

async function publishCurrentWorkspace(existingName = null) {
    let name = existingName;
    if (!name) {
        name = prompt("Enter a name for this published project:");
        if (!name) return;
    }

    showToast(`Publishing '${name}'...`, "info");

    try {
        const res = await fetch('/api/publish', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({token: currentToken, project_name: name})
        });
        const data = await res.json();

        if (data.success) {
            showToast(`Project published successfully!`, "success");
            loadPublishedProjects();
        } else {
            showToast(data.error || "Failed to publish", "error");
        }
    } catch (e) {
        showToast("Network error publishing project.", "error");
    }
}
