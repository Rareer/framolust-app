# 🚀 ESP8266 Quickstart Guide

## Überblick

Mit dieser Anleitung kannst du in wenigen Schritten deinen ESP8266 mit Framolux verbinden und LED-Animationen drahtlos hochladen.

## Was du brauchst

- ✅ ESP8266 Board (NodeMCU, WEMOS D1 Mini, etc.)
- ✅ USB-Kabel
- ✅ WS2812B LED-Strip
- ✅ 5V Netzteil (bei >10 LEDs)
- ✅ WLAN-Zugang (2.4 GHz)

## 🎯 Schnellstart (3 Schritte)

### Schritt 1: Arduino CLI installieren

**Windows:**
```powershell
# Download & Installation
Invoke-WebRequest -Uri "https://downloads.arduino.cc/arduino-cli/arduino-cli_latest_Windows_64bit.zip" -OutFile "arduino-cli.zip"
Expand-Archive -Path "arduino-cli.zip" -DestinationPath "$env:LOCALAPPDATA\Arduino15\bin"
$env:Path += ";$env:LOCALAPPDATA\Arduino15\bin"

# ESP8266 Core installieren
arduino-cli config init
arduino-cli config add board_manager.additional_urls http://arduino.esp8266.com/stable/package_esp8266com_index.json
arduino-cli core update-index
arduino-cli core install esp8266:esp8266
arduino-cli lib install "ESP8266WebServer" "ArduinoJson" "LittleFS"
```

**macOS/Linux:**
```bash
# Download & Installation
curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sh
export PATH=$PATH:$HOME/bin

# ESP8266 Core installieren
arduino-cli config init
arduino-cli config add board_manager.additional_urls http://arduino.esp8266.com/stable/package_esp8266com_index.json
arduino-cli core update-index
arduino-cli core install esp8266:esp8266
arduino-cli lib install "ESP8266WebServer" "ArduinoJson" "LittleFS"
```

### Schritt 2: Firmware flashen

1. **ESP8266 per USB verbinden**

2. **In der WebApp:**
   - Klicke auf den 🖥️ ESP8266-Button (oben rechts)
   - Gib deine WLAN-Credentials ein
   - Kopiere den generierten Build-Befehl

3. **Im Terminal ausführen:**
   ```powershell
   # Windows (im Projekt-Ordner)
   .\firmware\build.ps1 -SSID "DeinWLAN" -Password "DeinPasswort" -Upload
   
   # Optional: Eigene Device-ID vergeben (für mehrere Geräte)
   .\firmware\build.ps1 -SSID "DeinWLAN" -Password "DeinPasswort" -DeviceId "WOHNZIMMER" -Upload
   ```
   
   ```bash
   # macOS/Linux (im Projekt-Ordner)
   ./firmware/build.sh --ssid "DeinWLAN" --password "DeinPasswort" --upload
   
   # Optional: Eigene Device-ID vergeben (für mehrere Geräte)
   ./firmware/build.sh --ssid "DeinWLAN" --password "DeinPasswort" --device-id "WOHNZIMMER" --upload
   ```

4. **Warte bis "Upload successful!" erscheint**
   - Die Device-ID wird angezeigt (z.B. `FLX123456`)
   - Notiere diese für mehrere Geräte

### Schritt 3: Frames hochladen

1. **In der WebApp:**
   - Klicke wieder auf den 🖥️ ESP8266-Button
   - Klicke auf "Nach Geräten suchen" oder gib die IP manuell ein
   - Wähle dein Gerät aus (z.B. `FLX123456`)
   - Optional: Benenne es um (✏️ → "Wohnzimmer")
   - Generiere eine Animation
   - Klicke auf "Frames hochladen"

2. **Fertig!** 🎉
   - Die Animation läuft jetzt auf deinem ESP8266
   - Auch nach dem Ausschalten bleiben die Frames gespeichert
   - Der Name bleibt ebenfalls gespeichert

## 🔧 Verkabelung

```
ESP8266 (D4/GPIO2) ──► LED Strip (Data In)
5V Netzteil        ──► LED Strip (5V + GND)
ESP8266 GND        ──► LED Strip GND
```

**⚠️ Wichtig:** 
- Bei mehr als 10 LEDs: Separates 5V Netzteil verwenden!
- GND von ESP8266 und Netzteil verbinden (gemeinsame Masse)

## 🌐 Gerät finden

### Automatisch (mDNS)
Der ESP8266 ist unter `framolux.local` erreichbar.

### Manuell (IP-Adresse)
1. Serial Monitor öffnen:
   ```bash
   arduino-cli monitor -p COM3 -c baudrate=115200
   ```
2. IP-Adresse notieren (z.B. `192.168.1.100`)
3. In WebApp unter "Manuelle IP-Eingabe" eintragen

## 📱 Workflow

```
┌─────────────────────────────────────────────────────────┐
│  1. Animation in WebApp generieren (OpenAI)             │
│  2. Auf ESP8266-Button klicken                          │
│  3. Gerät auswählen                                     │
│  4. "Frames hochladen" klicken                          │
│  5. Animation läuft auf LED-Strip! 🎨                   │
└─────────────────────────────────────────────────────────┘
```

## 🆘 Probleme?

### ESP8266 verbindet sich nicht mit WLAN
- ✅ SSID und Passwort korrekt?
- ✅ 2.4 GHz WLAN? (ESP8266 unterstützt kein 5 GHz)
- ✅ Router erlaubt neue Geräte?

### Gerät nicht gefunden
- ✅ Beide Geräte im gleichen WLAN?
- ✅ Firewall blockiert mDNS?
- ➡️ Verwende manuelle IP-Eingabe

### Upload schlägt fehl
- ✅ USB-Treiber installiert? (CH340/CP2102)
- ✅ Richtiger Port? (`arduino-cli board list`)
- ✅ Anderes Programm nutzt den Port?

### LEDs leuchten nicht
- ✅ Verkabelung korrekt?
- ✅ 5V Stromversorgung ausreichend?
- ✅ Richtiger GPIO-Pin? (Standard: D4/GPIO2)

## 📚 Weitere Dokumentation

- **Detaillierte Anleitung:** `ESP8266_INTEGRATION.md`
- **Arduino CLI Setup:** `ARDUINO_CLI_SETUP.md`
- **Multi-Device Setup:** `MULTI_DEVICE_GUIDE.md` ⭐ NEU!
- **Firmware-Code:** `firmware/framolux-esp8266/`

## 💡 Tipps

1. **Mehrere Geräte:** 
   - Jeder ESP8266 bekommt automatisch eine eindeutige Device-ID (z.B. `FLX123456`)
   - Oder vergib eigene IDs beim Flashen: `-DeviceId "WOHNZIMMER"`
   - Benenne Geräte um für bessere Übersicht: "Wohnzimmer", "Schlafzimmer", etc.
   - Siehe `MULTI_DEVICE_GUIDE.md` für Details

2. **Offline-Betrieb:** Frames bleiben auch nach Stromausfall erhalten

3. **Updates:** Einfach neue Frames hochladen - überschreibt die alten

4. **Backup:** Frames können vom Gerät heruntergeladen werden (GET /frames)

## 🎨 Viel Spaß mit deinen LED-Animationen!
