# ESP8266 Setup für LED Matrix

## Übersicht

Diese Anwendung kann über die Web Serial API mit einem ESP8266 kommunizieren, um eine 16x16 LED-Matrix anzusteuern.

## Hardware-Anforderungen

- ESP8266 (z.B. NodeMCU, Wemos D1 Mini)
- 16x16 LED-Matrix (WS2812B/NeoPixel kompatibel)
- USB-Kabel zur Verbindung mit dem Computer

## Unterstützte USB-to-Serial Chips

Die Anwendung erkennt automatisch folgende Chips:
- **Silicon Labs CP210x** (VID: 0x10c4, PID: 0xea60)
- **CH340** (VID: 0x1a86, PID: 0x7523)
- **FTDI FT232** (VID: 0x0403, PID: 0x6001)

## Datenformat

Die Anwendung sendet die LED-Matrix-Daten als JSON über die serielle Schnittstelle:

```json
{
  "type": "matrix",
  "width": 16,
  "height": 16,
  "pixels": [
    [255, 0, 0],    // RGB-Werte für Pixel 0
    [0, 255, 0],    // RGB-Werte für Pixel 1
    ...             // 256 Pixel insgesamt
  ]
}
```

## ESP8266 Arduino Sketch (Beispiel)

```cpp
#include <ArduinoJson.h>
#include <Adafruit_NeoPixel.h>

#define LED_PIN    D4
#define LED_COUNT  256  // 16x16

Adafruit_NeoPixel strip(LED_COUNT, LED_PIN, NEO_GRB + NEO_KHZ800);

void setup() {
  Serial.begin(115200);
  strip.begin();
  strip.show(); // Initialize all pixels to 'off'
}

void loop() {
  if (Serial.available()) {
    String json = Serial.readStringUntil('\n');
    
    StaticJsonDocument<8192> doc;
    DeserializationError error = deserializeJson(doc, json);
    
    if (!error && doc["type"] == "matrix") {
      JsonArray pixels = doc["pixels"];
      
      for (int i = 0; i < LED_COUNT && i < pixels.size(); i++) {
        JsonArray rgb = pixels[i];
        strip.setPixelColor(i, strip.Color(rgb[0], rgb[1], rgb[2]));
      }
      
      strip.show();
    }
  }
}
```

## Benötigte Arduino-Bibliotheken

1. **ArduinoJson** (v6.x)
   - Installation: Arduino IDE → Sketch → Include Library → Manage Libraries → "ArduinoJson"

2. **Adafruit NeoPixel**
   - Installation: Arduino IDE → Sketch → Include Library → Manage Libraries → "Adafruit NeoPixel"

## Verbindung herstellen

1. ESP8266 über USB mit dem Computer verbinden
2. In der Webanwendung auf "ESP8266 verbinden" klicken
3. Im Browser-Dialog das richtige COM-Port/Device auswählen
4. Die Verbindung wird mit 115200 Baud hergestellt

## Browser-Kompatibilität

Die Web Serial API wird unterstützt von:
- ✅ Google Chrome (ab Version 89)
- ✅ Microsoft Edge (ab Version 89)
- ✅ Opera (ab Version 75)
- ❌ Firefox (noch nicht unterstützt)
- ❌ Safari (noch nicht unterstützt)

## Fehlerbehebung

### "Port ist bereits in Verwendung"
**Häufigster Fehler!** Der Serial Port kann nur von einem Programm gleichzeitig verwendet werden.

**Lösung:**
1. Schließe die Arduino IDE (besonders den Serial Monitor!)
2. Schließe andere Serial-Programme (PuTTY, Tera Term, etc.)
3. Trenne das USB-Kabel kurz und verbinde es neu
4. Starte den Browser neu
5. Versuche die Verbindung erneut

### "Browser nicht unterstützt"
→ Verwende Chrome, Edge oder Opera

### "Kein Gerät ausgewählt"
→ Stelle sicher, dass der ESP8266 angeschlossen ist und wähle das richtige Port aus

### "Verbindungsfehler"
→ Überprüfe, ob der richtige Treiber für deinen USB-to-Serial Chip installiert ist

**Treiber-Links:**
- CH340: [Download](http://www.wch.cn/downloads/CH341SER_ZIP.html)
- CP210x: [Download](https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers)
- FTDI: Meist bereits in Windows/macOS integriert

### Keine LEDs leuchten
→ Überprüfe die Verkabelung und stelle sicher, dass der LED_PIN im Arduino-Code korrekt ist

## Matrix-Layout

Die meisten NeoPixel-Matrizen sind in einem **Serpentinen-Muster (Zigzag)** verdrahtet:

```
Row 15 (Top):     →→→→→→→→→→→→→→→→  (LEDs 240-255, left to right)
Row 14:           ←←←←←←←←←←←←←←←←  (LEDs 224-239, right to left)
Row 13:           →→→→→→→→→→→→→→→→  (LEDs 208-223, left to right)
...
Row 1:            →→→→→→→→→→→→→→→→  (LEDs 16-31, left to right)
Row 0 (Bottom):   →→→→→→→→→→→→→→→→  (LEDs 0-15, left to right)
                  ↑ Start (bottom-left)
```

Der generierte Code berücksichtigt automatisch dieses Layout!

## Pinbelegung (Beispiel für NodeMCU)

```
ESP8266 Pin → LED Matrix
D2 (GPIO4) → DIN (Data In)
3.3V       → VCC (bei wenigen LEDs)
GND        → GND

Hinweis: Bei größeren Matrizen externe 5V Stromversorgung verwenden!
```

## Sicherheitshinweise

⚠️ **Wichtig:**
- Verwende eine externe Stromversorgung für die LED-Matrix
- Der ESP8266 kann nicht genug Strom für 256 LEDs liefern
- Berechne den Strombedarf: 256 LEDs × 60mA = 15.36A (bei voller Helligkeit)
- Verwende ein geeignetes Netzteil (5V, mindestens 3-5A für gedimmten Betrieb)

## Weitere Ressourcen

- [Web Serial API Dokumentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API)
- [Adafruit NeoPixel Guide](https://learn.adafruit.com/adafruit-neopixel-uberguide)
- [ESP8266 Arduino Core](https://github.com/esp8266/Arduino)
