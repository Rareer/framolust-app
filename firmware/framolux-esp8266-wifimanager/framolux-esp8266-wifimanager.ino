/**
 * Framolux ESP8266 Firmware mit WiFi Manager
 * 
 * Features:
 * - WiFi Manager für initiale Konfiguration (kein Hardcoding!)
 * - Webserver für Frame-Upload
 * - Persistente Speicherung in LittleFS
 * - mDNS für automatische Discovery
 * - REST API für Frame-Management
 * - Kann vorkompiliert werden - keine Credentials im Code!
 */

#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <ESP8266mDNS.h>
#include <LittleFS.h>
#include <ArduinoJson.h>
#include <WiFiManager.h> // https://github.com/tzapu/WiFiManager
#include <FastLED.h>      // https://github.com/FastLED/FastLED

// Device ID (wird beim Kompilieren gesetzt, oder zufällig generiert)
#ifndef DEVICE_ID
#define DEVICE_ID ""
#endif

// Konfiguration
#define DEFAULT_DEVICE_NAME "framolux"
#define WEB_SERVER_PORT 80
#define MAX_FRAMES 100
#define FRAME_FILE "/frames.json"
#define CONFIG_FILE "/config.json"

// Hardware Pin Configuration
#define DATA_PIN D4        // GPIO2 - Pin für LED Matrix / Display
#define LED_TYPE WS2812B   // LED Typ (WS2812B, WS2811, APA102, etc.)
#define COLOR_ORDER GRB    // Farbreihenfolge (GRB für WS2812B)
#define MATRIX_WIDTH 16    // Breite der LED Matrix (muss mit OpenAI Schema übereinstimmen!)
#define MATRIX_HEIGHT 16   // Höhe der LED Matrix (muss mit OpenAI Schema übereinstimmen!)
#define NUM_LEDS (MATRIX_WIDTH * MATRIX_HEIGHT)  // = 256 LEDs
#define BRIGHTNESS 50      // Helligkeit (0-255)
#define WIFI_CONFIG_FILE "/wifi.json"

ESP8266WebServer server(WEB_SERVER_PORT);
WiFiManager wifiManager;

// Globale Variablen
String deviceId;
String deviceName = DEFAULT_DEVICE_NAME;
String macAddress;
int frameCount = 0;

// LED Matrix
CRGB leds[NUM_LEDS];
int currentFrameIndex = -1;
unsigned long frameStartTime = 0;

// Frame Strukturen
struct Frame {
  int duration;  // Frame-Dauer in Millisekunden
  // pixels wird direkt aus JSON gelesen (16x16 Array von Hex-Farben)
};

// Binäres Frame-Format
struct FrameHeader {
  uint32_t duration;
  uint8_t width;
  uint8_t height;
  uint16_t reserved;
} __attribute__((packed));

// Binäres Animation-Format
struct AnimationHeader {
  char magic[4];      // "FMLX"
  uint16_t version;
  uint16_t frameCount;
  uint8_t loop;
  uint8_t reserved[7];
} __attribute__((packed));

// WiFi Manager Callback
void configModeCallback(WiFiManager *myWiFiManager) {
  Serial.println("Entered config mode");
  Serial.println("AP IP: " + WiFi.softAPIP().toString());
  Serial.println("AP SSID: " + String(myWiFiManager->getConfigPortalSSID()));
}

/**
 * Setup-Funktion
 */
