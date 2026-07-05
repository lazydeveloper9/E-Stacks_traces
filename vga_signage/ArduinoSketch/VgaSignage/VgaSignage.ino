#include <Arduino.h>
#include <WiFi.h>
#include <WiFiUdp.h>
#include <ESP32Video.h>
#include <Ressources/Font6x8.h>

// VGA Configuration for Grayscale
// (We map these pins, if you tied RGB together for grayscale physically, just using one color works, but here we set all three)
const int redPins[] = {22};
const int greenPins[] = {19}; 
const int bluePins[] = {18};  
const int hsyncPin = 23;
const int vsyncPin = 4;

VGA1BitI vga;

// Network Config
const char* ssid = "AirFiber";
const char* password = "00000000";
const int udpPort = 12345;
WiFiUDP udp;

void setup() {
    Serial.begin(115200);
    
    // Initialize VGA at 640x480 (WARNING: High RAM usage, may cause DMA buffer panic)
    vga.init(vga.MODE640x480, redPins, greenPins, bluePins, hsyncPin, vsyncPin);
    vga.setFont(Font6x8);
    vga.clear(vga.RGB(0, 0, 0));
    vga.setCursor(10, 10);
    vga.print("Connecting to WiFi...");

    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.println("\nWiFi connected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());

    udp.begin(udpPort);
    Serial.printf("Listening on UDP port %d\n", udpPort);
    
    vga.clear(vga.RGB(0, 0, 0));
    vga.setCursor(10, 10);
    vga.print("Connected! IP: ");
    vga.print(WiFi.localIP());
}

void loop() {
    int packetSize = udp.parsePacket();
    if (packetSize) {
        // 640 pixels + 2 bytes for the line index
        uint8_t buffer[642];
        int len = udp.read(buffer, sizeof(buffer));
        
        if (len == 642) {
            uint16_t lineIndex = (buffer[0] << 8) | buffer[1];
            
            // Print a debug message for the first line of every frame so you know data is arriving!
            if (lineIndex == 0) {
                Serial.println("Receiving frame data...");
            }
            
            // Draw the line to the screen (640 pixels per packet)
            for (int x = 0; x < packetSize - 2; x++) {
                int gray = buffer[2 + x];
                // Use 1-bit packed color (1 = white, 0 = black)
                int color = (gray > 127) ? 1 : 0;
                vga.dot(x, lineIndex, color);
            }
        } else {
            Serial.printf("Received unexpected packet size: %d\n", len);
        }
    }
}
