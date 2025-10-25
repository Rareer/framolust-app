# 🌐 Web Serial Flash Guide

## Übersicht

Mit **Web Serial API** kannst du ESP8266-Geräte **direkt aus dem Browser** flashen - ohne Arduino CLI Installation!

## ✨ Vorteile

✅ **Keine Installation nötig** - Alles im Browser
✅ **Benutzerfreundlich** - Einfacher Click-Workflow  
✅ **Vorkompilierte Firmware** - Keine Kompilierung erforderlich
✅ **WiFi Manager** - Credentials werden nach dem Flash eingegeben
✅ **Cross-Platform** - Funktioniert auf Windows, macOS, Linux

## 🔧 Voraussetzungen

### Browser
- **Chrome** 89+ (empfohlen)
- **Edge** 89+
- **Opera** 75+

❌ **Nicht unterstützt:** Firefox, Safari

### Hardware
- ESP8266 Board (NodeMCU, WEMOS D1 Mini, etc.)
- USB-Kabel
- USB-Treiber (CH340 oder CP2102)

## 🚀 Workflow

### Phase 1: Firmware kompilieren (einmalig, für Entwickler)

```powershell
# Windows
cd firmware
.\build-binary.ps1

# Linux/macOS
cd firmware
chmod +x build-binary.sh
./build-binary.sh
```

Dies erstellt:
- `firmware/binaries/framolux-esp8266-wifimanager.ino.bin`
- `public/firmware/framolux-esp8266.bin` (für WebApp)

### Phase 2: Flashen via Browser (für User)

```
┌─────────────────────────────────────────────────────────┐
│ 1. WebApp öffnen                                        │
│ 2. ESP8266-Button klicken (🖥️)                          │
│ 3. "Web Serial (Empfohlen)" Tab wählen                 │
│ 4. ESP8266 per USB verbinden                            │
│ 5. "ESP8266 verbinden" klicken                          │
│ 6. COM-Port auswählen                                   │
│ 7. "Firmware flashen" klicken                           │
│ 8. Warten (~30 Sekunden)                                │
│ 9. ✅ Flash komplett!                                    │
└─────────────────────────────────────────────────────────┘
```

### Phase 3: WiFi konfigurieren

```
┌─────────────────────────────────────────────────────────┐
│ 1. ESP8266 startet als Access Point                     │
│ 2. WiFi-Netzwerk "Framolux-XXXXXX" suchen              │
│ 3. Verbinden (Passwort: framolux123)                   │
│ 4. Browser öffnet automatisch Config-Portal            │
│ 5. "Configure WiFi" klicken                             │
│ 6. Eigenes WLAN auswählen                               │
│ 7. WLAN-Passwort eingeben                               │
│ 8. Optional: Device-Namen eingeben                      │
│ 9. "Save" klicken                                       │
│ 10. ESP8266 verbindet sich mit WLAN                     │
│ 11. ✅ Bereit für Frame-Upload!                          │
└─────────────────────────────────────────────────────────┘
```

## 📋 Detaillierte Anleitung

### Schritt 1: WebApp öffnen

```
http://localhost:3000  (Development)
https://framolux.app   (Production)
```

### Schritt 2: ESP8266 Setup öffnen

- Klicke auf **🖥️ ESP8266** Button (oben rechts)
- Wähle Tab **"🌐 Web Serial (Empfohlen)"**

### Schritt 3: ESP8266 verbinden

1. **ESP8266 per USB anschließen**
2. **"ESP8266 verbinden" klicken**
3. **COM-Port auswählen** im Browser-Dialog
   - Windows: `COM3`, `COM4`, etc.
   - macOS: `/dev/cu.usbserial-*`
   - Linux: `/dev/ttyUSB0`, `/dev/ttyUSB1`
4. **"Verbinden" klicken**

### Schritt 4: Firmware flashen

