const SLIDE_DURATION = 10000; // 10 seconds per slide

async function fetchPlaylist() {
    try {
        const response = await fetch('/api/playlist');
        return await response.json();
    } catch (e) {
        console.error("Failed to fetch playlist", e);
        return [];
    }
}

async function renderPdfPage(url, container) {
    const canvas = document.createElement('canvas');
    canvas.className = 'media';
    container.appendChild(canvas);
    
    try {
        const pdf = await pdfjsLib.getDocument(url).promise;
        // For simplicity, we render the first page of the PDF
        const page = await pdf.getPage(1);
        
        // Scale to fit the 640x480 container nicely
        const viewport = page.getViewport({ scale: 1.5 }); 
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        const renderContext = {
            canvasContext: canvas.getContext('2d'),
            viewport: viewport
        };
        await page.render(renderContext).promise;
        return canvas;
    } catch (e) {
        console.error("PDF Render error", e);
        return null;
    }
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
        const files = await fetchPlaylist();
        
        if (files.length === 0) {
            // Default notice if media folder is empty
            container.innerHTML = '<div class="notice">No Media Found.<br>Please add images or PDFs to the <code>media/</code> folder.</div>';
            await new Promise(r => setTimeout(r, 5000));
            continue;
        }

        for (const file of files) {
            container.innerHTML = ''; // clear previous media
            
            const url = `/media/${file}`;
            let el = null;
            
            if (file.toLowerCase().endsWith('.pdf')) {
                el = await renderPdfPage(url, container);
            } else {
                el = await renderImage(url, container);
            }
            
            if (el) {
                // Trigger CSS transition to fade in
                setTimeout(() => el.classList.add('active'), 50);
                
                // Wait for the slide duration (10 seconds)
                await new Promise(r => setTimeout(r, SLIDE_DURATION));
                
                // Fade out
                el.classList.remove('active');
                await new Promise(r => setTimeout(r, 500)); 
            }
        }
    }
}

// Start the engine
startSlideshow();
