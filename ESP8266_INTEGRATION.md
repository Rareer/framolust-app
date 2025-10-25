# ESP8266 Integration Guide

## Übersicht

Die Framolux-App kann generierte LED-Animationen direkt auf einen ESP8266 hochladen, der dann die Frames persistent speichert und an einen LED-Strip ausgibt.

## Architektur

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────┐
│   WebApp        │         │   ESP8266        │         │  LED Strip  │
│  (Browser)      │◄───────►│  (Webserver)     │◄───────►│  (WS2812B)  │
│                 │  WiFi   │                  │  GPIO   │             │
└─────────────────┘         └──────────────────┘         └─────────────┘
```

## Workflow

### 1. Initial Setup (einmalig)

1. **WiFi-Credentials konfigurieren**
   - In der WebApp WLAN-Name und Passwort eingeben
   - Konfiguration wird lokal gespeichert

2. **Firmware kompilieren**
   - Arduino CLI installieren (siehe `ARDUINO_CLI_SETUP.md`)
   - Build-Script ausführen mit WiFi-Credentials
   - Firmware wird mit eingebetteten Credentials kompiliert

3. **ESP8266 flashen**
   - ESP8266 per USB verbinden
   - Upload-Befehl ausführen
   - ESP8266 bootet und verbindet sich mit WLAN

### 2. Runtime (normale Nutzung)

1. **Gerät finden**
   - WebApp sucht nach ESP8266 im lokalen Netzwerk
   - Automatisch via mDNS (`framolux.local`)
   - Oder manuelle IP-Eingabe

2. **Frames hochladen**
   - Animation in WebApp generieren
   - "Frames hochladen" klicken
   - Frames werden per HTTP POST an ESP8266 gesendet
   - ESP8266 speichert Frames in LittleFS (persistent)

3. **Animation läuft**
   - ESP8266 spielt Frames in Endlosschleife ab
   - Auch nach Stromausfall bleiben Frames erhalten

## Hardware-Anforderungen

### ESP8266 Board
- NodeMCU v2/v3 (empfohlen)
- WEMOS D1 Mini
- Oder jedes andere ESP8266-Board

### LED Strip
- WS2812B / NeoPixel kompatibel
- 5V Stromversorgung
- Anzahl LEDs konfigurierbar

### Verkabelung
```
ESP8266 (D4/GPIO2) ──► LED Strip (Data In)
5V Power Supply    ──► LED Strip (5V)
GND                ──► LED Strip (GND) + ESP8266 (GND)
```

**Wichtig:** Bei mehr als 10 LEDs separates 5V Netzteil verwenden!

## API Endpoints (ESP8266)

### GET /
HTML-Statusseite mit Device-Info

### GET /status
```json
{
  "status": "online",
  "deviceId": "AABBCCDDEEFF",
  "ip": "192.168.1.100",
  "frameCount": 42,
  "freeHeap": 35000,
  "uptime": 3600
}
```

### GET /info
```json
{
  "deviceId": "AABBCCDDEEFF",
  "deviceName": "framolux",
  "ip": "192.168.1.100",
  "mac": "AA:BB:CC:DD:EE:FF",
  "ssid": "MyWiFi",
  "rssi": -45,
  "chipId": 12345678,
  "flashSize": 4194304,
  "freeHeap": 35000,
  "version": "1.0.0"
}
```

### POST /frames
Upload Frames zum Gerät

**Request:**
```json
{
  "frames": [
    {
      "duration": 100,
      "leds": ["#FF0000", "#00FF00", "#0000FF"]
    }
  ],
  "totalFrames": 1,
  "timestamp": 1234567890
}
```

**Response:**
```json
{
  "success": true,
  "frameCount": 1,
  "message": "Frames saved successfully"
}
```

### GET /frames
Hole gespeicherte Frames vom Gerät

**Response:**
```json
{
  "frames": [...],
  "totalFrames": 42
}
```

### DELETE /frames
Lösche alle gespeicherten Frames

**Response:**
```json
{
  "success": true,
  "message": "Frames cleared"
}
```

## Build-Commands

### Windows (PowerShell)
```powershell
# Nur kompilieren
.\firmware\build.ps1 -SSID "MeinWLAN" -Password "MeinPasswort"

