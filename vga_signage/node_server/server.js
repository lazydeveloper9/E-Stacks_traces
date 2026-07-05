const puppeteer = require('puppeteer');
const dgram = require('dgram');

const UDP_IP = "192.168.31.82"; // Updated to your ESP32's IP address
const UDP_PORT = 12345;
const WIDTH = 320;
const HEIGHT = 240;

const client = dgram.createSocket('udp4');

async function startServer() {
    console.log(`Starting headless browser server at ${WIDTH}x${HEIGHT}...`);

    // Launch puppeteer
    const browser = await puppeteer.launch({
        headless: "new",
        defaultViewport: { width: WIDTH, height: HEIGHT }
    });
    const page = await browser.newPage();

    // Set some simple HTML content to render (Informatics / Notices)
    const content = `
    <html>
    <head>
        <style>
            body { 
                margin: 0; padding: 10px; background: #000; color: #fff;
                font-family: Arial, sans-serif; text-align: center;
                display: flex; flex-direction: column; justify-content: center; height: 100vh;
            }
            h1 { font-size: 24px; margin-bottom: 5px; }
            p { font-size: 16px; color: #ccc; }
        </style>
    </head>
    <body>
        <h1>Notice Board</h1>
        <p>Meeting at 3:00 PM</p>
        <p>Server Status: ONLINE</p>
        <p>Current Time: 20:26</p>
    </body>
    </html>
    `;
    await page.setContent(content);

    console.log("Ready to stream frames!");

    // Simple loop to capture frame and send it via UDP
    setInterval(async () => {
        try {
            // Get raw RGB image data from the browser page
            const element = await page.$('body');
            const screenshotBinary = await element.screenshot({ encoding: 'binary' });
            const screenshotBase64 = await element.screenshot({ encoding: 'base64' });

            // Save preview image so you can see exactly what is being sent!
            require('fs').writeFileSync('preview.png', screenshotBinary);

            // Send the perfect screenshot back into the browser to extract the raw pixel bytes
            // This ensures exactly what you style in HTML/CSS is what gets sent to the monitor!
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
                            // Convert to grayscale luminance
                            grayscale[i / 4] = (imgData[i] * 0.299 + imgData[i + 1] * 0.587 + imgData[i + 2] * 0.114);
                        }
                        resolve(Array.from(grayscale));
                    };
                    img.src = 'data:image/png;base64,' + base64;
                });
            }, screenshotBase64, WIDTH, HEIGHT);

            // Send pixel data line by line
            // Expected format: Byte 0-1 (Line Index), Byte 2-321 (320 Pixels)
            for (let y = 0; y < HEIGHT; y++) {
                const packet = Buffer.alloc(322);
                packet[0] = (y >> 8) & 0xFF;
                packet[1] = y & 0xFF;

                for (let x = 0; x < WIDTH; x++) {
                    packet[2 + x] = pixelData[y * WIDTH + x];
                }

                client.send(packet, UDP_PORT, UDP_IP, (err) => {
                    if (err) console.error("UDP Send Error:", err);
                });

                // CRITICAL: ESP32 will drop packets if we blast all 240 lines instantly.
                // We add a tiny 2ms delay between packets to give the ESP32 time to process them!
                await new Promise(r => setTimeout(r, 2));
            }

            console.log("Sent frame to", UDP_IP);

        } catch (err) {
            console.error("Frame capture error:", err);
        }
    }, 1000); // 1 FPS for informatics
}

startServer();
