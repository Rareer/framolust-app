#!/bin/bash
# Framolux ESP8266 Build Script (Linux/macOS)
# Kompiliert die Firmware mit benutzerdefinierten WiFi-Credentials

set -e

# Farben
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Parameter
SSID=""
PASSWORD=""
DEVICE_ID=""
BOARD="esp8266:esp8266:nodemcuv2"
PORT=""
UPLOAD=false

# Hilfe
show_help() {
    echo "Usage: ./build.sh --ssid <SSID> --password <PASSWORD> [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --ssid <SSID>          WiFi SSID (required)"
    echo "  --password <PASSWORD>  WiFi Password (required)"
    echo "  --device-id <ID>       Device ID (auto-generated if not specified)"
    echo "  --board <BOARD>        Board FQBN (default: esp8266:esp8266:nodemcuv2)"
    echo "  --port <PORT>          Serial port (auto-detect if not specified)"
    echo "  --upload               Upload firmware after compilation"
    echo "  --help                 Show this help"
    echo ""
    echo "Example:"
    echo "  ./build.sh --ssid MyWiFi --password MyPassword --upload"
}

# Parse Argumente
while [[ $# -gt 0 ]]; do
    case $1 in
        --ssid)
            SSID="$2"
            shift 2
            ;;
        --password)
            PASSWORD="$2"
            shift 2
            ;;
        --device-id)
            DEVICE_ID="$2"
            shift 2
            ;;
        --board)
            BOARD="$2"
            shift 2
            ;;
        --port)
            PORT="$2"
            shift 2
            ;;
        --upload)
            UPLOAD=true
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

# Validierung
if [ -z "$SSID" ] || [ -z "$PASSWORD" ]; then
    echo -e "${RED}Error: SSID and Password are required${NC}"
    show_help
    exit 1
fi

echo -e "${CYAN}==================================${NC}"
echo -e "${CYAN}Framolux ESP8266 Build Script${NC}"
echo -e "${CYAN}==================================${NC}"
echo ""

# Prüfe Arduino CLI
if ! command -v arduino-cli &> /dev/null; then
    echo -e "${RED}✗ Arduino CLI not found!${NC}"
    echo -e "${YELLOW}Please install Arduino CLI: https://arduino.github.io/arduino-cli/${NC}"
    exit 1
fi

VERSION=$(arduino-cli version)
echo -e "${GREEN}✓ Arduino CLI found: $VERSION${NC}"

# Sketch Pfad
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKETCH_PATH="$SCRIPT_DIR/framolux-esp8266"

if [ ! -d "$SKETCH_PATH" ]; then
    echo -e "${RED}✗ Sketch not found: $SKETCH_PATH${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Sketch found: $SKETCH_PATH${NC}"
echo ""

# Generiere Device ID falls nicht angegeben
if [ -z "$DEVICE_ID" ]; then
    DEVICE_ID="FLX$(shuf -i 100000-999999 -n 1)"
    echo -e "${GREEN}✓ Device ID generated: $DEVICE_ID${NC}"
else
    echo -e "${GREEN}✓ Device ID: $DEVICE_ID${NC}"
fi

# Konfiguration
echo ""
echo -e "${CYAN}Configuration:${NC}"
echo "  SSID: $SSID"
echo "  Device ID: $DEVICE_ID"
echo "  Board: $BOARD"
echo ""

# Build Properties
BUILD_PROPS="build.extra_flags=-DWIFI_SSID=\\\"$SSID\\\" -DWIFI_PASSWORD=\\\"$PASSWORD\\\" -DDEVICE_ID=\\\"$DEVICE_ID\\\""

# Kompilieren
echo -e "${YELLOW}Compiling firmware...${NC}"
echo ""

arduino-cli compile \
    --fqbn "$BOARD" \
    --build-property "$BUILD_PROPS" \
    "$SKETCH_PATH"

echo ""
echo -e "${GREEN}✓ Compilation successful!${NC}"

# Upload
if [ "$UPLOAD" = true ]; then
    echo ""
    
    # Port automatisch erkennen
    if [ -z "$PORT" ]; then
        echo -e "${YELLOW}Searching for ESP8266...${NC}"
        
        # Versuche Port zu finden
        BOARDS=$(arduino-cli board list --format json)
        PORT=$(echo "$BOARDS" | jq -r '.[] | select(.matching_boards[]?.fqbn | contains("esp8266")) | .address' | head -n 1)
        
        if [ -z "$PORT" ]; then
            echo -e "${RED}✗ No ESP8266 found!${NC}"
            echo -e "${YELLOW}Please specify port manually with --port /dev/ttyUSB0${NC}"
            exit 1
        fi
        
        echo -e "${GREEN}✓ ESP8266 found on port: $PORT${NC}"
    fi
    
    echo ""
    echo -e "${YELLOW}Uploading firmware to $PORT...${NC}"
    echo ""
    
    arduino-cli upload \
        -p "$PORT" \
        --fqbn "$BOARD" \
        "$SKETCH_PATH"
    
    echo ""
    echo -e "${GREEN}✓ Upload successful!${NC}"
    echo ""
    echo -e "${CYAN}The device should now connect to WiFi.${NC}"
    echo -e "${CYAN}Open the serial monitor to see the IP address:${NC}"
    echo -e "${NC}  arduino-cli monitor -p $PORT -c baudrate=115200${NC}"
fi

echo ""
echo -e "${CYAN}==================================${NC}"
echo -e "${CYAN}Build completed!${NC}"
echo -e "${CYAN}==================================${NC}"
