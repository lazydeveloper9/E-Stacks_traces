# E-Stacks
Smart solution for Institutions with less resources, out dated computation Capabilities. EStacks redesign and refurbish old hardware at affordable costs and also in environmental freindly manner.

###### --An initiative by students of Bhilai Institute of Technology Durg in collaboration with IEEE Community Climate Club

## Projects Under EStacks
* Smart Digital Screens inside college corridors
  > A network connected screen displaying Daily Updates, Circulars, Notices, Event Updates etc. A eassy to install screen made with Old unused or damaged monitors and e waste of our campus.
* AI enabled Operating System for Low End PCs

<div align="center">
  
# 📺 2x2 Wireless VGA Display Wall
### ESP32 & Node.js Powered AV-over-IP Architecture

[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](#)
[![ESP32](https://img.shields.io/badge/ESP32-E7352C?style=for-the-badge&logo=espressif&logoColor=white)](#)
[![C++](https://img.shields.io/badge/C++-00599C?style=for-the-badge&logo=c%2B%2B&logoColor=white)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](#)

*A distributed, edge-computed video wall leveraging bare-metal ESP32 DMA and headless browser rendering.*

</div>

---

## 📖 Table of Contents
- [Project Overview](#-project-overview)
- [Architecture & Implementation](#%EF%B8%8F-architecture--implementation)
- [Hardware Configuration](#-hardware-configuration)
- [Installation & Setup](#-installation--setup)
- [Theoretical Background](#-theoretical-background)
- [Known Limitations & Roadmap](#-known-limitations--roadmap)

---

## 🎯 Project Overview

This project implements a distributed wireless video wall using four **ESP32 DevKit V1** microcontrollers and a centralized **Node.js** server. By leveraging **Audio-Visual over Internet Protocol (AV-over-IP)** architecture, it drives a 2x2 matrix of VGA displays to render synchronized content over a standard 2.4 GHz Wi-Fi network. 

---

## 🛠️ Architecture & Implementation

While the theoretical research proposes an advanced GStreamer + MJPEG + RTP architecture, the current working implementation utilizes a lightweight, uncompressed line-by-line UDP streaming approach:

### 🖥️ 1. The Headless Node.js Server (`node_server/`)
Acts as the central media director and streamer.
- **Media Hosting**: Hosts a web application containing the media playlist (HTML, Images, PDFs).
- **Headless Rendering**: Uses `puppeteer` to run a headless browser instance and take rapid screenshots.
- **Dithering**: Processes images via **Floyd-Steinberg dithering** to convert them into a 1-bit grayscale pixel array.
- **Matrix Splitting**: Splits the image geometrically based on the layout state (`duplicate` or `2x2`).
- **UDP Streaming**: Streams raw pixel data line-by-line via **UDP packets** to the four assigned ESP32 IPs.

### 🔌 2. The ESP32 VGA Edge Nodes (`ArduinoSketch/`)
Four individual ESP32 DevKit V1 nodes connected to VGA displays.
- **Bare-metal Graphics**: Utilizes [Bitluni's ESP32Lib](https://github.com/bitluni/ESP32Lib) configured for `640x480` resolution (1-bit color depth) to conserve SRAM and prevent DMA buffer panics.
- **Wireless Listening**: Connects to the local Wi-Fi network and listens on UDP port `12345`.
- **Direct Framebuffer**: Receives line-by-line pixel data and draws it directly to the VGA framebuffer.

---

## ⚡ Hardware Configuration

To construct the rudimentary Digital-to-Analog Converter (DAC) for the ESP32, wire the following GPIO pins through appropriate resistors to the VGA connector. These pins were specifically chosen to avoid boot-time interference and internal peripheral conflicts.

| Signal | ESP32 GPIO | Notes |
| :--- | :--- | :--- |
| **Red Channel** | `GPIO 22` | Safe general-purpose output |
| **Green Channel** | `GPIO 19` | Minimal boot interaction |
| **Blue Channel** | `GPIO 18` | Isolated from primary UART |
| **H-Sync** | `GPIO 23` | High-speed toggling capable |
| **V-Sync** | `GPIO 4` | Optimal for stable vertical retrace |

> [!NOTE]
> For the current 1-bit grayscale implementation, tying the RGB pins together physically or configuring them in software is sufficient.

---

## 🚀 Installation & Setup

### Node.js Server

1. Navigate to the server directory:
   ```bash
   cd node_server/
   ```
2. Install the required dependencies:
   ```bash
   npm install
   ```
3. Open `server.js` and update the `ESP32_NODES` array with your static IP addresses:
   ```javascript
   const ESP32_NODES = [
       { ip: "192.168.31.85", offsetX: 0, offsetY: 0, name: "Top-Left" },
       // ... update other nodes ...
   ];
   ```
4. Start the streaming server:
   ```bash
   node server.js
   ```

### ESP32 Nodes

1. Open `ArduinoSketch/VgaSignage/VgaSignage.ino` in your **Arduino IDE**.
2. Install the **[ESP32Lib by bitluni](https://github.com/bitluni/ESP32Lib)** via the Library Manager.
3. Update your network credentials in the sketch:
   ```cpp
   const char* ssid = "YOUR_WIFI_SSID";
   const char* password = "YOUR_WIFI_PASSWORD";
   ```
4. Compile and flash the sketch to all four ESP32 DevKit V1 modules.

---

## 🔬 Theoretical Background

The underlying engineering principles are extensively documented in the included research report: `node_server/media/ESP32 Wireless VGA Display Wall.pdf`. Key takeaways from the research include:

<details>
<summary><b>Click to expand Theoretical Details</b></summary>
<br>

- **AV-over-IP Paradigm**: Moving away from heavy HDMI matrices to distributed edge nodes.
- **Hardware Exploitation**: Bypassing the CPU using the ESP32's I2S peripheral and Direct Memory Access (DMA) to generate precise analog VGA signals.
- **Memory & Timing Constraints**: Balancing spatial resolution against SRAM limitations (520 KB) and using Audio Phase-Locked Loops (APLL) for pixel clock accuracy.
- **Optimized Frameworks**: Utilizing bare-metal libraries like Bitluni's ESP32Lib for maximum DMA performance over heavier abstraction layers.

</details>

---

## 🚧 Known Limitations & Roadmap

- 🐢 **Framerate**: Currently operates at `~1 FPS` due to the uncompressed nature of the UDP stream and the processing overhead of Puppeteer dithering.
- 🔲 **Color Depth**: Limited to 1-bit (black and white) grayscale to avoid network saturation and memory limits.
- 🚀 **Future Enhancements**: Transitioning to the hardware-accelerated MJPEG/RTP decoding pipeline outlined in the engineering report to achieve 20-30 FPS with full color representation.

---
<div align="center">
  <i>Built with hardware-hacking enthusiasm.</i>
</div>
