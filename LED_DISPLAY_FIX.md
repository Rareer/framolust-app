# LED Display Problem - Nur ein Pixel wird angezeigt

## Problem

Beim Senden eines Test-Frames an den ESP8266 wurde nur **ein gelbes Pixel oben links** angezeigt, obwohl der Payload korrekt war (16x16 Pixel-Array mit grünem Kreuz).

## Ursache

### 1. **JSON-Buffer zu klein**
```cpp
StaticJsonDocument<4096> doc;  // Zu klein!
```

Ein 16x16 Pixel-Array mit Hex-Farben benötigt:
- 16 Zeilen × 16 Spalten = 256 Pixel
- Jedes Pixel: `"#RRGGBB"` = ~9 Bytes (mit Quotes und Kommas)
- **Gesamt: ~2.3 KB nur für Pixel-Daten**
- Plus JSON-Struktur (frames, duration, etc.)
- **Minimum: ~8-10 KB pro Frame**

Mit einem 4 KB Buffer wurde das JSON **abgeschnitten**, wodurch nur die ersten paar Pixel geladen wurden.

### 2. **Ineffizientes Frame-Loading**
Die `updateFrameDisplay()` Funktion lud die Frames **alle 10ms** aus dem LittleFS neu (in der `loop()`), was:
- Unnötig viel I/O verursacht
- Performance-Probleme verursacht
- Zu Parse-Fehlern führen kann

## Lösung

### 1. JSON-Buffer auf 32 KB erhöht

```cpp
// WICHTIG: Größerer Buffer für 16x16 Pixel-Arrays!
// 16x16 Pixel * 9 Bytes pro Farbe (#RRGGBB) = ~2.3KB pro Frame
DynamicJsonDocument doc(32768); // 32KB Buffer
```

### 2. Frame-Loading optimiert

```cpp
// Lade Frame nur wenn nötig (bei Frame-Wechsel)
static unsigned long lastFrameLoad = 0;
unsigned long now = millis();

if (now - lastFrameLoad > 100) { // Maximal alle 100ms neu laden
  lastFrameLoad = now;
  // ... Frame laden und anzeigen
}
```

### 3. Debug-Output hinzugefügt

Um zukünftige Probleme zu diagnostizieren:

```cpp
Serial.print("Displaying frame ");
Serial.print(currentFrameIndex);
Serial.print(" - Pixels array size: ");
Serial.println(pixels.size());

Serial.print("displayPixelArray: Height=");
Serial.println(arrayHeight);

Serial.print("Total pixels set: ");
Serial.println(pixelsSet);
```

## Betroffene Dateien

- `firmware/framolux-esp8266-wifimanager/framolux-esp8266-wifimanager.ino`
  - `updateFrameDisplay()` - JSON-Buffer erhöht, Loading optimiert
  - `displayPixelArray()` - Debug-Output hinzugefügt

## Test nach dem Flash

1. **Flashe die neue Firmware** auf den ESP8266
2. **Sende einen Test-Frame** über die Web-App
3. **Öffne Serial Monitor** (115200 baud) und prüfe die Debug-Ausgabe:

```
Displaying frame 0 - Pixels array size: 16
displayPixelArray: Height=16
First row width: 16
Pixel[0][0]: #000000 -> RGB(0,0,0)
Pixel[0][1]: #000000 -> RGB(0,0,0)
Pixel[0][2]: #000000 -> RGB(0,0,0)
Total pixels set: 256
```

4. **Erwartetes Ergebnis**: Grünes Kreuz (horizontal und vertikal in der Mitte) auf schwarzem Hintergrund

## Weitere Optimierungen (Optional)

Für noch bessere Performance könnten die Frames beim Upload **einmal** in den RAM geladen und dort gecacht werden, anstatt sie jedes Mal aus dem Dateisystem zu lesen. Dies würde aber mehr RAM verbrauchen.

## Memory-Verbrauch

Nach den Änderungen:
- **RAM**: 36204 / 80192 bytes (45%) - noch genug Platz
- **Flash**: 397760 / 1048576 bytes (37%) - noch genug Platz
- **IRAM**: 60967 / 65536 bytes (93%) - **fast voll!**

⚠️ **Hinweis**: IRAM ist fast voll (93%). Bei weiteren Features sollte darauf geachtet werden, dass Code nicht mit `ICACHE_RAM_ATTR` markiert wird, es sei denn es ist absolut notwendig.
