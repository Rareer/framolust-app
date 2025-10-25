/**
 * Framolux ESP8266 Firmware
 * 
 * Features:
 * - WiFi Connection mit konfigurierbaren Credentials
 * - Webserver für Frame-Upload
 * - Persistente Speicherung in LittleFS
 * - mDNS für automatische Discovery
 * - REST API für Frame-Management
 */

#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <ESP8266mDNS.h>
#include <LittleFS.h>
#include <ArduinoJson.h>

// WiFi Credentials (werden beim Kompilieren ersetzt)
#ifndef WIFI_SSID
#define WIFI_SSID "YOUR_WIFI_SSID"
#endif

#ifndef WIFI_PASSWORD
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"
#endif

// Device ID (wird beim Kompilieren generiert)
#ifndef DEVICE_ID
#define DEVICE_ID "FRAMOLUX_DEFAULT"
#endif

// Konfiguration
#define DEFAULT_DEVICE_NAME "framolux"
#define WEB_SERVER_PORT 80
#define MAX_FRAMES 100
#define FRAME_FILE "/frames.json"
#define CONFIG_FILE "/config.json"

ESP8266WebServer server(WEB_SERVER_PORT);

// Globale Variablen
String deviceId = DEVICE_ID;
String deviceName = DEFAULT_DEVICE_NAME;
String macAddress;
int frameCount = 0;

/**
 * Setup-Funktion
 */
void setup() {
  Serial.begin(115200);
  Serial.println("\n\nFramolux ESP8266 Starting...");
  
  // Speichere MAC-Adresse
  macAddress = WiFi.macAddress();
  Serial.println("Device ID: " + deviceId);
  Serial.println("MAC Address: " + macAddress);
  
  // LittleFS initialisieren
  if (!LittleFS.begin()) {
    Serial.println("LittleFS Mount Failed! Formatting...");
    LittleFS.format();
    LittleFS.begin();
  }
  Serial.println("LittleFS mounted successfully");
  
  // Lade Konfiguration (inkl. benutzerdefinierter Name)
  loadConfig();
  
  // Lade gespeicherte Frames
  loadFrames();
  
  // WiFi verbinden
  connectWiFi();
  
  // mDNS starten mit Device-ID als Hostname
  String mdnsName = "framolux-" + deviceId;
  mdnsName.toLowerCase();
  if (MDNS.begin(mdnsName.c_str())) {
    Serial.println("mDNS responder started: " + mdnsName + ".local");
    MDNS.addService("http", "tcp", WEB_SERVER_PORT);
    MDNS.addServiceTxt("http", "tcp", "deviceId", deviceId);
    MDNS.addServiceTxt("http", "tcp", "deviceName", deviceName);
  }
  
  // Webserver Routes
  setupRoutes();
  
  // Server starten
  server.begin();
  Serial.println("HTTP server started on port " + String(WEB_SERVER_PORT));
  Serial.println("Ready! IP: " + WiFi.localIP().toString());
}

/**
 * Main Loop
 */
void loop() {
  server.handleClient();
  MDNS.update();
}

/**
 * WiFi Verbindung herstellen
 */
void connectWiFi() {
  Serial.println("Connecting to WiFi: " + String(WIFI_SSID));
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected!");
    Serial.println("IP address: " + WiFi.localIP().toString());
  } else {
    Serial.println("\nWiFi connection failed!");
  }
}

/**
 * Webserver Routes konfigurieren
 */
void setupRoutes() {
  // WICHTIG: enableCORS(true) NICHT verwenden - führt zu doppelten Headers!
  // Wir setzen CORS-Header manuell in jedem Handler
  
  // OPTIONS Handler für CORS Preflight Requests
  server.on("/frames", HTTP_OPTIONS, []() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.sendHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    server.sendHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    server.sendHeader("Access-Control-Max-Age", "86400");
    server.send(204);
  });
  
  server.on("/config", HTTP_OPTIONS, []() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.sendHeader("Access-Control-Allow-Methods", "PUT, OPTIONS");
    server.sendHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    server.sendHeader("Access-Control-Max-Age", "86400");
    server.send(204);
  });
  
  // GET / - Status Info
  server.on("/", HTTP_GET, handleRoot);
  
  // GET /status - Device Status
  server.on("/status", HTTP_GET, handleStatus);
  
  // POST /frames - Upload Frames
  server.on("/frames", HTTP_POST, handleUploadFrames);
  
  // GET /frames - Get all Frames
  server.on("/frames", HTTP_GET, handleGetFrames);
  
  // DELETE /frames - Clear all Frames
  server.on("/frames", HTTP_DELETE, handleClearFrames);
  
  // GET /info - Device Info
  server.on("/info", HTTP_GET, handleInfo);
  
  // PUT /config - Update Device Config (Name ändern)
  server.on("/config", HTTP_PUT, handleUpdateConfig);
  
  // 404 Handler
  server.onNotFound(handleNotFound);
}

