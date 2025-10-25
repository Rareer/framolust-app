# Frame-Kompression für ESP8266

## Problem

Ein 16x16 Pixel-Frame im aktuellen JSON-Format benötigt:
- **256 Pixel** × 9 Bytes (`"#RRGGBB"`) = **~2.3 KB pro Frame**
- Mit JSON-Overhead: **~3-4 KB pro Frame**
- Bei 10 Frames: **~30-40 KB**
- Bei 30 Frames: **~90-120 KB**

Der ESP8266 hat nur:
- **80 KB RAM** (davon ~40 KB frei)
- **4 MB Flash** (LittleFS: ~1-2 MB verfügbar)

## Lösungsansätze

### Option 1: Binäres Format (Empfohlen!)

Speichere Pixel als **Raw RGB-Bytes** statt Hex-Strings.

#### Vorteile
- ✅ **85% kleiner**: 3 Bytes pro Pixel statt 9 Bytes
- ✅ Kein JSON-Parsing nötig
- ✅ Direktes Mapping zu FastLED CRGB-Struktur
- ✅ Schnelleres Laden

#### Format
```
Frame-Header (8 Bytes):
  - duration: uint32_t (4 Bytes)
  - width: uint8_t (1 Byte)
  - height: uint8_t (1 Byte)
  - reserved: uint16_t (2 Bytes)

Pixel-Daten (width × height × 3 Bytes):
  - R, G, B (je 1 Byte)

Beispiel für 16x16:
  - Header: 8 Bytes
  - Pixels: 256 × 3 = 768 Bytes
  - Total: 776 Bytes pro Frame (vs. 3000 Bytes JSON)
```

#### Speicherung
```
Animation-Header (16 Bytes):
  - magic: "FMLX" (4 Bytes)
  - version: uint16_t (2 Bytes)
  - frameCount: uint16_t (2 Bytes)
  - loop: uint8_t (1 Byte)
  - reserved: 7 Bytes

Frames: [Frame1][Frame2][Frame3]...
```

### Option 2: RLE (Run-Length Encoding)

Komprimiere aufeinanderfolgende gleiche Farben.

#### Vorteile
- ✅ Sehr effizient für einfarbige Bereiche
- ✅ Einfach zu implementieren

#### Nachteile
- ❌ Weniger effizient bei komplexen Bildern
- ❌ Variable Größe (schwer zu berechnen)

#### Format
```
Für jede Farbe:
  - count: uint8_t (1 Byte) - Anzahl Wiederholungen
  - R, G, B: uint8_t (3 Bytes)

Beispiel:
  [10, 255, 0, 0]    = 10× Rot
  [5, 0, 255, 0]     = 5× Grün
  [241, 0, 0, 0]     = 241× Schwarz
```

### Option 3: Palette-basiert (8-Bit Color)

Verwende eine Farbpalette mit max. 256 Farben.

#### Vorteile
- ✅ Nur 1 Byte pro Pixel (statt 3)
- ✅ 66% kleiner als binär

#### Nachteile
- ❌ Limitiert auf 256 Farben pro Animation
- ❌ Zusätzliche Palette nötig

#### Format
```
Palette (max. 256 Farben × 3 Bytes):
  [R, G, B], [R, G, B], ...

Pixel-Daten (1 Byte pro Pixel):
  [paletteIndex, paletteIndex, ...]
```

### Option 4: Hybrid (RLE + Binär)

Kombiniere RLE für einfache Bereiche mit binär für komplexe.

## Empfehlung: **Option 1 (Binäres Format)**

### Implementierung

#### 1. Frontend: Konvertierung zu Binär

```typescript
// app/composables/useFrameCompression.ts
export const useFrameCompression = () => {
  
  /**
   * Konvertiere Pixel-Array zu binärem Format
   */
  const compressFrame = (frame: {
    pixels: string[][]
    duration: number
  }): Uint8Array => {
    const width = frame.pixels[0]?.length || 16
    const height = frame.pixels.length || 16
    
    // Header: 8 Bytes
    const header = new Uint8Array(8)
    const view = new DataView(header.buffer)
    view.setUint32(0, frame.duration, true) // Little-endian
    view.setUint8(4, width)
    view.setUint8(5, height)
    
    // Pixel-Daten: width × height × 3 Bytes
    const pixels = new Uint8Array(width * height * 3)
    let offset = 0
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const hex = frame.pixels[y][x].replace('#', '')
        const r = parseInt(hex.substring(0, 2), 16)
        const g = parseInt(hex.substring(2, 4), 16)
        const b = parseInt(hex.substring(4, 6), 16)
        
        pixels[offset++] = r
        pixels[offset++] = g
        pixels[offset++] = b
      }
    }
    
    // Kombiniere Header + Pixels
    const result = new Uint8Array(header.length + pixels.length)
    result.set(header, 0)
    result.set(pixels, header.length)
    
    return result
  }
  
  /**
   * Konvertiere Animation zu binärem Format
   */
  const compressAnimation = (animation: {
    description: string
    loop: boolean
    frames: Array<{ pixels: string[][], duration: number }>
  }): Uint8Array => {
    // Animation-Header: 16 Bytes
    const header = new Uint8Array(16)
    const view = new DataView(header.buffer)
    
    // Magic: "FMLX"
    header[0] = 0x46 // 'F'
    header[1] = 0x4D // 'M'
    header[2] = 0x4C // 'L'
    header[3] = 0x58 // 'X'
    
    view.setUint16(4, 1, true) // Version 1
    view.setUint16(6, animation.frames.length, true)
    view.setUint8(8, animation.loop ? 1 : 0)
    
    // Komprimiere alle Frames
    const compressedFrames = animation.frames.map(compressFrame)
    
    // Berechne Gesamtgröße
    const totalSize = header.length + compressedFrames.reduce(
      (sum, frame) => sum + frame.length, 0
    )
    
    // Kombiniere alles
    const result = new Uint8Array(totalSize)
    let offset = 0
    
    result.set(header, offset)
    offset += header.length
    
    for (const frame of compressedFrames) {
      result.set(frame, offset)
      offset += frame.length
    }
    
    return result
  }
  
  return {
    compressFrame,
    compressAnimation,
  }
}
```