void setup() {
  Serial.begin(115200);
  delay(100);
  
  // Firmware Identifier für Web Serial Detection
  Serial.println("\n\n=== FRAMOLUX FIRMWARE ===");
  Serial.println("Firmware: framolux");
  Serial.println("Version: 2.0.0");
  Serial.println("=========================\n");
  
  Serial.println("Framolux ESP8266 Starting...");
  
  // Speichere MAC-Adresse
  macAddress = WiFi.macAddress();
  
  // Generiere Device ID falls nicht gesetzt
  if (String(DEVICE_ID).length() == 0) {
    // Generiere aus MAC-Adresse
    deviceId = "FLX";
    String mac = macAddress;
    mac.replace(":", "");
    deviceId += mac.substring(mac.length() - 6); // Letzte 6 Zeichen
  } else {
    deviceId = String(DEVICE_ID);
  }
  
  Serial.println("Device ID: " + deviceId);
  Serial.println("MAC Address: " + macAddress);
  
  // FastLED / LED Matrix initialisieren
  FastLED.addLeds<LED_TYPE, DATA_PIN, COLOR_ORDER>(leds, NUM_LEDS);
  FastLED.setBrightness(BRIGHTNESS);
  FastLED.clear();
  FastLED.show();
  Serial.println("LED Matrix initialized: " + String(MATRIX_WIDTH) + "x" + String(MATRIX_HEIGHT) + " = " + String(NUM_LEDS) + " LEDs");
  
  // Startup Animation: Kurzes Blinken
  fill_solid(leds, NUM_LEDS, CRGB::Blue);
  FastLED.show();
  delay(200);
  FastLED.clear();
  FastLED.show();
  
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
  
  // WiFi Manager Setup
  wifiManager.setAPCallback(configModeCallback);
  wifiManager.setSaveConfigCallback(saveWiFiConfig);
  
  // Setze Timeout und Debug-Modus
  wifiManager.setConfigPortalTimeout(300); // 5 Minuten
  wifiManager.setDebugOutput(true);
  
  // Setze WiFi Mode explizit
  WiFi.mode(WIFI_AP_STA);
  
  // Custom Parameter für Device-Name
  WiFiManagerParameter custom_device_name("device_name", "Device Name (optional)", deviceName.c_str(), 32);
  wifiManager.addParameter(&custom_device_name);
  
  // AP Name: Verwende Custom-Name falls gesetzt, sonst Device-ID
  String apName;
  if (deviceName.length() > 0 && deviceName != DEFAULT_DEVICE_NAME) {
    apName = "Framolux-" + deviceName + "-" + deviceId.substring(deviceId.length() - 4);
  } else {
    apName = "Framolux-" + deviceId;
  }
  
  // WICHTIG: Setze Hostname BEVOR WiFi Manager startet
  String hostname = "framolux-" + deviceId;
  hostname.toLowerCase();
  WiFi.hostname(hostname);
  Serial.println("WiFi Hostname set to: " + hostname);
  
  Serial.println("\n=== WiFi Manager Starting ===");
  Serial.println("AP Name: " + apName);
  Serial.println("AP Password: framolux123");
  Serial.println("AP Channel: 1 (2.4 GHz)");
  Serial.println("Please connect to this WiFi network!");
  Serial.println("============================\n");
  
  // Versuche zu verbinden, oder starte Config Portal
  if (!wifiManager.autoConnect(apName.c_str(), "framolux123")) {
    Serial.println("Failed to connect and hit timeout");
    delay(3000);
    ESP.restart();
  }
  
  // Device-Name aus WiFi Manager Parameter übernehmen
  String newDeviceName = custom_device_name.getValue();
  if (newDeviceName.length() > 0 && newDeviceName != deviceName) {
    deviceName = newDeviceName;
    saveConfig();
  }
  
  // WiFi verbunden!
  Serial.println("\nWiFi connected!");
  Serial.println("IP address: " + WiFi.localIP().toString());
  
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
  Serial.println("\n=================================");
  Serial.println("Ready!");
  Serial.println("Device ID: " + deviceId);
  Serial.println("Device Name: " + deviceName);
  Serial.println("IP: " + WiFi.localIP().toString());
  Serial.println("mDNS: " + mdnsName + ".local");
  Serial.println("=================================\n");
}




/**
 * Lade und zeige Frame aus binärem Format
 */
bool loadBinaryFrame(File& file, int frameIndex, uint32_t& duration) {
  // Lese Animation-Header
  file.seek(0);
  AnimationHeader animHeader;
  file.read((uint8_t*)&animHeader, sizeof(AnimationHeader));
  
  if (frameIndex >= animHeader.frameCount) {
    return false;
  }
  
  // Überspringe zum gewünschten Frame
  size_t offset = sizeof(AnimationHeader);
  for (int i = 0; i < frameIndex; i++) {
    file.seek(offset);
    FrameHeader header;
    file.read((uint8_t*)&header, sizeof(FrameHeader));
    offset += sizeof(FrameHeader) + (header.width * header.height * 3);
  }
  
  // Lese Frame-Header
  file.seek(offset);
  FrameHeader header;
  file.read((uint8_t*)&header, sizeof(FrameHeader));
  
  duration = header.duration;
  
  // Lese Pixel-Daten direkt in LED-Array
  uint8_t rgb[3];
  for (int y = 0; y < header.height && y < MATRIX_HEIGHT; y++) {
    for (int x = 0; x < header.width && x < MATRIX_WIDTH; x++) {
      file.read(rgb, 3);
      
      // Berechne LED-Index (Serpentine)
      int ledIndex;
      if (y % 2 == 0) {
        ledIndex = y * MATRIX_WIDTH + x;
      } else {
        ledIndex = y * MATRIX_WIDTH + (MATRIX_WIDTH - 1 - x);
      }
      
      if (ledIndex < NUM_LEDS) {
        leds[ledIndex] = CRGB(rgb[0], rgb[1], rgb[2]);
      }
    }
  }
  
  FastLED.show();
  return true;
}

