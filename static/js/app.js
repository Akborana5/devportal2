// static/js/app.js

function switchView(viewId, element) {
    // Hide all views
    document.querySelectorAll('.view-container').forEach(v => {
        v.classList.remove('active');
        // Small delay to allow CSS transitions if we add them later
        v.style.display = 'none';
    });
    
    // Show the target view
    const target = document.getElementById(viewId);
    if(target) {
        target.style.display = 'flex';
        // Trigger reflow
        void target.offsetWidth;
        target.classList.add('active');
    }
    
    // Update Sidebar highlighting
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if(element) element.classList.add('active');
    
    // Auto-close sidebar on mobile after clicking
    if(window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('open');
    }
    
    // Auto-focus specific inputs based on view
    if(viewId === 'terminal-view') {
        const termInput = document.getElementById('terminal-input');
        if(termInput) termInput.focus();
    }
}
