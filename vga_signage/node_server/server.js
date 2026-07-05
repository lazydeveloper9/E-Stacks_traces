const puppeteer = require('puppeteer');
const dgram = require('dgram');
const express = require('express');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const WEB_PORT = 3000;

// Global State
let displayState = {
    mode: 'auto', 
    currentMedia: null,
    slideDuration: 10000,
    pdfScroll: true,
    layout: 'duplicate' // 'duplicate' or '2x2'
};

app.use(express.static('public'));
app.use('/media', express.static('media'));

app.get('/api/playlist', (req, res) => {
    const mediaDir = path.join(__dirname, 'media');
    if (!fs.existsSync(mediaDir)) {
        fs.mkdirSync(mediaDir);
        return res.json([]);
    }
    const files = fs.readdirSync(mediaDir).filter(file => {
        return file.match(/\.(png|jpg|jpeg|pdf|html)$/i);
    });
    res.json(files);
});

io.on('connection', (socket) => {
    socket.emit('state_update', displayState);

    socket.on('set_state', (newState) => {
        displayState = { ...displayState, ...newState };
        io.emit('state_update', displayState);
    });
});

server.listen(WEB_PORT, () => {
    console.log(`Web server running on http://localhost:${WEB_PORT}`);
});

// --- 4-NODE DISPLAY WALL CONFIGURATION ---
const NODE_WIDTH = 640;
const NODE_HEIGHT = 480;

// Physical IPs of the 4 ESP32s (assign them in your router)
const ESP32_NODES = [
    { ip: "192.168.31.82", offsetX: 0, offsetY: 0, name: "Top-Left" },
    { ip: "192.168.31.83", offsetX: NODE_WIDTH, offsetY: 0, name: "Top-Right" },
    { ip: "192.168.31.84", offsetX: 0, offsetY: NODE_HEIGHT, name: "Bottom-Left" },
    { ip: "192.168.31.85", offsetX: NODE_WIDTH, offsetY: NODE_HEIGHT, name: "Bottom-Right" }
];
const UDP_PORT = 12345;

const client = dgram.createSocket('udp4');

async function startServer() {
    console.log(`Starting headless server...`);

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox']
    });
    const page = await browser.newPage();

    await page.goto(`http://localhost:${WEB_PORT}`);

    console.log(`Ready! Streaming to Display Wall...`);

    // We use a self-executing async loop instead of setInterval to prevent overlap
    async function captureLoop() {
        try {
            // Determine dynamic resolution based on layout
            const currentWidth = displayState.layout === '2x2' ? NODE_WIDTH * 2 : NODE_WIDTH;
            const currentHeight = displayState.layout === '2x2' ? NODE_HEIGHT * 2 : NODE_HEIGHT;
            
            await page.setViewport({ width: currentWidth, height: currentHeight });
            
            const screenshotBase64 = await page.screenshot({ encoding: 'base64' });
            require('fs').writeFileSync('preview_full_wall.png', Buffer.from(screenshotBase64, 'base64'));

            const pixelData = await page.evaluate(async (base64, w, h) => {
                return new Promise((resolve) => {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = w;
                        canvas.height = h;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0);

                        const imgData = ctx.getImageData(0, 0, w, h).data;
                        const grayscale = new Uint8Array(w * h);
                        const errors = new Float32Array(w * h);
                        
                        for (let y = 0; y < h; y++) {
                            for (let x = 0; x < w; x++) {
                                const idx = y * w + x;
                                const i = idx * 4;
                                let val = (imgData[i] * 0.299 + imgData[i + 1] * 0.587 + imgData[i + 2] * 0.114) + errors[idx];
                                const newColor = val > 127 ? 255 : 0;
                                grayscale[idx] = newColor;
                                const err = val - newColor;
                                
                                if (x + 1 < w) errors[idx + 1] += err * (7 / 16);
                                if (y + 1 < h) {
                                    if (x - 1 >= 0) errors[(y + 1) * w + x - 1] += err * (3 / 16);
                                    errors[(y + 1) * w + x] += err * (5 / 16);
                                    if (x + 1 < w) errors[(y + 1) * w + x + 1] += err * (1 / 16);
                                }
                            }
                        }
                        resolve(Array.from(grayscale));
                    };
                    img.src = 'data:image/png;base64,' + base64;
                });
            }, screenshotBase64, currentWidth, currentHeight);

            // Interleaved UDP Streaming
            for (let localY = 0; localY < NODE_HEIGHT; localY++) {
                
                // Construct and send packet for each node for THIS line
                for (let i = 0; i < ESP32_NODES.length; i++) {
                    const node = ESP32_NODES[i];
                    
                    const readOffsetX = displayState.layout === 'duplicate' ? 0 : node.offsetX;
                    const readOffsetY = displayState.layout === 'duplicate' ? 0 : node.offsetY;
                    const globalY = readOffsetY + localY;
                    
                    const packet = Buffer.alloc(NODE_WIDTH + 2);
                    packet[0] = (localY >> 8) & 0xFF; // Local Line index
                    packet[1] = localY & 0xFF;
                    
                    for (let localX = 0; localX < NODE_WIDTH; localX++) {
                        const globalX = readOffsetX + localX;
                        packet[2 + localX] = pixelData[globalY * currentWidth + globalX];
                    }
                    
                    client.send(packet, UDP_PORT, node.ip, (err) => {
                        // ignore errors to prevent console spam
                    });
                }
                
                // Wait 2ms after sending the line to ALL nodes
                await new Promise(r => setTimeout(r, 2));
            }

        } catch (err) {
            console.error("Frame capture error:", err);
        }
        
        // Loop at approximately 1 FPS
        setTimeout(captureLoop, 1000);
    }
    
    // Start loop
    captureLoop();
}

startServer();