/**
 * Handler: Root
 */
void handleRoot() {
  String html = "<html><body>";
  html += "<h1>Framolux ESP8266</h1>";
  html += "<p><strong>Device ID:</strong> " + deviceId + "</p>";
  html += "<p><strong>Device Name:</strong> " + deviceName + "</p>";
  html += "<p><strong>IP:</strong> " + WiFi.localIP().toString() + "</p>";
  html += "<p><strong>Frames stored:</strong> " + String(frameCount) + "</p>";
  html += "<p><strong>Free heap:</strong> " + String(ESP.getFreeHeap()) + " bytes</p>";
  html += "<h2>API Endpoints:</h2>";
  html += "<ul>";
  html += "<li>GET /status - Device status</li>";
  html += "<li>GET /info - Device info</li>";
  html += "<li>POST /frames - Upload frames</li>";
  html += "<li>GET /frames - Get frames</li>";
  html += "<li>DELETE /frames - Clear frames</li>";
  html += "<li>PUT /config - Update device config</li>";
  html += "</ul>";
  html += "</body></html>";
  
  server.send(200, "text/html", html);
}

/**
 * Handler: Status
 */
void handleStatus() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  
  StaticJsonDocument<256> doc;
  doc["status"] = "online";
  doc["deviceId"] = deviceId;
  doc["deviceName"] = deviceName;
  doc["ip"] = WiFi.localIP().toString();
  doc["frameCount"] = frameCount;
  doc["freeHeap"] = ESP.getFreeHeap();
  doc["uptime"] = millis() / 1000;
  
  String response;
  serializeJson(doc, response);
  server.send(200, "application/json", response);
}

/**
 * Handler: Device Info
 */
void handleInfo() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  
  StaticJsonDocument<400> doc;
  doc["deviceId"] = deviceId;
  doc["deviceName"] = deviceName;
  doc["ip"] = WiFi.localIP().toString();
  doc["mac"] = macAddress;
  doc["ssid"] = WiFi.SSID();
  doc["rssi"] = WiFi.RSSI();
  doc["chipId"] = ESP.getChipId();
  doc["flashSize"] = ESP.getFlashChipSize();
  doc["freeHeap"] = ESP.getFreeHeap();
  doc["version"] = "1.0.0";
  
  String response;
  serializeJson(doc, response);
  server.send(200, "application/json", response);
}

/**
 * Handler: Upload Frames
 */
void handleUploadFrames() {
  // CORS Headers explizit setzen
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (!server.hasArg("plain")) {
    server.send(400, "application/json", "{\"error\":\"No data received\"}");
    return;
  }
  
  String body = server.arg("plain");
  Serial.println("Received frames data: " + String(body.length()) + " bytes");
  
  // Parse JSON
  DynamicJsonDocument doc(32768); // 32KB für große Frame-Arrays
  DeserializationError error = deserializeJson(doc, body);
  
  if (error) {
    Serial.println("JSON parse error: " + String(error.c_str()));
    server.send(400, "application/json", "{\"error\":\"Invalid JSON\"}");
    return;
  }
  
  // Speichere Frames
  if (saveFrames(body)) {
    frameCount = doc["frames"].size();
    
    StaticJsonDocument<200> response;
    response["success"] = true;
    response["frameCount"] = frameCount;
    response["message"] = "Frames saved successfully";
    
    String responseStr;
    serializeJson(response, responseStr);
    server.send(200, "application/json", responseStr);
    
    Serial.println("Frames saved: " + String(frameCount));
  } else {
    server.send(500, "application/json", "{\"error\":\"Failed to save frames\"}");
  }
}

/**
 * Handler: Get Frames
 */
