#!/bin/bash
# Build vorkompilierte Firmware Binary
# Diese wird einmalig erstellt und kann dann via Web Serial geflasht werden

set -e

# Farben
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Parameter
BOARD="esp8266:esp8266:nodemcuv2"
OUTPUT_DIR="binaries"

echo -e "${CYAN}==========================================${NC}"
echo -e "${CYAN}Framolux ESP8266 Binary Builder${NC}"
echo -e "${CYAN}==========================================${NC}"
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
SKETCH_PATH="$SCRIPT_DIR/framolux-esp8266-wifimanager"

if [ ! -d "$SKETCH_PATH" ]; then
    echo -e "${RED}✗ Sketch not found: $SKETCH_PATH${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Sketch found: $SKETCH_PATH${NC}"
echo ""

# Output Directory erstellen
OUTPUT_PATH="$SCRIPT_DIR/$OUTPUT_DIR"
mkdir -p "$OUTPUT_PATH"

echo -e "${CYAN}Configuration:${NC}"
echo "  Board: $BOARD"
echo "  Output: $OUTPUT_PATH"
echo ""

# Kompilieren
echo -e "${YELLOW}Compiling firmware...${NC}"
echo ""

arduino-cli compile \
    --fqbn "$BOARD" \
    --output-dir "$OUTPUT_PATH" \
    "$SKETCH_PATH"

echo ""
echo -e "${GREEN}✓ Compilation successful!${NC}"

# Finde .bin Datei
BIN_FILE=$(find "$OUTPUT_PATH" -name "*.bin" -type f | head -n 1)

if [ -n "$BIN_FILE" ]; then
    echo ""
    echo -e "${CYAN}==========================================${NC}"
    echo -e "${GREEN}Binary created!${NC}"
    echo -e "${CYAN}==========================================${NC}"
    echo ""
    echo -e "${NC}File: $BIN_FILE${NC}"
    
    FILE_SIZE=$(du -h "$BIN_FILE" | cut -f1)
    echo -e "${NC}Size: $FILE_SIZE${NC}"
    echo ""
    echo -e "${YELLOW}Copying to public/firmware/...${NC}"
    
    # Kopiere in public Ordner für WebApp
    PUBLIC_FIRMWARE_DIR="$SCRIPT_DIR/../public/firmware"
    mkdir -p "$PUBLIC_FIRMWARE_DIR"
    
    TARGET_FILE="$PUBLIC_FIRMWARE_DIR/framolux-esp8266.bin"
    cp "$BIN_FILE" "$TARGET_FILE"
    
    echo -e "${GREEN}✓ Binary copied to: $TARGET_FILE${NC}"
    echo ""
    echo -e "${CYAN}The firmware can now be flashed via Web Serial!${NC}"
else
    echo -e "${RED}✗ No .bin file found!${NC}"
    exit 1
fi

echo ""
echo -e "${CYAN}==========================================${NC}"
echo -e "${CYAN}Build completed!${NC}"
echo -e "${CYAN}==========================================${NC}"
