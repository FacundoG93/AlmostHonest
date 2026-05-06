const notes = document.getElementById('notes');
        
// Prevent default tab behavior
notes.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
        e.preventDefault();
        document.execCommand('insertText', false, '');
    }
});