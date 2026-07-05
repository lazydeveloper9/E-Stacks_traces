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
    mode: 'auto', // 'auto' or 'manual'
    currentMedia: null,
    slideDuration: 10000,
    pdfScroll: true
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
    // Send current state to new connections
    socket.emit('state_update', displayState);

    // Listen for updates from the Controller
    socket.on('set_state', (newState) => {
        displayState = { ...displayState, ...newState };
        // Broadcast to all connected clients (Dashboard and Controllers)
        io.emit('state_update', displayState);
    });
});

server.listen(WEB_PORT, () => {
    console.log(`Web server running on http://localhost:${WEB_PORT}`);
});

// --- 2x2 DISPLAY WALL CONFIGURATION ---
const NODE_WIDTH = 320;
const NODE_HEIGHT = 240;
const WALL_WIDTH = NODE_WIDTH * 2;   // 640
const WALL_HEIGHT = NODE_HEIGHT * 2; // 480

// Your physical ESP32's IP address
const ESP32_IP = "192.168.31.82";
const UDP_PORT = 12345;

// TESTING CONFIGURATION:
// Set this to 0, 1, 2, or 3 to force sending a specific quadrant to your single ESP32.
// 0 = Top-Left, 1 = Top-Right, 2 = Bottom-Left, 3 = Bottom-Right
const TEST_QUADRANT = 0;

// Logical definitions of the 4 quadrants
const QUADRANTS = [
    { id: 0, offsetX: 0, offsetY: 0, name: "Top-Left" },
    { id: 1, offsetX: NODE_WIDTH, offsetY: 0, name: "Top-Right" },
    { id: 2, offsetX: 0, offsetY: NODE_HEIGHT, name: "Bottom-Left" },
    { id: 3, offsetX: NODE_WIDTH, offsetY: NODE_HEIGHT, name: "Bottom-Right" }
];

const client = dgram.createSocket('udp4');

async function startServer() {
    console.log(`Starting headless server. Canvas size: ${WALL_WIDTH}x${WALL_HEIGHT}`);

    // Launch puppeteer
    const browser = await puppeteer.launch({
        headless: "new",
        defaultViewport: { width: WALL_WIDTH, height: WALL_HEIGHT }
    });
    const page = await browser.newPage();

    // Navigate to our local Express dashboard instead of using a hardcoded HTML string
    await page.goto(`http://localhost:${WEB_PORT}`);

    console.log(`Ready! Streaming Quadrant ${TEST_QUADRANT} (${QUADRANTS[TEST_QUADRANT].name}) to ${ESP32_IP}...`);

    setInterval(async () => {
        try {
            const element = await page.$('body');
            const screenshotBinary = await element.screenshot({ encoding: 'binary' });
            const screenshotBase64 = await element.screenshot({ encoding: 'base64' });

            // Save preview image (This will show the full 640x480 wall design!)
            require('fs').writeFileSync('preview_full_wall.png', screenshotBinary);

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
                                
                                // Calculate true luminance and add accumulated error
                                let val = (imgData[i] * 0.299 + imgData[i + 1] * 0.587 + imgData[i + 2] * 0.114) + errors[idx];
                                
                                // Threshold to pure black (0) or pure white (255)
                                const newColor = val > 127 ? 255 : 0;
                                grayscale[idx] = newColor;
                                
                                const err = val - newColor;
                                
                                // Floyd-Steinberg Error Diffusion to preserve anti-aliasing!
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
            }, screenshotBase64, WALL_WIDTH, WALL_HEIGHT);

            // Select the quadrant to extract based on user config
            const quad = QUADRANTS[TEST_QUADRANT];

            // Extract and send ONLY the pixels for this specific quadrant
            for (let localY = 0; localY < NODE_HEIGHT; localY++) {
                const packet = Buffer.alloc(322);
                packet[0] = (localY >> 8) & 0xFF; // Local Line index (0 to 239)
                packet[1] = localY & 0xFF;

                const globalY = quad.offsetY + localY;

                for (let localX = 0; localX < NODE_WIDTH; localX++) {
                    const globalX = quad.offsetX + localX;
                    packet[2 + localX] = pixelData[globalY * WALL_WIDTH + globalX];
                }

                client.send(packet, UDP_PORT, ESP32_IP, (err) => {
                    if (err) console.error("UDP Send Error:", err);
                });

                // Keep the 2ms delay so the ESP32 doesn't drop packets!
                await new Promise(r => setTimeout(r, 2));
            }

            console.log(`Sent Quadrant ${TEST_QUADRANT} to ${ESP32_IP}`);

        } catch (err) {
            console.error("Frame capture error:", err);
        }
    }, 1000);
}

startServer();
