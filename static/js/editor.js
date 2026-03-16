// static/js/editor.js

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

    // Load files immediately after init
    loadFiles();
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
                div.innerHTML = `📄 ${f}`;
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
    document.getElementById('current-filename').value = "untitled.txt";
    if(editor) {
        editor.setValue("", -1);
        editor.session.setMode("ace/mode/text");
        editor.focus();
    }
}

async function openFile(filename) {
    document.getElementById('current-filename').value = filename;
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
        alert("Network error reading file.");
    }
}

async function saveFile() {
    const filename = document.getElementById('current-filename').value;
    const content = editor ? editor.getValue() : "";
    
    if(!filename) { 
        alert("Please enter a filename"); 
        return; 
    }
    
    const saveBtn = document.querySelector('.editor-btn.primary');
    saveBtn.innerText = "Saving...";
    
    try {
        const res = await fetch('/api/file/save', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({token: currentToken, filename: filename, content: content}) 
        });
        const data = await res.json();
        
        if(data.success) {
            saveBtn.innerText = "✓ Saved";
            setTimeout(() => saveBtn.innerText = "💾 Save", 2000);
            loadFiles(); // Refresh list just in case it's a new file
        } else {
            alert("Error saving: " + data.error);
            saveBtn.innerText = "💾 Save";
        }
    } catch(e) {
        alert("Network error while saving.");
        saveBtn.innerText = "💾 Save";
    }
}

async function renameFile() {
    const newName = prompt("Enter new filename:");
    if(!newName) return;
    
    const oldName = document.getElementById('current-filename').value;
    
    try {
        await fetch('/api/file/rename', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({token: currentToken, filename: oldName, new_name: newName}) 
        });
        document.getElementById('current-filename').value = newName;
        loadFiles();
    } catch (e) {
        alert("Error renaming file.");
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
        } else {
            editor.setValue(originalCode, -1);
            alert("AI Edit failed: \n" + (data.code || "Unknown error"));
        }
    } catch(e) {
        editor.setValue(originalCode, -1);
        alert("Network error during AI edit.");
    }
}
