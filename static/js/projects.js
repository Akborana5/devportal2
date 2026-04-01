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
                        <button class="editor-btn success" onclick="publishCurrentWorkspace('${p.name}', '${p.id}')" style="flex: 1;"><i class="fa-solid fa-arrows-rotate"></i> Update Code</button>
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

// Global modal state
let publishingProjectID = null;

async function publishCurrentWorkspace(existingName = null, existingId = null) {
    publishingProjectID = existingId;

    const modal = document.getElementById('publish-modal');
    modal.style.display = 'flex';

    // Set project name
    const nameInput = document.getElementById('publish-project-name');
    nameInput.value = existingName || '';

    // Load files into checkboxes
    const fileListDiv = document.getElementById('publish-file-list');
    fileListDiv.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Fetching files...';

    try {
        // Fetch current workspace files
        const wsRes = await fetch('/api/files', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({token: currentToken})
        });
        const wsData = await wsRes.json();

        let previouslyPublished = [];
        // If updating an existing project, fetch the files that are currently in its published folder
        if (existingId) {
            const pubRes = await fetch('/api/project/files', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({token: currentToken, project_id: existingId})
            });
            const pubData = await pubRes.json();
            if (pubData.files) previouslyPublished = pubData.files;
        }

        fileListDiv.innerHTML = '';
        if (wsData.files && wsData.files.length > 0) {
            wsData.files.forEach(f => {
                const label = document.createElement('label');
                label.style.cssText = "display: flex; align-items: center; gap: 8px; color: var(--text-primary); cursor: pointer; font-size: 13px; font-family: var(--font-mono);";

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = f;
                checkbox.className = 'publish-file-checkbox';

                // If it's a new project, check all by default.
                // If it's an update, check only the ones that were published before.
                if (!existingId || previouslyPublished.includes(f)) {
                    checkbox.checked = true;
                }

                label.appendChild(checkbox);
                label.appendChild(document.createTextNode(f));
                fileListDiv.appendChild(label);
            });
        } else {
            fileListDiv.innerHTML = '<span style="color: var(--error-color);">Workspace is empty. Add files in Code Editor.</span>';
        }

    } catch (e) {
        fileListDiv.innerHTML = '<span style="color: var(--error-color);">Failed to load files.</span>';
    }

    // Set up live preview
    const iframe = document.getElementById('publish-preview-frame');
    iframe.src = `/preview/${currentToken}/index.html`; // Will return 404 naturally if not there
}

function closePublishModal() {
    document.getElementById('publish-modal').style.display = 'none';
    document.getElementById('publish-preview-frame').src = 'about:blank';
}

async function confirmPublish() {
    const nameInput = document.getElementById('publish-project-name').value.trim();
    if (!nameInput) {
        showToast("Project Name is required.", "warning");
        return;
    }

    const checkboxes = document.querySelectorAll('.publish-file-checkbox');
    const selectedFiles = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);

    if (selectedFiles.length === 0) {
        showToast("You must select at least one file to publish.", "warning");
        return;
    }

    if (!selectedFiles.includes('index.html')) {
        const proceed = confirm("Warning: You did not select an 'index.html' file. The site will not work correctly when visited. Publish anyway?");
        if(!proceed) return;
    }

    const btn = document.getElementById('publish-confirm-btn');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Publishing...';
    btn.disabled = true;

    try {
        const res = await fetch('/api/publish', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                token: currentToken,
                project_name: nameInput,
                project_id: publishingProjectID, // If this is an update, tell the backend
                files: selectedFiles // The exact files to copy
            })
        });
        const data = await res.json();

        if (data.success) {
            showToast(`Project published successfully!`, "success");
            closePublishModal();
            loadPublishedProjects();
        } else {
            showToast(data.error || "Failed to publish", "error");
        }
    } catch (e) {
        showToast("Network error publishing project.", "error");
    } finally {
        btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Publish Now';
        btn.disabled = false;
    }
}