#### 2. ESP8266: Binäres Format lesen

```cpp
// Frame-Header Struktur
struct FrameHeader {
  uint32_t duration;
  uint8_t width;
  uint8_t height;
  uint16_t reserved;
} __attribute__((packed));

// Animation-Header Struktur
struct AnimationHeader {
  char magic[4];      // "FMLX"
  uint16_t version;
  uint16_t frameCount;
  uint8_t loop;
  uint8_t reserved[7];
} __attribute__((packed));

/**
 * Lade Frame aus binärem Format
 */
bool loadBinaryFrame(File& file, int frameIndex) {
  // Lese Animation-Header
  AnimationHeader animHeader;
  file.seek(0);
  file.read((uint8_t*)&animHeader, sizeof(AnimationHeader));
  
  // Prüfe Magic
  if (strncmp(animHeader.magic, "FMLX", 4) != 0) {
    Serial.println("Invalid binary format!");
    return false;
  }
  
  // Überspringe zum gewünschten Frame
  size_t offset = sizeof(AnimationHeader);
  for (int i = 0; i < frameIndex; i++) {
    file.seek(offset);
    FrameHeader header;
    file.read((uint8_t*)&header, sizeof(FrameHeader));
    offset += sizeof(FrameHeader) + (header.width * header.height * 3);
  }
  
  // Lese Frame-Header
  file.seek(offset);
  FrameHeader header;
  file.read((uint8_t*)&header, sizeof(FrameHeader));
  
  // Lese Pixel-Daten direkt in LED-Array
  uint8_t rgb[3];
  for (int y = 0; y < header.height && y < MATRIX_HEIGHT; y++) {
    for (int x = 0; x < header.width && x < MATRIX_WIDTH; x++) {
      file.read(rgb, 3);
      
      // Berechne LED-Index (Serpentine)
      int ledIndex;
      if (y % 2 == 0) {
        ledIndex = y * MATRIX_WIDTH + x;
      } else {
        ledIndex = y * MATRIX_WIDTH + (MATRIX_WIDTH - 1 - x);
      }
      
      if (ledIndex < NUM_LEDS) {
        leds[ledIndex] = CRGB(rgb[0], rgb[1], rgb[2]);
      }
    }
  }
  
  FastLED.show();
  return true;
}
```

## Vergleich: JSON vs. Binär

| Metrik | JSON | Binär | Ersparnis |
|--------|------|-------|-----------|
| **1 Frame (16×16)** | ~3 KB | 776 Bytes | **74%** |
| **10 Frames** | ~30 KB | 7.6 KB | **75%** |
| **30 Frames** | ~90 KB | 23 KB | **74%** |
| **Parse-Zeit** | ~50-100ms | ~5-10ms | **90%** |
| **RAM-Bedarf** | 32 KB Buffer | 1 KB Buffer | **97%** |

## Migration

### Phase 1: Beide Formate unterstützen
- ESP8266 erkennt automatisch JSON vs. Binär (Magic-Bytes)
- Frontend sendet beide Formate (Fallback)

### Phase 2: Nur Binär
- Entferne JSON-Support
- Reduziere RAM-Verbrauch

## Weitere Optimierungen

### 1. Frame-Differenzen (Delta Encoding)
Speichere nur Unterschiede zwischen Frames:
```
Frame 1: Vollständig (776 Bytes)
Frame 2: Nur geänderte Pixel (z.B. 50 Bytes)
Frame 3: Nur geänderte Pixel (z.B. 30 Bytes)
```

### 2. Streaming
Lade Frames on-demand statt alle auf einmal:
```cpp
// Lade nur aktuellen Frame in RAM
loadFrameFromFlash(currentFrameIndex);
```

### 3. Hardware-Kompression
ESP8266 unterstützt keine Hardware-Kompression, aber:
- **gzip**: Software-Implementierung möglich (langsam)
- **LZ4**: Schneller, aber mehr Code

## Fazit

**Binäres Format** ist die beste Wahl:
- ✅ 75% kleiner
- ✅ 90% schneller
- ✅ 97% weniger RAM
- ✅ Einfach zu implementieren
- ✅ Keine externen Libraries nötig

Soll ich die Implementierung starten?
