# Arduino CLI Setup für Framolux ESP8266

## Installation

### Windows

```powershell
# Download Arduino CLI
Invoke-WebRequest -Uri "https://downloads.arduino.cc/arduino-cli/arduino-cli_latest_Windows_64bit.zip" -OutFile "arduino-cli.zip"

# Extrahieren
Expand-Archive -Path "arduino-cli.zip" -DestinationPath "$env:LOCALAPPDATA\Arduino15\bin"

# Zum PATH hinzufügen (PowerShell)
$env:Path += ";$env:LOCALAPPDATA\Arduino15\bin"

# Permanent zum PATH hinzufügen
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";$env:LOCALAPPDATA\Arduino15\bin", [EnvironmentVariableTarget]::User)
```

### macOS / Linux

```bash
# Download und Installation
curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sh

# Zum PATH hinzufügen (in ~/.bashrc oder ~/.zshrc)
export PATH=$PATH:$HOME/bin
```

## ESP8266 Board Setup

```bash
# Arduino CLI initialisieren
arduino-cli config init

# ESP8266 Board Manager URL hinzufügen
arduino-cli config add board_manager.additional_urls http://arduino.esp8266.com/stable/package_esp8266com_index.json

# Core Index aktualisieren
arduino-cli core update-index

# ESP8266 Core installieren
arduino-cli core install esp8266:esp8266

# Benötigte Libraries installieren
arduino-cli lib install "ESP8266WebServer"
arduino-cli lib install "ArduinoJson"
arduino-cli lib install "LittleFS"
```

## Verfügbare Boards anzeigen

```bash
arduino-cli board listall esp8266
```

Typische ESP8266 Boards:
- `esp8266:esp8266:generic` - Generic ESP8266
- `esp8266:esp8266:nodemcuv2` - NodeMCU 1.0 (ESP-12E)
- `esp8266:esp8266:d1_mini` - WEMOS D1 Mini

## Compilation & Upload

```bash
# Sketch kompilieren
arduino-cli compile --fqbn esp8266:esp8266:nodemcuv2 ./firmware/framolux-esp8266

# Port finden
arduino-cli board list

# Upload (ersetze COM3 mit deinem Port)
arduino-cli upload -p COM3 --fqbn esp8266:esp8266:nodemcuv2 ./firmware/framolux-esp8266
```

## Web Serial API Alternative

Für direktes Flashen aus dem Browser (ohne Arduino CLI Installation):
- Verwende [ESP Web Tools](https://esphome.github.io/esp-web-tools/)
- Benötigt vorkompilierte `.bin` Dateien
- User kann direkt im Browser flashen

## Troubleshooting

### Port nicht gefunden
```bash
# Windows: Überprüfe COM Ports
mode

# Linux/Mac: Überprüfe USB Geräte
ls /dev/tty*
```

### Upload schlägt fehl
- ESP8266 in Flash-Modus versetzen (GPIO0 auf GND beim Booten)
- USB-Treiber installieren (CH340 oder CP2102)
- Andere Programme schließen, die den Port verwenden

### Speicherprobleme
- Partition Scheme anpassen: `--build-property build.flash_size=4M3M` (4MB Flash, 3MB SPIFFS)
