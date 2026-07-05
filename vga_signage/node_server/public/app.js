const socket = io();

let state = {
    mode: 'auto',
    currentMedia: null,
    slideDuration: 10000,
    pdfScroll: true
};

let currentInterrupt = null;

// Helper to allow breaking out of delays instantly when controller overrides
function interruptibleDelay(ms) {
    return new Promise(resolve => {
        const timeoutId = setTimeout(() => {
            currentInterrupt = null;
            resolve('timeout');
        }, ms);
        
        currentInterrupt = () => {
            clearTimeout(timeoutId);
            currentInterrupt = null;
            resolve('interrupted');
        };
    });
}

socket.on('state_update', (newState) => {
    console.log("State updated from server", newState);
    state = newState;
    if (currentInterrupt) currentInterrupt(); // Instantly break current slide!
});

async function fetchPlaylist() {
    try {
        const response = await fetch('/api/playlist');
        return await response.json();
    } catch (e) {
        return [];
    }
}

async function renderPdfPage(url, container) {
    const canvas = document.createElement('canvas');
    canvas.className = 'media';
    if (state.pdfScroll) {
        canvas.classList.add('scrollable');
    }
    container.appendChild(canvas);
    
    try {
        const pdf = await pdfjsLib.getDocument(url).promise;
        const page = await pdf.getPage(1);
        
        // Render very large for high quality text
        const viewport = page.getViewport({ scale: 3.0 }); 
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        const renderContext = {
            canvasContext: canvas.getContext('2d'),
            viewport: viewport
        };
        await page.render(renderContext).promise;
        return canvas;
    } catch (e) {
        return null;
    }
}

function renderHtmlPage(url, container) {
    return new Promise((resolve) => {
        const iframe = document.createElement('iframe');
        iframe.className = 'media';
        iframe.style.border = 'none';
        iframe.onload = () => resolve(iframe);
        iframe.src = url;
        container.appendChild(iframe);
    });
}

function renderImage(url, container) {
    return new Promise((resolve) => {
        const img = new Image();
        img.className = 'media';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = url;
        container.appendChild(img);
    });
}

async function startSlideshow() {
    const container = document.getElementById('media-container');
    
    while (true) {
        // If Manual mode, just show the selected media indefinitely
        if (state.mode === 'manual') {
            if (!state.currentMedia) {
                await interruptibleDelay(1000);
                continue;
            }
            
            container.innerHTML = '';
            const url = `/media/${state.currentMedia}`;
            let el = null;
            
            if (state.currentMedia.toLowerCase().endsWith('.pdf')) {
                el = await renderPdfPage(url, container);
            } else if (state.currentMedia.toLowerCase().endsWith('.html')) {
                el = await renderHtmlPage(url, container);
            } else {
                el = await renderImage(url, container);
            }
            
            if (el) {
                setTimeout(() => el.classList.add('active'), 50);
                
                // Do PDF Scroll if enabled
                if (state.pdfScroll && el.tagName === 'CANVAS') {
                    el.style.transition = `top ${state.slideDuration}ms linear`;
                    // Scroll to bottom
                    setTimeout(() => {
                        const overflow = el.offsetHeight - container.offsetHeight;
                        if (overflow > 0) el.style.top = `-${overflow}px`;
                    }, 100);
                }
            }
            
            // Wait indefinitely until interrupted by a state change
            await interruptibleDelay(99999999);
            continue;
        }
        
        // AUTO MODE: Cycle through playlist
        const files = await fetchPlaylist();
        
        if (files.length === 0) {
            container.innerHTML = '<div class="notice">No Media Found</div>';
            await interruptibleDelay(5000);
            continue;
        }

        for (const file of files) {
            if (state.mode !== 'auto') break; // break loop if mode changed
            
            container.innerHTML = ''; 
            const url = `/media/${file}`;
            let el = null;
            
            if (file.toLowerCase().endsWith('.pdf')) {
                el = await renderPdfPage(url, container);
            } else if (file.toLowerCase().endsWith('.html')) {
                el = await renderHtmlPage(url, container);
            } else {
                el = await renderImage(url, container);
            }
            
            if (el) {
                setTimeout(() => el.classList.add('active'), 50);
                
                // Do PDF Scroll if enabled
                if (state.pdfScroll && el.tagName === 'CANVAS') {
                    el.style.transition = `top ${state.slideDuration}ms linear`;
                    setTimeout(() => {
                        // Calculate how much to scroll
                        const overflow = el.offsetHeight - container.offsetHeight;
                        if (overflow > 0) el.style.top = `-${overflow}px`;
                    }, 100);
                }
                
                // Wait for slide duration
                const reason = await interruptibleDelay(state.slideDuration);
                
                if (reason === 'interrupted') break; // abort this slide!
                
                el.classList.remove('active');
                await new Promise(r => setTimeout(r, 500)); 
            }
        }
    }
}

startSlideshow();
