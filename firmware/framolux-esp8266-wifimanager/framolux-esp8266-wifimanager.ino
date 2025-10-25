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

// Frame Struktur (für OpenAI generierte Pixel-Frames)
struct Frame {
  int duration;  // Frame-Dauer in Millisekunden
  // pixels wird direkt aus JSON gelesen (16x16 Array von Hex-Farben)
};

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
  
  // WiFi verbunden!
  Serial.println("\nWiFi connected!");
  Serial.println("IP address: " + WiFi.localIP().toString());
  
  // Device-Name aus WiFi Manager Parameter übernehmen
  String newDeviceName = custom_device_name.getValue();
  if (newDeviceName.length() > 0 && newDeviceName != deviceName) {
    deviceName = newDeviceName;
    saveConfig();
  }
  
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
 * Verarbeite Serial Commands für Konfiguration
 */
void handleSerialCommands() {
  if (Serial.available() > 0) {
    String command = Serial.readStringUntil('\n');
    command.trim();
    
    if (command.startsWith("SET_WIFI:")) {
      // Format: SET_WIFI:SSID:PASSWORD
      int firstColon = command.indexOf(':', 9);
      int secondColon = command.indexOf(':', firstColon + 1);
      
      if (firstColon > 0 && secondColon > 0) {
        String ssid = command.substring(9, firstColon);
        String password = command.substring(firstColon + 1, secondColon);
        
        Serial.println("Configuring WiFi via Serial...");
        Serial.println("SSID: " + ssid);
        
        // Speichere Config
        WiFi.begin(ssid.c_str(), password.c_str());
        
        // Warte auf Verbindung
        int attempts = 0;
        while (WiFi.status() != WL_CONNECTED && attempts < 20) {
          delay(500);
          Serial.print(".");
          attempts++;
        }
        
        if (WiFi.status() == WL_CONNECTED) {
          Serial.println("\nWiFi connected via Serial!");
          Serial.println("IP: " + WiFi.localIP().toString());
          saveConfig(); // Speichere für nächsten Boot
        } else {
          Serial.println("\nWiFi connection failed!");
        }
      }
    }
    else if (command.startsWith("SET_NAME:")) {
      // Format: SET_NAME:DeviceName
      String name = command.substring(9);
      deviceName = name;
      saveConfig();
      Serial.println("Device name set to: " + deviceName);
    }
    else if (command.startsWith("SET_APIKEY:")) {
      // Format: SET_APIKEY:sk-proj-xxxxx
      String apiKey = command.substring(11);
      apiKey.trim();
      
      if (apiKey.length() > 0) {
        // Speichere API Key in LittleFS
        File file = LittleFS.open("/apikey.txt", "w");
        if (file) {
          file.println(apiKey);
          file.close();
          Serial.println("OpenAI API Key saved successfully!");
          Serial.println("Key length: " + String(apiKey.length()) + " characters");
        } else {
          Serial.println("Failed to save API Key!");
        }
      } else {
        Serial.println("Invalid API Key!");
      }
    }
    else if (command == "GET_APIKEY") {
      // Lese API Key (zeige nur erste und letzte 4 Zeichen)
      File file = LittleFS.open("/apikey.txt", "r");
      if (file) {
        String apiKey = file.readStringUntil('\n');
        apiKey.trim();
        file.close();
        
        if (apiKey.length() > 8) {
          String masked = apiKey.substring(0, 7) + "..." + apiKey.substring(apiKey.length() - 4);
          Serial.println("API Key: " + masked);
        } else {
          Serial.println("API Key: (too short to display)");
        }
      } else {
        Serial.println("No API Key configured");
      }
    }
    else if (command == "DELETE_APIKEY") {
      if (LittleFS.remove("/apikey.txt")) {
        Serial.println("API Key deleted successfully!");
      } else {
        Serial.println("No API Key to delete");
      }
    }
    else if (command == "GET_STATUS") {
      Serial.println("\n=== Device Status ===");
      Serial.println("Device ID: " + deviceId);
      Serial.println("Device Name: " + deviceName);
      Serial.println("WiFi Status: " + String(WiFi.status() == WL_CONNECTED ? "Connected" : "Disconnected"));
      if (WiFi.status() == WL_CONNECTED) {
        Serial.println("IP Address: " + WiFi.localIP().toString());
        Serial.println("SSID: " + WiFi.SSID());
      }
      
      // API Key Status
      File apiKeyFile = LittleFS.open("/apikey.txt", "r");
      if (apiKeyFile) {
        String key = apiKeyFile.readStringUntil('\n');
        key.trim();
        apiKeyFile.close();
        if (key.length() > 8) {
          String masked = key.substring(0, 7) + "..." + key.substring(key.length() - 4);
          Serial.println("OpenAI API Key: " + masked);
        } else {
          Serial.println("OpenAI API Key: Configured (short)");
        }
      } else {
        Serial.println("OpenAI API Key: Not configured");
      }
      
      Serial.println("Frame Count: " + String(frameCount));
      Serial.println("===================\n");
    }
    else if (command == "RESET_WIFI") {
      Serial.println("Resetting WiFi config...");
      WiFi.disconnect(true);
      delay(1000);
      ESP.restart();
    }
  }
}

