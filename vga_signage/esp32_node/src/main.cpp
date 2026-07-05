#include <Arduino.h>
#include <WiFi.h>
#include <WiFiUdp.h>
#include <ESP32Video.h>
#include <Ressources/Font6x8.h>

// VGA Configuration for Grayscale DAC testing
// We map D22 to R, G, and B in the wokwi diagram to simulate our grayscale setup.
const int redPins[] = {22};
const int greenPins[] = {19}; // Unused in wokwi, but needed for ESP32Lib VGA3Bit init
const int bluePins[] = {18};  // Unused in wokwi, but needed for ESP32Lib VGA3Bit init
const int hsyncPin = 23;
const int vsyncPin = 4;

VGA3Bit vga;

// Network Config (Wokwi default gateway for bridging to localhost)
const char* ssid = "Wokwi-GUEST";
const char* password = "";
const int udpPort = 12345;
WiFiUDP udp;

void setup() {
    Serial.begin(115200);
    
    // Initialize VGA at 320x240 to save DMA memory
    vga.init(vga.MODE320x240, redPins, greenPins, bluePins, hsyncPin, vsyncPin);
    vga.setFont(Font6x8);
    vga.clear(vga.RGB(0, 0, 0));
    vga.setCursor(10, 10);
    vga.print("Connecting to Wokwi WiFi...");

    // Connect to Wokwi Wi-Fi
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
        Serial.printf("Received %d bytes\n", packetSize);
        // Here you would process the incoming RLE/Grayscale chunks
        // and write them to the vga.backBuffer
        
        // For now, just blink a rectangle to show data arrived
        // vga.RGB(255, 0, 0) turns on the redPin (D22), which is wired to R,G,B in Wokwi
        vga.fillRect(100, 100, 50, 50, vga.RGB(255, 0, 0)); 
        delay(100);
        vga.fillRect(100, 100, 50, 50, vga.RGB(0, 0, 0));
    }
}
