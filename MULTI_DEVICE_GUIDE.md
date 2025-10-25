# 🔢 Multi-Device Setup Guide

## Übersicht

Dieses System unterstützt **mehrere ESP8266-Geräte** im gleichen WLAN-Netzwerk. Jedes Gerät erhält eine eindeutige Device-ID und kann individuell benannt werden.

## 🎯 Device-ID System

### Automatische Generierung
Beim Kompilieren wird automatisch eine zufällige Device-ID generiert:
- Format: `FLX` + 6-stellige Zufallszahl
- Beispiel: `FLX123456`, `FLX789012`

### Manuelle Device-ID
Du kannst auch eine eigene Device-ID vergeben:

**Windows:**
```powershell
.\firmware\build.ps1 -SSID "MeinWLAN" -Password "MeinPass" -DeviceId "WOHNZIMMER" -Upload
```

**Linux/macOS:**
```bash
./firmware/build.sh --ssid "MeinWLAN" --password "MeinPass" --device-id "WOHNZIMMER" --upload
```

## 📱 Mehrere Geräte verwalten

### Szenario: 3 LED-Strips in verschiedenen Räumen

```
┌─────────────────────────────────────────────────────────┐
│  Gerät 1: FLX123456 → "Wohnzimmer"                      │
│  Gerät 2: FLX789012 → "Schlafzimmer"                    │
│  Gerät 3: FLX456789 → "Küche"                           │
└─────────────────────────────────────────────────────────┘
```

### Setup-Prozess

#### 1. Erstes Gerät flashen
```powershell
# Device-ID wird automatisch generiert
.\firmware\build.ps1 -SSID "MeinWLAN" -Password "MeinPass" -Upload
# Output: Device ID: FLX123456
```

#### 2. Zweites Gerät flashen
```powershell
# Neue Device-ID wird generiert
.\firmware\build.ps1 -SSID "MeinWLAN" -Password "MeinPass" -Upload
# Output: Device ID: FLX789012
```

#### 3. Drittes Gerät flashen
```powershell
# Wieder neue Device-ID
.\firmware\build.ps1 -SSID "MeinWLAN" -Password "MeinPass" -Upload
# Output: Device ID: FLX456789
```

### In der WebApp

1. **Klicke auf ESP8266-Button** (🖥️)
2. **"Nach Geräten suchen"** - alle 3 Geräte werden gefunden
3. **Geräte umbenennen:**
   - FLX123456 → "Wohnzimmer" ✏️
   - FLX789012 → "Schlafzimmer" ✏️
   - FLX456789 → "Küche" ✏️

## 🔄 Device-Umbenennung

### Via WebApp
1. Gerät in der Liste finden
2. Auf **"✏️ Umbenennen"** klicken
3. Neuen Namen eingeben
4. Name wird persistent auf dem ESP8266 gespeichert

### Via API
```bash
curl -X PUT http://192.168.1.100/config \
  -H "Content-Type: application/json" \
  -d '{"deviceName":"Wohnzimmer"}'
```

**Response:**
```json
{
  "success": true,
  "deviceName": "Wohnzimmer",
  "message": "Device name updated"
}
```

## 🌐 mDNS Hostnames

Jedes Gerät registriert sich mit seiner Device-ID als Hostname:

```
framolux-flx123456.local → 192.168.1.100
framolux-flx789012.local → 192.168.1.101
framolux-flx456789.local → 192.168.1.102
```

**Browser-Zugriff:**
```
http://framolux-flx123456.local/
http://framolux-flx789012.local/
http://framolux-flx456789.local/
```

## 📊 Device-Identifikation

Jedes Gerät hat **3 Identifikatoren**:

1. **Device-ID** (eindeutig, fest)
   - Wird beim Kompilieren gesetzt
   - Beispiel: `FLX123456`
   - Kann nicht geändert werden

2. **Device-Name** (änderbar)
   - Standard: `framolux`
   - Vom User änderbar
   - Beispiel: `Wohnzimmer`

3. **MAC-Adresse** (Hardware)
   - Eindeutig pro ESP8266
   - Beispiel: `AA:BB:CC:DD:EE:FF`

## 🎨 Workflow: Verschiedene Animationen auf verschiedenen Geräten

### Beispiel-Szenario

```
Wohnzimmer (FLX123456):
  → Animation: "Regenbogen-Welle"
  → 60 Frames, 100ms pro Frame

Schlafzimmer (FLX789012):
  → Animation: "Sanftes Pulsieren"
  → 30 Frames, 200ms pro Frame

Küche (FLX456789):
  → Animation: "Weißes Licht"
  → 1 Frame, statisch
```

### In der WebApp

1. **Animation für Wohnzimmer generieren**
   ```
   Prompt: "Rainbow wave animation"
   → Generieren → Gerät "Wohnzimmer" auswählen → Upload
   ```