1. **"Firmware flashen" klicken**
2. **Bestätigen** im Dialog
3. **Warten** (~30 Sekunden)
   - Progress Bar zeigt Fortschritt
   - Log zeigt Details
4. **Flash komplett!** ✅

### Schritt 5: WiFi konfigurieren

#### 5.1 Access Point finden

```
SSID: Framolux-XXXXXX
Passwort: framolux123
```

Die `XXXXXX` sind die letzten 6 Zeichen der MAC-Adresse.

#### 5.2 Verbinden

- **Windows:** WiFi-Einstellungen → Framolux-XXXXXX → Verbinden
- **macOS:** WiFi-Icon → Framolux-XXXXXX
- **Android:** Einstellungen → WLAN → Framolux-XXXXXX
- **iOS:** Einstellungen → WLAN → Framolux-XXXXXX

#### 5.3 Config-Portal

Browser öffnet automatisch: `http://192.168.4.1`

Falls nicht:
```
http://192.168.4.1
```

#### 5.4 WiFi konfigurieren

1. **"Configure WiFi"** klicken
2. **Eigenes WLAN** aus Liste wählen
3. **Passwort** eingeben
4. **Device Name** eingeben (optional)
   - Beispiel: "Wohnzimmer", "Schlafzimmer"
5. **"Save"** klicken

#### 5.5 Verbindung prüfen

ESP8266 verbindet sich mit deinem WLAN und zeigt IP-Adresse im Serial Monitor.

**Serial Monitor öffnen** (optional):
```bash
arduino-cli monitor -p COM3 -c baudrate=115200
```

Oder in der WebApp: Browser Console zeigt Logs.

### Schritt 6: Gerät in WebApp finden

1. **Zurück zur WebApp**
2. **"Nach Geräten suchen"** klicken
3. **Gerät auswählen**
4. **Optional: Umbenennen** (✏️)
5. **Frames hochladen** 🎨

## 🔄 Vergleich: Web Serial vs Arduino CLI

| Feature | Web Serial | Arduino CLI |
|---------|------------|-------------|
| **Installation** | ❌ Keine | ✅ Arduino CLI nötig |
| **Browser** | ✅ Direkt im Browser | ❌ Terminal |
| **Benutzerfreundlich** | ✅✅✅ Sehr einfach | ⚠️ Technisch |
| **WiFi-Config** | ✅ Nach Flash (WiFi Manager) | ⚠️ Beim Kompilieren |
| **Credentials** | ✅ Nicht im Code | ❌ Im Code eingebettet |
| **Multi-Device** | ✅ Einfach | ⚠️ Mehrfach kompilieren |
| **Speed** | ⚠️ ~30 Sek | ✅ ~20 Sek |
| **Flexibilität** | ⚠️ Vorkompiliert | ✅ Vollständig anpassbar |

## 🎯 Empfehlung

### Für normale User: **Web Serial** 🌐
- Einfacher
- Keine Installation
- WiFi-Config nach Flash

### Für Entwickler: **Arduino CLI** 💻
- Mehr Kontrolle
- Eigene Anpassungen
- Schnelleres Iterieren

## 🔧 Technische Details

### Firmware-Struktur

```
firmware/
├── framolux-esp8266-wifimanager/
│   └── framolux-esp8266-wifimanager.ino  # Neue Firmware mit WiFi Manager
├── framolux-esp8266/
│   └── framolux-esp8266.ino              # Alte Firmware (mit Credentials)
├── build-binary.ps1                       # Binary Builder (Windows)
├── build-binary.sh                        # Binary Builder (Linux/macOS)
└── binaries/
    └── framolux-esp8266-wifimanager.ino.bin  # Vorkompilierte Firmware
```

### WiFi Manager Library

