# E-Stacks
Smart solution for Institutions with less resources, out dated computation Capabilities. EStacks redesign and refurbish old hardware at affordable costs and also in environmental freindly manner.

E-Stacks is a dual-initiative project: a **hardware phase** that repurposes old campus monitors into functional digital signage, and a **software phase**, the AegisDrive Wiper, that guarantees permanent data destruction on old storage drives so institutions and individuals can recycle hardware without fearing data theft.

###### --An initiative by students of Bhilai Institute of Technology Durg in collaboration with IEEE Community Climate Club

## Projects Under EStacks
* Smart Digital Screens inside college corridors
  > A network connected screen displaying Daily Updates, Circulars, Notices, Event Updates etc. A eassy to install screen made with Old unused or damaged monitors and e waste of our campus.

* AegisDrive Wiper
  > A systems-level data destruction utility that maps a drive, formats it, and streams cryptographic random garbage data over the full storage capacity before a final reformat — ensuring any forceful recovery attempt yields only unusable, uncompressible garbage. Ships as a statically linked Rust binary.

<div align="center">
  
# 📺 2x2 Wireless VGA Display Wall
### ESP32 & Node.js Powered AV-over-IP Architecture

[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](#)
[![ESP32](https://img.shields.io/badge/ESP32-E7352C?style=for-the-badge&logo=espressif&logoColor=white)](#)
[![C++](https://img.shields.io/badge/C++-00599C?style=for-the-badge&logo=c%2B%2B&logoColor=white)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](#)

*A distributed, edge-computed video wall leveraging bare-metal ESP32 DMA and headless browser rendering.*

</div>

> [!NOTE]
> This README documents the original ESP32-based prototype in detail. Per the CCC project documentation, the edge-node hardware has since evolved to Raspberry Pi (Zero 2 W / Pi 3) for the MSME Idea Hackathon 6.0 submission — see [Hardware Evolution: ESP32 to Raspberry Pi](#-hardware-evolution-esp32-to-raspberry-pi) further down. The ESP32 instructions below remain valid for anyone building that original version.

---

## 📖 Table of Contents
- [Project Overview](#-project-overview)
- [Architecture & Implementation](#%EF%B8%8F-architecture--implementation)
- [Hardware Configuration](#-hardware-configuration)
- [Installation & Setup](#-installation--setup)
- [Theoretical Background](#-theoretical-background)
- [Known Limitations & Roadmap](#-known-limitations--roadmap)
- [Hardware Evolution: ESP32 to Raspberry Pi](#-hardware-evolution-esp32-to-raspberry-pi)
- [AegisDrive Wiper (Software Phase)](#-aegisdrive-wiper-software-phase)
- [Environment & Setup Requirements](#-environment--setup-requirements)
- [Components & BOM](#-components--bom)

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

### Full DE-15 (VGA) Connector Reference

For reference, the complete DE-15 (VGA) pin assignment used across the project, per the CCC engineering documentation:

| Pin # | Signal | Description | E-Stacks Usage / Routing |
| :--- | :--- | :--- | :--- |
| 1 | RED | Red video (analog) | Tied to Pins 2 & 3 in grayscale mode |
| 2 | GREEN | Green video (analog) | Tied to Pins 1 & 3 in grayscale mode |
| 3 | BLUE | Blue video (analog) | Tied to Pins 1 & 2 in grayscale mode |
| 5, 6, 7, 8, 10 | GND | Ground | Common return for the analog video and sync signals |
| 13 | H-SYNC | Horizontal sync | On the Raspberry Pi DPI build, routed to GPIO 3 (physical header pin 5) |
| 14 | V-SYNC | Vertical sync | On the Raspberry Pi DPI build, routed to GPIO 2 (physical header pin 3) |

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

## 🔄 Hardware Evolution: ESP32 to Raspberry Pi

The CCC project documentation records that the edge-node architecture kept evolving after this ESP32 prototype, across several documented design decisions:

- **Grayscale trade-off (ESP32 phase)**: Red, Green, and Blue VGA lines were physically tied together so the ESP32 could drive 1-bit or 4-bit grayscale instead of full color — a 640×480 frame at 4-bit needs only ~153.6 KB, which fits the ESP32's ~300–520 KB of usable SRAM and still leaves room for double-buffering to prevent screen tearing.
- **Migration to Raspberry Pi**: The ~1 FPS framerate and lack of color depth on ESP32 led the team to migrate the edge nodes to Raspberry Pi 3 / Zero 2 W ahead of the MSME Idea Hackathon 6.0 (Industry 4.0/5.0) submission. This unlocked 16-bit RGB565 color, removed the SRAM bottleneck, and enabled native HDMI/DPI support for a production-grade matrix.
- **GPIO/DPI attempt**: The Pi initially drove VGA output over its GPIO pins using the Display Parallel Interface (DPI) and the standard "Gert VGA 666" resistor mapping (`dtoverlay=vga666`). H-Sync and V-Sync couldn't use GPIO 20/21 as originally planned, since that overlay reserves those pins as data lines (D16/D17); they were rerouted to GPIO 3 and GPIO 2 instead. This path also required disabling the Pi 3's 3D driver to keep the legacy `/dev/fb0` framebuffer accessible for direct memory-mapping.
- **Current approach — native HDMI**: The GPIO/DPI wiring was ultimately dropped in favor of the Pi's native HDMI output, converted to analog VGA with an external HDMI-to-VGA converter (or a VGA HAT). This sidesteps the GPIO pin conflicts and legacy driver issues above, lets the Pi's HDMI port handle EDID handshakes natively, and frees the full 40-pin GPIO header for other use, at the cost of a small additional hardware expense for the converter/HAT.

> The ESP32 build instructions elsewhere in this README describe the original, still-functional implementation. The points above summarize the direction the project has since moved in for higher color depth and framerate.

---

## 🧹 AegisDrive Wiper (Software Phase)

AegisDrive Wiper is E-Stacks' companion software project: a systems-level utility that guarantees data on a drive is unrecoverable, so institutions and individuals aren't afraid to hand off old hardware for reuse or recycling.

**How it works:**
1. Maps the target drive.
2. Formats it.
3. Streams cryptographically random garbage data across the full storage capacity, down to the final byte.
4. Performs a subsequent reformat, so that even a forceful recovery attempt turns up only uncompressible garbage.

**Implementation notes:**
- Ships as a **statically linked Rust binary** — no runtime dependency, for maximum portability across Linux distributions.
- MVP targets **Linux** raw block devices (e.g. `/dev/sdX`); a **Windows** target (e.g. `\\.\PhysicalDriveX`) is planned for a future V2.
- Works with HDDs, SSDs, eMMC, and SD cards.

> [!WARNING]
> This tool performs irreversible data destruction. During development, only run it against virtual loopback devices (`losetup` on Linux) or disposable USB flash drives — never a live host disk — to avoid accidental data loss.

---

## 🌐 Environment & Setup Requirements

Requirements differ by module:

| Module | Supported OS | Runtime / Firmware | Hardware |
| :--- | :--- | :--- | :--- |
| **AegisDrive Wiper** | Linux (MVP); Windows planned for V2 | None — statically linked Rust binary | HDD / SSD / eMMC / SD card; loopback or disposable USB for safe testing |
| **Display Wall Server** | Linux, Windows, or macOS | Node.js | A machine able to run headless Chromium via Puppeteer |
| **Edge Node — Raspberry Pi** | Headless Linux (legacy graphics stack or KMS) | Python (`pi_vga_client.py`) | Raspberry Pi 3 or Zero 2 W |
| **Edge Node — ESP32** | Bare-metal, no OS | C++ / FreeRTOS via ESP-IDF or Arduino core | ESP32 DevKit V1 |

**Recommended tooling:**
- **VS Code** as the baseline IDE across all domains; the **rust-analyzer** extension is mandatory for the AegisDrive Rust codebase.
- **[Wokwi](https://wokwi.com/)** cycle-accurate simulator for ESP32 development — model FreeRTOS scheduling, the ~300 KB RAM constraint, and I2S DMA transfers, complete with a virtual VGA monitor, before flashing physical hardware.
- A `.env` file for the Node.js server to hold network routing variables (edge-node static IPs, layout/offset configuration).
- `.prettierrc` to keep the digital-signage HTML/CSS formatted consistently.
- For the Raspberry Pi DPI path specifically, `/boot/config.txt` needs `framebuffer_width=1280`, `framebuffer_height=720`, `framebuffer_depth=16`, the `dtoverlay=vga666` driver loaded, and I2C/SPI disabled.

---

## 🧾 Components & BOM

Component datasheets are archived for the hardware used across project phases:
- Raspberry Pi 3B+
- Raspberry Pi Zero 2 W
- Raspberry Pi 5
- VGA HAT (over GPIO)
- ESP32-WROOM

A schematic-level BOM (MPN, manufacturer, value, footprint per part) and the full dependency graph / third-party library versions are maintained alongside the project documentation — see the [dependency graph](https://github.com/lazydeveloper9/E-Stacks_traces/network/dependencies).

---

<div align="center">
  <i>Built with hardware-hacking enthusiasm.</i>
</div>

# Screenshots and Images of Prototype (of 1 unit)
<img width="899" height="1599" alt="WhatsApp Image 2026-07-07 at 12 40 26 PM" src="https://github.com/user-attachments/assets/23e74eab-5ddd-4cc1-a886-bc0e8b4c54cc" />
<img width="1600" height="1204" alt="WhatsApp Image 2026-07-07 at 12 38 58 PM" src="https://github.com/user-attachments/assets/47b8ff71-e4b2-482c-a746-54174de1f8b0" />
<img width="1600" height="1204" alt="WhatsApp Image 2026-07-07 at 12 38 59 PM" src="https://github.com/user-attachments/assets/775fe30c-8cbc-4f02-a805-8665af55f6ef" />
<img width="1600" height="1204" alt="WhatsApp Image 2026-07-07 at 12 38 59 PM (1)" src="https://github.com/user-attachments/assets/103c830a-bff1-4260-8701-724b5c77652e" />
<img width="704" height="912" alt="Screenshot 2026-07-07 115816" src="https://github.com/user-attachments/assets/0f6a7196-7c9e-4d7e-95f8-4ebfcb88ba07" />