/**
 * Lade und zeige Frames (nur Binär-Format)
 */
void updateFrameDisplay() {
  // Prüfe ob Frames vorhanden sind
  if (frameCount == 0) {
    // Keine Frames - zeige Idle-Animation
    static unsigned long lastUpdate = 0;
    if (millis() - lastUpdate > 2000) {
      lastUpdate = millis();
      
      // Sanftes Pulsieren in Blau
      static uint8_t hue = 0;
      fill_solid(leds, NUM_LEDS, CHSV(160, 255, 50 + sin8(hue) / 5));
      FastLED.show();
      hue += 2;
    }
    return;
  }
  
  // Initialisiere Frame-Index beim ersten Mal
  if (currentFrameIndex < 0) {
    currentFrameIndex = 0;
    frameStartTime = millis();
    Serial.println("📦 Starting BINARY animation playback");
  }
  
  // Prüfe ob es Zeit ist, den Frame zu wechseln
  static unsigned long lastFrameLoad = 0;
  unsigned long now = millis();
  
  // Lade Frame nur wenn nötig (bei Frame-Wechsel)
  if (now - lastFrameLoad > 100) { // Maximal alle 100ms neu laden
    lastFrameLoad = now;
    
    File file = LittleFS.open(FRAME_FILE, "r");
    if (!file) {
      Serial.println("Failed to open frames file");
      return;
    }
    
    uint32_t duration = 3000;
    
    // Lade binären Frame direkt
    if (!loadBinaryFrame(file, currentFrameIndex, duration)) {
      file.close();
      return;
    }
    
    file.close();
    
    // Wechsle zum nächsten Frame nach Ablauf der Duration
    if (now - frameStartTime > duration) {
      currentFrameIndex++;
      if (currentFrameIndex >= frameCount) {
        currentFrameIndex = 0; // Loop
      }
      frameStartTime = now;
    }
  }
}

/**
 * Main Loop
 */
void loop() {
  // HTTP Server
  server.handleClient();
  
  // mDNS Update
  MDNS.update();
  
  // LED Matrix Update
  updateFrameDisplay();
  
  delay(10);
}

/**
 * WiFi Config speichern Callback
 */
void saveWiFiConfig() {
  Serial.println("WiFi config saved");
}

/**
 * Webserver Routes konfigurieren
 */
