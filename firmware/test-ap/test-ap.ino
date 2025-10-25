/**
 * Einfacher AP Test - ohne WiFi Manager
 * Zum Testen ob das ESP8266 überhaupt einen AP erstellen kann
 */

#include <ESP8266WiFi.h>

const char* ssid = "Framolux-TEST";
const char* password = "framolux123";

void setup() {
  Serial.begin(115200);
  delay(100);
  
  Serial.println("\n\n=== Framolux AP Test ===");
  Serial.println("Creating Access Point...");
  
  // Erstelle AP
  WiFi.mode(WIFI_AP);
  WiFi.softAP(ssid, password, 1, false, 4); // Kanal 1, nicht versteckt, max 4 Clients
  
  IPAddress IP = WiFi.softAPIP();
  
  Serial.println("\n=== AP CREATED ===");
  Serial.println("SSID: " + String(ssid));
  Serial.println("Password: " + String(password));
  Serial.println("IP: " + IP.toString());
  Serial.println("==================\n");
  Serial.println("Try to connect to this WiFi network!");
}

void loop() {
  // Zeige verbundene Clients
  static unsigned long lastCheck = 0;
  if (millis() - lastCheck > 5000) {
    lastCheck = millis();
    int clients = WiFi.softAPgetStationNum();
    Serial.println("Connected clients: " + String(clients));
  }
  
  delay(100);
}