# Kompilieren und hochladen
.\firmware\build.ps1 -SSID "MeinWLAN" -Password "MeinPasswort" -Upload

# Spezifisches Board
.\firmware\build.ps1 -SSID "MeinWLAN" -Password "MeinPasswort" -Board "esp8266:esp8266:d1_mini" -Upload
```

### Linux/macOS (Bash)
```bash
# Nur kompilieren
./firmware/build.sh --ssid "MeinWLAN" --password "MeinPasswort"

# Kompilieren und hochladen
./firmware/build.sh --ssid "MeinWLAN" --password "MeinPasswort" --upload

# Spezifisches Board
./firmware/build.sh --ssid "MeinWLAN" --password "MeinPasswort" --board "esp8266:esp8266:d1_mini" --upload
```

## Geräte-Discovery

### Automatisch (mDNS)
Der ESP8266 registriert sich als `framolux.local` im lokalen Netzwerk.

**Browser-Zugriff:**
```
http://framolux.local/
```

**Von der WebApp:**
Die WebApp kann das Gerät automatisch finden, wenn beide im gleichen WLAN sind.

### Manuell (IP-Adresse)
1. Serial Monitor öffnen nach dem Upload:
   ```bash
   arduino-cli monitor -p COM3 -c baudrate=115200
   ```
2. IP-Adresse notieren (z.B. `192.168.1.100`)
3. In WebApp unter "Manuelle IP-Eingabe" eintragen

## Troubleshooting

### ESP8266 verbindet sich nicht mit WLAN
- SSID und Passwort überprüfen
- 2.4 GHz WLAN verwenden (ESP8266 unterstützt kein 5 GHz)
- Router-Einstellungen prüfen (MAC-Filter, etc.)

### Gerät nicht im Netzwerk gefunden
- Beide Geräte im gleichen WLAN?
- Firewall blockiert mDNS?
- Manuelle IP-Eingabe verwenden

### Upload schlägt fehl
- USB-Treiber installiert? (CH340/CP2102)
- Richtiger Port ausgewählt?
- ESP8266 in Flash-Modus? (GPIO0 auf GND beim Booten)

### Frames werden nicht gespeichert
- Genug freier Speicher? (GET /status → freeHeap)
- JSON valide?
- LittleFS formatiert? (passiert automatisch beim ersten Boot)

### LEDs leuchten nicht
- Verkabelung korrekt?
- 5V Stromversorgung ausreichend?
- Richtiger GPIO-Pin? (Standard: D4/GPIO2)

## Erweiterte Konfiguration

### LED-Anzahl ändern
In `framolux-esp8266.ino`:
```cpp
#define NUM_LEDS 60  // Anzahl der LEDs
```

### GPIO-Pin ändern
```cpp
#define LED_PIN 2  // GPIO2 = D4 auf NodeMCU
```

### Webserver-Port ändern
```cpp
#define WEB_SERVER_PORT 8080
```

## Sicherheit

**Wichtig:** Die WiFi-Credentials werden in die Firmware eingebettet!

- Firmware-Dateien (.bin) nicht öffentlich teilen
- Bei Weitergabe des ESP8266: Firmware neu flashen
- Für Produktion: Credentials über Captive Portal eingeben lassen

## Nächste Schritte

1. ✅ Arduino CLI installieren
2. ✅ Firmware kompilieren mit WiFi-Credentials
3. ✅ ESP8266 flashen
4. ✅ In WebApp Gerät suchen
5. ✅ Frames hochladen
6. 🎨 Animation genießen!

## Weitere Ressourcen

- [Arduino CLI Dokumentation](https://arduino.github.io/arduino-cli/)
- [ESP8266 Arduino Core](https://github.com/esp8266/Arduino)
- [WS2812B LED Strip Guide](https://learn.adafruit.com/adafruit-neopixel-uberguide)
