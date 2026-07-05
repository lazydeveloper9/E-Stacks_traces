const puppeteer = require('puppeteer');
const dgram = require('dgram');

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
const TEST_QUADRANT = 3;

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

    // We now have a larger 640x480 canvas to play with!
    // Let's create a design that spans all 4 quadrants so we can see the slicing in action.
    const content = `
    <html>
    <head>
        <style>
            body { 
                margin: 0; padding: 20px; background: #000; color: #fff;
                font-family: Arial, sans-serif; text-align: center;
                display: flex; flex-direction: column; justify-content: center; height: 100vh;
                border: 10px solid #555; box-sizing: border-box;
            }
            h1 { font-size: 64px; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 5px;}
            p { font-size: 32px; color: #ccc; margin: 10px; }
            .grid { display: flex; justify-content: space-around; width: 100%; margin-top: 40px;}
            .box { border: 2px dashed #fff; padding: 20px; width: 30%; font-size: 24px;}
        </style>
    </head>
    <body>
        <h1>Global Notice Board</h1>
        <p>System Architecture: 2x2 VGA Wall</p>
        <p>Server Status: ONLINE & SYNCED</p>
        <div class="grid">
            <div class="box">Data Center Alpha</div>
            <div class="box">Network Operations</div>
        </div>
    </body>
    </html>
    `;
    await page.setContent(content);

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

                        for (let i = 0; i < imgData.length; i += 4) {
                            grayscale[i / 4] = (imgData[i] * 0.299 + imgData[i + 1] * 0.587 + imgData[i + 2] * 0.114);
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
