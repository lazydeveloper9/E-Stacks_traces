# 2x2 Wireless VGA Display Wall (ESP32 & Node.js)

## Project Overview
This project implements a distributed wireless video wall using four ESP32 DevKit V1 microcontrollers and a centralized Node.js server. By leveraging Audio-Visual over Internet Protocol (AV-over-IP) architecture, it drives a 2x2 matrix of VGA displays to render synchronized content over a standard 2.4 GHz Wi-Fi network.

## Theoretical Background & Research
The underlying engineering principles are extensively documented in the included research report: `node_server/media/ESP32 Wireless VGA Display Wall.pdf`. Key takeaways from the research include:
- **AV-over-IP Paradigm**: Moving away from heavy HDMI matrices to distributed edge nodes.
- **Hardware Exploitation**: Bypassing the CPU using the ESP32's I2S peripheral and Direct Memory Access (DMA) to generate precise analog VGA signals.
- **Memory & Timing Constraints**: Balancing spatial resolution against SRAM limitations (520 KB) and using Audio Phase-Locked Loops (APLL) for pixel clock accuracy.
- **Optimized Frameworks**: Utilizing bare-metal libraries like Bitluni's ESP32Lib for maximum DMA performance over heavier abstraction layers.

## Current Implementation Architecture

While the research paper proposes an advanced GStreamer + MJPEG + RTP architecture, the current working implementation utilizes a lightweight, uncompressed line-by-line UDP streaming approach:

### 1. The Headless Node.js Server (`node_server/`)
- Acts as the central media director.
- Hosts a web application containing the media playlist (HTML, Images, PDFs).
- Uses **Puppeteer** to run a headless browser instance and take rapid screenshots of the current view.
- Processes the image via **Floyd-Steinberg dithering** to convert it into a 1-bit grayscale pixel array.
- Splits the image geometrically based on the layout state (`duplicate` or `2x2`).
- Streams the raw pixel data line-by-line via **UDP packets** to the four assigned ESP32 IP addresses.

### 2. The ESP32 VGA Edge Nodes (`ArduinoSketch/VgaSignage/`)
- Four individual ESP32 DevKit V1 nodes connected to VGA displays.
- Utilizes **Bitluni's ESP32Lib** configured for 640x480 resolution (1-bit color depth) to conserve SRAM and prevent DMA buffer panics.
- Connects to the local Wi-Fi network and listens on UDP port `12345`.
- Receives line-by-line pixel data and draws it directly to the VGA framebuffer.

## Hardware Configuration (VGA DAC)
To construct the rudimentary Digital-to-Analog Converter (DAC) for the ESP32, wire the following GPIO pins through appropriate resistors to the VGA connector. These pins were specifically chosen to avoid boot-time interference and internal peripheral conflicts:
- **Red Channel**: GPIO 22
- **Green Channel**: GPIO 19
- **Blue Channel**: GPIO 18
- **H-Sync**: GPIO 23
- **V-Sync**: GPIO 4

*Note: For the current 1-bit grayscale implementation, tying the RGB pins together physically or configuring them in software is sufficient.*

## Setup and Installation

### Node.js Server
1. Navigate to the `node_server/` directory.
2. Install dependencies: 
   ```bash
   npm install
   ```
3. Update the `ESP32_NODES` array in `server.js` with the static IP addresses assigned to your ESP32 modules by your router.
4. Run the server: 
   ```bash
   node server.js
   ```

### ESP32 Nodes
1. Open `ArduinoSketch/VgaSignage/VgaSignage.ino` in the Arduino IDE.
2. Ensure you have the [ESP32Lib by bitluni](https://github.com/bitluni/ESP32Lib) installed in your Arduino libraries.
3. Update the Wi-Fi `ssid` and `password` variables to match your network.
4. Flash the sketch to all four ESP32 DevKit V1 modules.

## Known Limitations and Future Work
- **Framerate**: Currently operates at ~1 FPS due to the uncompressed nature of the UDP stream and the processing overhead of Puppeteer dithering.
- **Color Depth**: Limited to 1-bit (black and white) grayscale to avoid network saturation and memory limits.
- **Future Enhancements**: Transitioning to the hardware-accelerated MJPEG/RTP decoding pipeline outlined in the engineering report to achieve 20-30 FPS with full color representation.