void handleGetFrames() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  
  File file = LittleFS.open(FRAME_FILE, "r");
  if (!file) {
    server.send(404, "application/json", "{\"error\":\"No frames stored\"}");
    return;
  }
  
  String content = file.readString();
  file.close();
  
  server.send(200, "application/json", content);
}

/**
 * Handler: Clear Frames
 */
void handleClearFrames() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  
  if (LittleFS.remove(FRAME_FILE)) {
    frameCount = 0;
    server.send(200, "application/json", "{\"success\":true,\"message\":\"Frames cleared\"}");
    Serial.println("Frames cleared");
  } else {
    server.send(500, "application/json", "{\"error\":\"Failed to clear frames\"}");
  }
}

/**
 * Handler: Update Config (Device Name ändern)
 */
void handleUpdateConfig() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  
  if (!server.hasArg("plain")) {
    server.send(400, "application/json", "{\"error\":\"No data received\"}");
    return;
  }
  
  String body = server.arg("plain");
  StaticJsonDocument<256> doc;
  DeserializationError error = deserializeJson(doc, body);
  
  if (error) {
    server.send(400, "application/json", "{\"error\":\"Invalid JSON\"}");
    return;
  }
  
  // Device Name aktualisieren
  if (doc.containsKey("deviceName")) {
    String newName = doc["deviceName"].as<String>();
    if (newName.length() > 0 && newName.length() <= 32) {
      deviceName = newName;
      
      // Speichere Konfiguration
      if (saveConfig()) {
        StaticJsonDocument<200> response;
        response["success"] = true;
        response["deviceName"] = deviceName;
        response["message"] = "Device name updated";
        
        String responseStr;
        serializeJson(response, responseStr);
        server.send(200, "application/json", responseStr);
        
        Serial.println("Device name updated to: " + deviceName);
      } else {
        server.send(500, "application/json", "{\"error\":\"Failed to save config\"}");
      }
    } else {
      server.send(400, "application/json", "{\"error\":\"Invalid device name (1-32 chars)\"}");
    }
  } else {
    server.send(400, "application/json", "{\"error\":\"Missing deviceName field\"}");
  }
}

/**
 * Handler: Not Found
 */
void handleNotFound() {
  server.send(404, "application/json", "{\"error\":\"Not found\"}");
}

/**
 * Frames in LittleFS speichern
 */
bool saveFrames(String jsonData) {
  File file = LittleFS.open(FRAME_FILE, "w");
  if (!file) {
    Serial.println("Failed to open file for writing");
    return false;
  }
  
  size_t written = file.print(jsonData);
  file.close();
  
  return written > 0;
}

/**
 * Frames aus LittleFS laden
 */
void loadFrames() {
  File file = LittleFS.open(FRAME_FILE, "r");
  if (!file) {
    Serial.println("No frames file found");
    frameCount = 0;
    return;
  }
  
  String content = file.readString();
  file.close();
  
  DynamicJsonDocument doc(32768);
  DeserializationError error = deserializeJson(doc, content);
  
  if (!error && doc.containsKey("frames")) {
    frameCount = doc["frames"].size();
    Serial.println("Loaded " + String(frameCount) + " frames from storage");
  } else {
    frameCount = 0;
  }
}

/**
 * Konfiguration speichern
 */
bool saveConfig() {
  StaticJsonDocument<256> doc;
  doc["deviceId"] = deviceId;
  doc["deviceName"] = deviceName;
  
  File file = LittleFS.open(CONFIG_FILE, "w");
  if (!file) {
    Serial.println("Failed to open config file for writing");
    return false;
  }
  
  size_t written = serializeJson(doc, file);
  file.close();
  
  return written > 0;
}

/**
 * Konfiguration laden
 */
void loadConfig() {
  File file = LittleFS.open(CONFIG_FILE, "r");
  if (!file) {
    Serial.println("No config file found, using defaults");
    // Speichere Default-Config
    saveConfig();
    return;
  }
  
  StaticJsonDocument<256> doc;
  DeserializationError error = deserializeJson(doc, file);
  file.close();
  
  if (!error) {
    if (doc.containsKey("deviceName")) {
      deviceName = doc["deviceName"].as<String>();
      Serial.println("Loaded device name: " + deviceName);
    }
  } else {
    Serial.println("Failed to parse config file");
  }
}