2. **Animation für Schlafzimmer generieren**
   ```
   Prompt: "Soft pulsing blue light"
   → Generieren → Gerät "Schlafzimmer" auswählen → Upload
   ```

3. **Animation für Küche generieren**
   ```
   Prompt: "Static warm white light"
   → Generieren → Gerät "Küche" auswählen → Upload
   ```

## 🔍 Geräte finden

### Automatisch (mDNS)
Die WebApp scannt automatisch nach allen Framolux-Geräten im Netzwerk.

### Manuell (IP-Adresse)
Falls mDNS nicht funktioniert:
1. Serial Monitor öffnen für jedes Gerät
2. IP-Adressen notieren
3. In WebApp manuell eingeben

### Bekannte Geräte
Die WebApp speichert bekannte Geräte lokal:
- Device-ID
- Letzter Name
- Letzte IP-Adresse

## 💾 Persistente Speicherung

### Auf dem ESP8266

**Config-Datei** (`/config.json`):
```json
{
  "deviceId": "FLX123456",
  "deviceName": "Wohnzimmer"
}
```

**Frames-Datei** (`/frames.json`):
```json
{
  "frames": [...],
  "totalFrames": 60,
  "timestamp": 1234567890
}
```

### Im Browser (LocalStorage)

**WiFi-Konfiguration:**
```json
{
  "ssid": "MeinWLAN",
  "password": "MeinPass"
}
```

**Bekannte Geräte:**
```json
[
  {
    "deviceId": "FLX123456",
    "deviceName": "Wohnzimmer",
    "ip": "192.168.1.100"
  },
  {
    "deviceId": "FLX789012",
    "deviceName": "Schlafzimmer",
    "ip": "192.168.1.101"
  }
]
```

## 🚨 Troubleshooting

### Gerät hat falsche Device-ID
**Problem:** Zwei Geräte haben die gleiche ID

**Lösung:** Neu flashen mit manueller Device-ID:
```powershell
.\firmware\build.ps1 -SSID "WLAN" -Password "Pass" -DeviceId "UNIQUE_ID" -Upload
```

### Gerät wird nicht gefunden
**Problem:** Gerät erscheint nicht in der Liste

**Lösungen:**
1. ✅ Beide im gleichen WLAN?
2. ✅ Firewall blockiert mDNS?
3. ✅ Manuelle IP-Eingabe verwenden
4. ✅ Serial Monitor checken für IP-Adresse

### Name-Änderung funktioniert nicht
**Problem:** Umbenennung schlägt fehl

**Lösungen:**
1. ✅ Gerät online?
2. ✅ Name 1-32 Zeichen lang?
3. ✅ Keine Sonderzeichen verwenden

### Frames auf falschem Gerät
**Problem:** Animation auf falsches Gerät hochgeladen

**Lösung:** 
1. Richtiges Gerät auswählen
2. Neue Animation hochladen (überschreibt alte)
3. Oder: Frames löschen und neu hochladen

## 📝 Best Practices

### 1. Aussagekräftige Namen verwenden
❌ Schlecht: `Device1`, `ESP1`, `Test`
✅ Gut: `Wohnzimmer`, `Schlafzimmer`, `Küche`

### 2. Device-IDs dokumentieren
Erstelle eine Liste mit allen Geräten:
```
FLX123456 = Wohnzimmer (192.168.1.100)
FLX789012 = Schlafzimmer (192.168.1.101)
FLX456789 = Küche (192.168.1.102)
```

### 3. Backup der Konfiguration
Exportiere bekannte Geräte aus LocalStorage:
```javascript
localStorage.getItem('framolux_known_devices')
```

### 4. Konsistente Namensgebung
Verwende ein Schema:
- Nach Raum: `Wohnzimmer`, `Schlafzimmer`
- Nach Funktion: `Ambient`, `Accent`, `Task`
- Nach Position: `Links`, `Rechts`, `Mitte`

## 🎉 Vorteile des Multi-Device-Systems

✅ **Unabhängige Animationen** - Jedes Gerät kann eigene Animation haben
✅ **Zentrale Verwaltung** - Alle Geräte in einer WebApp
✅ **Persistente Namen** - Namen bleiben nach Neustart erhalten
✅ **Automatische Discovery** - Geräte werden automatisch gefunden
✅ **Skalierbar** - Beliebig viele Geräte möglich
✅ **Offline-fähig** - Geräte laufen auch ohne WebApp

## 🔮 Zukünftige Features

- [ ] Gruppen-Management (mehrere Geräte gleichzeitig steuern)
- [ ] Synchronisierte Animationen (alle Geräte im Takt)
- [ ] Zeitgesteuerte Animationen (Scheduler)
- [ ] Animation-Bibliothek (Favoriten speichern)
- [ ] Cloud-Backup für Konfigurationen
