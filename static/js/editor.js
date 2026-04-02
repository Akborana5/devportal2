let editor;

function initEditor() {
    if (!document.getElementById("ace-editor")) return;
    
    // Initialize Ace
    editor = ace.edit("ace-editor");
    editor.setTheme("ace/theme/tomorrow_night_eighties"); // Deep dark theme matching mockups
    editor.session.setMode("ace/mode/python");
    editor.setOptions({
        fontSize: "14px",
        fontFamily: "var(--font-mono)",
        showPrintMargin: false,
        enableBasicAutocompletion: true
    });

    // Detect file type changes based on filename input
    document.getElementById('current-filename').addEventListener('input', checkRunVisibility);

    // Load files immediately after init
    loadFiles();
}

function getIconForFile(filename) {
    if (filename.endsWith('.py')) return '<i class="fa-brands fa-python" style="color: #4B8BBE;"></i>';
    if (filename.endsWith('.js')) return '<i class="fa-brands fa-js" style="color: #F7DF1E;"></i>';
    if (filename.endsWith('.html')) return '<i class="fa-brands fa-html5" style="color: #E34F26;"></i>';
    if (filename.endsWith('.css')) return '<i class="fa-brands fa-css3-alt" style="color: #1572B6;"></i>';
    if (filename.endsWith('.json')) return '<i class="fa-solid fa-code" style="color: #8BC34A;"></i>';
    return '<i class="fa-solid fa-file-lines" style="color: var(--text-muted);"></i>';
}

async function loadFiles() {
    if (!currentToken) return;
    
    try {
        const res = await fetch('/api/files', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({token: currentToken}) 
        });
        const data = await res.json();
        
        const list = document.getElementById('file-list');
        if(!list) return;
        
        list.innerHTML = '';
        
        if (data.files && data.files.length > 0) {
            data.files.forEach(f => {
                const div = document.createElement('div');
                div.className = 'file-item';
                div.innerHTML = `${getIconForFile(f)} <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${f}</span> <button class="file-item-delete" title="Delete" onclick="deleteFile(event, '${f}')"><i class="fa-solid fa-trash"></i></button>`;
                div.onclick = () => openFile(f);
                list.appendChild(div);
            });
        } else {
            list.innerHTML = `<div style="color: var(--text-muted); font-size: 12px; text-align: center; margin-top: 20px;">No files yet. Click + New</div>`;
        }
    } catch(e) {
        console.error("Failed to load files", e);
    }
}

function newFile() {
    document.getElementById('current-filename').value = "untitled.html";
    checkRunVisibility();
    if(editor) {
        editor.setValue("<!DOCTYPE html>\n<html>\n<head>\n  <title>New Page</title>\n</head>\n<body>\n  <h1>Hello World</h1>\n</body>\n</html>", -1);
        editor.session.setMode("ace/mode/html");
        editor.focus();
    }
}

async function openFile(filename) {
    document.getElementById('current-filename').value = filename;
    checkRunVisibility();

    // Highlight active file in explorer
    document.querySelectorAll('.file-item').forEach(el => {
        el.classList.remove('active');
        if (el.innerText.trim() === filename) {
            el.classList.add('active');
        }
    });

    try {
        const res = await fetch('/api/file/read', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({token: currentToken, filename: filename}) 
        });
        const data = await res.json();
        
        if(!data.error && editor) {
            editor.setValue(data.content, -1);
            
            // Set Syntax Highlighting
            if(filename.endsWith('.py')) editor.session.setMode("ace/mode/python");
            else if(filename.endsWith('.js')) editor.session.setMode("ace/mode/javascript");
            else if(filename.endsWith('.html')) editor.session.setMode("ace/mode/html");
            else if(filename.endsWith('.css')) editor.session.setMode("ace/mode/css");
            else if(filename.endsWith('.json')) editor.session.setMode("ace/mode/json");
            else editor.session.setMode("ace/mode/text");
        }
    } catch (e) {
        showToast("Network error reading file.", "error");
    }
}

async function saveFile() {
    const filename = document.getElementById('current-filename').value;
    const content = editor ? editor.getValue() : "";
    
    if(!filename) { 
        showToast("Please enter a filename", "warning");
        return; 
    }
    
    const saveBtn = document.querySelector('.editor-btn.primary');
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    
    try {
        const res = await fetch('/api/file/save', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({token: currentToken, filename: filename, content: content}) 
        });
        const data = await res.json();
        
        if(data.success) {
            saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Saved';
            showToast(`Saved ${filename}`, "success");
            setTimeout(() => saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save', 2000);
            loadFiles(); // Refresh list just in case it's a new file

            // Auto-refresh preview if open
            if (document.getElementById('preview-container').style.display !== 'none') {
                runCode();
            }
        } else {
            showToast("Error saving: " + data.error, "error");
            saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save';
        }
    } catch(e) {
        showToast("Network error while saving.", "error");
        saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save';
    }
}