void setupRoutes() {
  // WICHTIG: enableCORS(true) NICHT verwenden - führt zu doppelten Headers!
  // Wir setzen CORS-Header manuell in jedem Handler
  
  // OPTIONS Handler für CORS Preflight Requests
  server.on("/frames", HTTP_OPTIONS, []() {
    Serial.println("OPTIONS /frames");
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.sendHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    server.sendHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    server.sendHeader("Access-Control-Max-Age", "86400");
    server.send(204);
  });
  
  server.on("/config", HTTP_OPTIONS, []() {
    Serial.println("OPTIONS /config");
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.sendHeader("Access-Control-Allow-Methods", "PUT, OPTIONS");
    server.sendHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    server.sendHeader("Access-Control-Max-Age", "86400");
    server.send(204);
  });
  
  server.on("/reset-wifi", HTTP_OPTIONS, []() {
    Serial.println("OPTIONS /reset-wifi");
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.sendHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
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
  server.on("/api/info", HTTP_GET, handleInfo); // Alias für Discovery
  
  // PUT /config - Update Device Config (Name ändern)
  server.on("/config", HTTP_PUT, handleUpdateConfig);
  
  // POST /reset-wifi - Reset WiFi Settings (startet Config Portal)
  server.on("/reset-wifi", HTTP_POST, handleResetWiFi);
  
  // 404 Handler mit OPTIONS-Unterstützung
  server.onNotFound([]() {
    if (server.method() == HTTP_OPTIONS) {
      Serial.println("OPTIONS request (catch-all) for: " + server.uri());
      server.sendHeader("Access-Control-Allow-Origin", "*");
      server.sendHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      server.sendHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      server.sendHeader("Access-Control-Max-Age", "86400");
      server.send(204);
    } else {
      handleNotFound();
    }
  });
}

/**
 * Handler: Root
 */
void handleRoot() {
  String html = "<html><head><meta charset='utf-8'></head><body>";
  html += "<h1>Framolux ESP8266</h1>";
  html += "<p><strong>Device ID:</strong> " + deviceId + "</p>";
  html += "<p><strong>Device Name:</strong> " + deviceName + "</p>";
  html += "<p><strong>IP:</strong> " + WiFi.localIP().toString() + "</p>";
  html += "<p><strong>SSID:</strong> " + WiFi.SSID() + "</p>";
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
  html += "<li>POST /reset-wifi - Reset WiFi settings</li>";
  html += "</ul>";
  html += "<h2>Actions:</h2>";
  html += "<button onclick=\"if(confirm('Reset WiFi?')) fetch('/reset-wifi', {method:'POST'})\">Reset WiFi Settings</button>";
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
  doc["firmware"] = "framolux";  // Identifier für Framolux Firmware
  doc["version"] = "2.0.0";
  doc["deviceId"] = deviceId;
  doc["deviceName"] = deviceName;
  doc["ip"] = WiFi.localIP().toString();
  doc["mac"] = macAddress;
  doc["ssid"] = WiFi.SSID();
  doc["rssi"] = WiFi.RSSI();
  doc["chipId"] = ESP.getChipId();
  doc["flashSize"] = ESP.getFlashChipSize();
  doc["freeHeap"] = ESP.getFreeHeap();
  doc["frameCount"] = frameCount;
  
  String response;
  serializeJson(doc, response);
  server.send(200, "application/json", response);
}

/**
 * Handler: Upload Frames (nur Binär-Format)
 */
void handleUploadFrames() {
  // CORS Headers explizit setzen
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  
  Serial.println("=== POST /frames ===");
  Serial.println("Content-Type: " + server.header("Content-Type"));
  Serial.println("Content-Length: " + server.header("Content-Length"));
  
  // WICHTIG: ESP8266WebServer hat die Daten bereits gelesen!
  // Wir müssen server.arg("plain") verwenden, aber vorsichtig mit den Bytes umgehen
  
  if (!server.hasArg("plain")) {
    Serial.println("ERROR: No body data received!");
    server.send(400, "application/json", "{\"error\":\"No data received\"}");
    return;
  }
  
  // Hole die Daten als String (enthält aber binäre Daten)
  String body = server.arg("plain");
  size_t dataSize = body.length();
  
  Serial.println("Received data: " + String(dataSize) + " bytes");
  
  if (dataSize == 0) {
    Serial.println("ERROR: Empty body!");
    server.send(400, "application/json", "{\"error\":\"No data received\"}");
    return;
  }
  
  if (dataSize > 100000) {
    Serial.println("ERROR: Data size too large: " + String(dataSize));
    server.send(400, "application/json", "{\"error\":\"Data too large\"}");
    return;
  }
  
  // Allokiere Buffer und kopiere Bytes
  // WICHTIG: Verwende c_str() um direkt auf die Bytes zuzugreifen
  uint8_t* data = (uint8_t*)malloc(dataSize);
  if (!data) {
    Serial.println("ERROR: Failed to allocate memory!");
    server.send(500, "application/json", "{\"error\":\"Out of memory\"}");
    return;
  }
  
  // Kopiere die Bytes direkt (nicht als String behandeln!)
  memcpy(data, body.c_str(), dataSize);
  
  Serial.println("Binary data size: " + String(dataSize) + " bytes");
  
  // Prüfe Mindestgröße (Animation-Header)
  if (dataSize < sizeof(AnimationHeader)) {
    Serial.println("ERROR: Data too small for animation header");
    server.send(400, "application/json", "{\"error\":\"Invalid binary data\"}");
    return;
  }
  
  // Lese Animation-Header
  AnimationHeader animHeader;
  memcpy(&animHeader, data, sizeof(AnimationHeader));
  
  // Prüfe Magic-Bytes
  if (strncmp(animHeader.magic, "FMLX", 4) != 0) {
    Serial.println("ERROR: Invalid magic bytes");
    server.send(400, "application/json", "{\"error\":\"Invalid binary format\"}");
    return;
  }
  
  Serial.println("✓ Valid binary format detected");
  Serial.println("  Version: " + String(animHeader.version));
  Serial.println("  Frame count: " + String(animHeader.frameCount));
  Serial.println("  Loop: " + String(animHeader.loop ? "Yes" : "No"));
  
  // Speichere binäre Daten direkt
  File file = LittleFS.open(FRAME_FILE, "w");
  if (!file) {
    Serial.println("ERROR: Failed to open file for writing");
    server.send(500, "application/json", "{\"error\":\"Failed to save frames\"}");
    return;
  }
  
  size_t written = file.write(data, dataSize);
  file.close();
  
  // Gebe Speicher frei
  free(data);
  
  if (written != dataSize) {
    Serial.println("ERROR: Write size mismatch");
    server.send(500, "application/json", "{\"error\":\"Failed to save frames\"}");
    return;
  }
  
  frameCount = animHeader.frameCount;
  
  StaticJsonDocument<200> response;
  response["success"] = true;
  response["frameCount"] = frameCount;
  response["message"] = "Frames saved successfully (Binary)";
  response["bytesWritten"] = written;
  response["compression"] = "binary";
  
  String responseStr;
  serializeJson(response, responseStr);
  server.send(200, "application/json", responseStr);
  
  Serial.println("✓ Binary frames saved: " + String(frameCount) + " frames, " + String(written) + " bytes");
  Serial.println("Animation will start playing now!");
  
  // Reset Format-Check für neue Animation
  currentFrameIndex = -1;
}

/**
 * Handler: Get Frames (Binär-Format)
 */
void handleGetFrames() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  
  File file = LittleFS.open(FRAME_FILE, "r");
  if (!file) {
    server.send(404, "application/json", "{\"error\":\"No frames stored\"}");
    return;
  }
  
  // Lese Dateigröße
  size_t fileSize = file.size();
  
  if (fileSize == 0) {
    file.close();
    server.send(404, "application/json", "{\"error\":\"No frames stored\"}");
    return;
  }
  
  // Sende binäre Daten direkt
  server.setContentLength(fileSize);
  server.send(200, "application/octet-stream", "");
  
  // Streame Datei in Chunks
  uint8_t buffer[512];
  while (file.available()) {
    size_t bytesRead = file.read(buffer, sizeof(buffer));
    server.client().write(buffer, bytesRead);
  }
  
  file.close();
  Serial.println("✓ Sent " + String(fileSize) + " bytes of binary frame data");
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
 * Handler: Reset WiFi Settings
 */
void handleResetWiFi() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", "{\"success\":true,\"message\":\"WiFi settings reset. Restarting...\"}");
  delay(1000);
  
  wifiManager.resetSettings();
  ESP.restart();
}

/**
 * Handler: Not Found
 */
void handleNotFound() {
  server.send(404, "application/json", "{\"error\":\"Not found\"}");
}

/**
 * Frames aus LittleFS laden (Binär-Format)
 */
void loadFrames() {
  File file = LittleFS.open(FRAME_FILE, "r");
  if (!file) {
    Serial.println("No frames file found");
    frameCount = 0;
    return;
  }
  
  // Lese Animation-Header
  AnimationHeader animHeader;
  size_t bytesRead = file.read((uint8_t*)&animHeader, sizeof(AnimationHeader));
  file.close();
  
  if (bytesRead != sizeof(AnimationHeader)) {
    Serial.println("Failed to read animation header");
    frameCount = 0;
    return;
  }
  
  // Prüfe Magic-Bytes
  if (strncmp(animHeader.magic, "FMLX", 4) != 0) {
    Serial.println("Invalid binary format in stored file");
    frameCount = 0;
    return;
  }
  
  frameCount = animHeader.frameCount;
  Serial.println("Loaded " + String(frameCount) + " frames from storage (binary)");
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
