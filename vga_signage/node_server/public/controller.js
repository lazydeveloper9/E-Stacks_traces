const socket = io();

let currentState = {};

socket.on('state_update', (state) => {
    currentState = state;
    
    // Update UI Badges
    const badge = document.getElementById('mode-badge');
    if (state.mode === 'auto') {
        badge.textContent = 'AUTO';
        badge.className = 'badge auto';
    } else {
        badge.textContent = 'MANUAL';
        badge.className = 'badge';
    }
    
    // Update Settings Inputs
    document.getElementById('duration').value = state.slideDuration / 1000;
    document.getElementById('pdf-scroll').checked = state.pdfScroll;
});

function setMode(mode) {
    socket.emit('set_state', { mode: mode });
}

function updateSettings() {
    const durationSec = parseInt(document.getElementById('duration').value, 10);
    const scroll = document.getElementById('pdf-scroll').checked;
    
    if (durationSec > 0) {
        socket.emit('set_state', {
            slideDuration: durationSec * 1000,
            pdfScroll: scroll
        });
    }
}

function playMedia(filename) {
    socket.emit('set_state', {
        mode: 'manual',
        currentMedia: filename
    });
}

async function loadPlaylist() {
    const list = document.getElementById('playlist');
    list.innerHTML = '<li>Loading...</li>';
    
    try {
        const response = await fetch('/api/playlist');
        const files = await response.json();
        
        list.innerHTML = '';
        if (files.length === 0) {
            list.innerHTML = '<li>No files in media folder</li>';
            return;
        }
        
        files.forEach(file => {
            const li = document.createElement('li');
            li.className = 'media-item';
            li.innerHTML = `
                <span>${file}</span>
                <button class="btn btn-play" onclick="playMedia('${file}')">Play Now</button>
            `;
            list.appendChild(li);
        });
    } catch (e) {
        list.innerHTML = '<li>Error loading playlist</li>';
    }
}

// Load playlist on startup
loadPlaylist();