async function renameFile() {
    const newName = prompt("Enter new filename:");
    if(!newName) return;
    
    const oldName = document.getElementById('current-filename').value;
    
    try {
        const res = await fetch('/api/file/rename', {
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({token: currentToken, filename: oldName, new_name: newName}) 
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('current-filename').value = newName;
            checkRunVisibility();
            loadFiles();
            showToast("File renamed successfully", "success");
        } else {
            showToast(data.error || "Failed to rename", "error");
        }
    } catch (e) {
        showToast("Error renaming file.", "error");
    }
}

async function aiEdit() {
    const promptStr = prompt("✨ AI Edit: What should the AI do to this code? (e.g., 'Fix the loop bug', 'Add comments')");
    if(!promptStr || !editor) return;
    
    const originalCode = editor.getValue();
    editor.setValue("✨ AI is analyzing and rewriting your code... please wait.", -1);
    
    try {
        const res = await fetch('/api/ai_edit', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({prompt: promptStr, content: originalCode}) 
        });
        const data = await res.json();
        
        if(data.code && !data.code.includes("NETWORK_ERROR")) {
            editor.setValue(data.code, -1);
            showToast("AI Edit applied successfully", "success");
        } else {
            editor.setValue(originalCode, -1);
            showToast("AI Edit failed: \n" + (data.code || "Unknown error"), "error");
        }
    } catch(e) {
        editor.setValue(originalCode, -1);
        showToast("Network error during AI edit.", "error");
    }
}

function checkRunVisibility() {
    const filename = document.getElementById('current-filename').value;
    const runBtn = document.getElementById('run-btn');
    if (filename.endsWith('.html') || filename.endsWith('.js') || filename.endsWith('.css')) {
        runBtn.style.display = 'inline-block';
    } else {
        runBtn.style.display = 'none';
        closePreview();
    }
}

async function runCode() {
    const filename = document.getElementById('current-filename').value;
    const previewContainer = document.getElementById('preview-container');
    const iframe = document.getElementById('live-preview-frame');

    // Make sure we save the latest changes before running so the backend API serves the fresh file
    await saveFile();

    previewContainer.style.display = 'block';

    if (filename.endsWith('.html')) {
        // Serve through our new endpoint so relative css/js imports work correctly
        iframe.src = `/preview/${currentToken}/${filename}`;
    } else if (filename.endsWith('.js') || filename.endsWith('.css')) {
        // If it's pure JS or CSS, wrap it in a dummy HTML to preview
        const content = editor.getValue();
        let htmlContent = '';
        if (filename.endsWith('.js')) {
            htmlContent = `<!DOCTYPE html><html><body><script>${content}<\/script></body></html>`;
        } else if (filename.endsWith('.css')) {
            htmlContent = `<!DOCTYPE html><html><head><style>${content}</style></head><body><h1>CSS Preview</h1><p>This is a sample text to preview your CSS styles.</p></body></html>`;
        }

        iframe.removeAttribute('src');
        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(htmlContent);
        doc.close();
    }
}

function closePreview() {
    document.getElementById('preview-container').style.display = 'none';
}

function toggleFullScreenPreview() {
    const container = document.getElementById('preview-container');
    const icon = document.getElementById('fullscreen-icon');

    if (container.classList.contains('fullscreen-preview')) {
        container.classList.remove('fullscreen-preview');
        icon.classList.remove('fa-compress');
        icon.classList.add('fa-expand');
    } else {
        container.classList.add('fullscreen-preview');
        icon.classList.remove('fa-expand');
        icon.classList.add('fa-compress');
    }
}

async function deleteFile(e, filename) {
    e.stopPropagation(); // Don't trigger the row click
    if (!confirm(`Are you sure you want to delete ${filename}?`)) return;

    try {
        const res = await fetch('/api/file/delete', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({token: currentToken, filename: filename})
        });
        const data = await res.json();

        if (data.success) {
            showToast(`Deleted ${filename}`, "success");
            if (document.getElementById('current-filename').value === filename) {
                document.getElementById('current-filename').value = '';
                editor.setValue('', -1);
                checkRunVisibility();
            }
            loadFiles();
        } else {
            showToast(`Failed to delete: ${data.error}`, "error");
        }
    } catch(err) {
        showToast("Network error while deleting.", "error");
    }
}

async function createFolder() {
    const folderName = prompt("Enter new folder name (e.g. 'src' or 'src/components'):");
    if (!folderName) return;

    try {
        const res = await fetch('/api/folder/create', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({token: currentToken, filename: folderName})
        });
        const data = await res.json();

        if (data.success) {
            showToast(`Created folder ${folderName}`, "success");
            loadFiles();
        } else {
            showToast(`Failed to create folder: ${data.error}`, "error");
        }
    } catch(err) {
        showToast("Network error while creating folder.", "error");
    }
}


async function deleteFolder() {
    const folderName = prompt("Enter folder path to delete (e.g. 'src/components'):");
    if (!folderName) return;

    if (!confirm(`Are you absolutely sure you want to delete the folder '${folderName}' AND all of its contents?`)) return;

    try {
        const res = await fetch('/api/folder/delete', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({token: currentToken, filename: folderName})
        });
        const data = await res.json();

        if (data.success) {
            showToast(`Deleted folder ${folderName}`, "success");
            loadFiles();
        } else {
            showToast(`Failed to delete folder: ${data.error}`, "error");
        }
    } catch(err) {
        showToast("Network error while deleting folder.", "error");
    }
}