Die Firmware verwendet [WiFiManager](https://github.com/tzapu/WiFiManager):

```cpp
#include <WiFiManager.h>

WiFiManager wifiManager;
wifiManager.autoConnect("Framolux-XXXXXX", "framolux123");
```

**Features:**
- Automatischer Access Point bei fehlender Config
- Web-basiertes Config-Portal
- Persistente Speicherung in EEPROM
- Custom Parameter (Device-Name)

### Device-ID Generierung

```cpp
// Aus MAC-Adresse
deviceId = "FLX" + macAddress.substring(macAddress.length() - 6);

// Beispiel
MAC: AA:BB:CC:DD:EE:FF
Device-ID: FLXDDEEFF
```

### Web Serial API

```typescript
// Port öffnen
const port = await navigator.serial.requestPort()
await port.open({ baudRate: 115200 })

// Firmware flashen
const esploader = new ESPLoader({ transport, baudrate: 115200 })
await esploader.writeFlash({ fileArray: [...] })
```

## 🆘 Troubleshooting

### Browser unterstützt Web Serial nicht

**Problem:** "Web Serial API not supported"

**Lösung:**
- Chrome 89+ verwenden
- HTTPS verwenden (oder localhost)
- Browser-Flags prüfen: `chrome://flags/#enable-experimental-web-platform-features`

### COM-Port nicht gefunden

**Problem:** Keine Ports im Dialog

**Lösung:**
- USB-Treiber installieren (CH340/CP2102)
- ESP8266 neu anschließen
- Anderen USB-Port versuchen
- Device Manager prüfen (Windows)

### Flash schlägt fehl

**Problem:** "Flash failed" Fehler

**Lösung:**
- ESP8266 in Flash-Modus versetzen (GPIO0 auf GND)
- USB-Kabel wechseln (Daten-Kabel, nicht nur Laden)
- Baudrate reduzieren (in Code: 115200 → 57600)
- Anderen Browser versuchen

### WiFi Config-Portal öffnet nicht

**Problem:** Browser öffnet nicht automatisch

**Lösung:**
- Manuell öffnen: `http://192.168.4.1`
- Captive Portal deaktiviert? → Manuell verbinden
- Firewall blockiert? → Temporär deaktivieren

### ESP8266 verbindet sich nicht mit WLAN

**Problem:** Bleibt im AP-Modus

**Lösung:**
- SSID/Passwort korrekt?
- 2.4 GHz WLAN? (ESP8266 unterstützt kein 5 GHz)
- WLAN-Reichweite ausreichend?
- Router erlaubt neue Geräte?
- WiFi-Settings zurücksetzen: `POST /reset-wifi`

## 📝 Best Practices

### 1. Binary regelmäßig neu kompilieren

Bei Firmware-Updates:
```powershell
cd firmware
.\build-binary.ps1
```

### 2. Device-Namen vergeben

Im WiFi Config-Portal aussagekräftige Namen verwenden:
- ✅ "Wohnzimmer", "Schlafzimmer", "Küche"
- ❌ "Device1", "ESP1", "Test"

### 3. WiFi-Credentials sicher

- Nicht im Code speichern ✅
- Über WiFi Manager eingeben ✅
- Bei Weitergabe: WiFi resetten ✅

### 4. Mehrere Geräte

Jedes Gerät bekommt automatisch eindeutige Device-ID:
```
Gerät 1: FLXAABBCC
Gerät 2: FLXDDEEFF
Gerät 3: FLX112233
```

## 🎉 Vorteile des neuen Systems

✅ **User-Friendly** - Kein technisches Wissen nötig
✅ **Sicher** - Credentials nicht im Code
✅ **Flexibel** - WiFi jederzeit änderbar
✅ **Skalierbar** - Beliebig viele Geräte
✅ **Modern** - Direkt im Browser
✅ **Wartbar** - Eine Binary für alle

## 🔮 Zukünftige Features

- [ ] OTA Updates (Over-The-Air)
- [ ] Backup/Restore von Konfigurationen
- [ ] Batch-Flash (mehrere Geräte gleichzeitig)
- [ ] Custom Firmware-Builder im Browser
- [ ] Firmware-Versionierung