/**
 * Konvertiere Hex-Farbe zu CRGB
 */
CRGB hexToRGB(String hexColor) {
  // Entferne # falls vorhanden
  hexColor.replace("#", "");
  
  long number = strtol(hexColor.c_str(), NULL, 16);
  int r = number >> 16;
  int g = (number >> 8) & 0xFF;
  int b = number & 0xFF;
  
  return CRGB(r, g, b);
}

/**
 * Zeige Pixel-Array auf LED Matrix
 * Konvertiert 16x16 Pixel-Array zu LED Matrix Layout
 */
void displayPixelArray(JsonArray pixelArray) {
  // pixelArray ist ein 16x16 Array von Hex-Farben
  // z.B. [["#FF0000", "#00FF00", ...], [...], ...]
  
  int arrayHeight = pixelArray.size();
  
  for (int y = 0; y < arrayHeight && y < MATRIX_HEIGHT; y++) {
    JsonArray row = pixelArray[y];
    int arrayWidth = row.size();
    
    for (int x = 0; x < arrayWidth && x < MATRIX_WIDTH; x++) {
      String hexColor = row[x].as<String>();
      CRGB color = hexToRGB(hexColor);
      
      // Berechne LED-Index basierend auf Matrix-Layout
      // Annahme: Serpentine Layout (Zick-Zack)
      int ledIndex;
      if (y % 2 == 0) {
        // Gerade Zeile: links nach rechts
        ledIndex = y * MATRIX_WIDTH + x;
      } else {
        // Ungerade Zeile: rechts nach links
        ledIndex = y * MATRIX_WIDTH + (MATRIX_WIDTH - 1 - x);
      }
      
      if (ledIndex < NUM_LEDS) {
        leds[ledIndex] = color;
      }
    }
  }
  
  FastLED.show();
}

/**
 * Lade und zeige Frames
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
  
  // Lade Frames aus LittleFS und zeige sie
  File file = LittleFS.open(FRAME_FILE, "r");
  if (!file) return;
  
  StaticJsonDocument<4096> doc;
  DeserializationError error = deserializeJson(doc, file);
  file.close();
  
  if (error) return;
  
  JsonArray framesArray = doc["frames"];
  if (framesArray.size() == 0) return;
  
  // Zeige aktuellen Frame
  if (currentFrameIndex < 0 || currentFrameIndex >= (int)framesArray.size()) {
    currentFrameIndex = 0;
    frameStartTime = millis();
  }
  
  JsonObject frameObj = framesArray[currentFrameIndex];
  
  // Hole Frame-Daten
  int duration = frameObj["duration"] | 3000;
  JsonArray pixels = frameObj["pixels"];
  
  // Zeige Frame (Pixel-Array)
  if (pixels.size() > 0) {
    displayPixelArray(pixels);
  }
  
  // Wechsle zum nächsten Frame nach Ablauf der Duration
  if (millis() - frameStartTime > (unsigned long)duration) {
    currentFrameIndex++;
    if (currentFrameIndex >= (int)framesArray.size()) {
      currentFrameIndex = 0; // Loop
    }
    frameStartTime = millis();
  }
}

/**
 * Main Loop
 */
void loop() {
  // HTTP Server
  server.handleClient();
  
  // Serial Commands
  handleSerialCommands();
  
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
  // CORS Headers für alle Requests
  server.enableCORS(true);
  
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
  
  // 404 Handler
  server.onNotFound(handleNotFound);
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
 * Handler: Upload Frames
 */
void handleUploadFrames() {
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
