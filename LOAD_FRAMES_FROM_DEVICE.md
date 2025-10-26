# Frames vom ESP8266 laden

## Feature-Beschreibung

Mit diesem Feature können Frames, die auf dem ESP8266 gespeichert sind, zurück in die Web-App geladen werden. Dies ist nützlich, wenn:

- Du die Animation auf einem anderen Gerät bearbeiten möchtest
- Du eine Sicherungskopie der auf dem Chip gespeicherten Animation erstellen möchtest
- Du die Animation weiter bearbeiten möchtest, nachdem sie bereits hochgeladen wurde

## Verwendung

1. **ESP8266 Setup öffnen**: Klicke auf den ESP8266-Button in der TopBar
2. **Gerät auswählen**: Wähle dein verbundenes ESP8266-Gerät aus
3. **Frames laden**: Klicke auf den Button "📥 Frames vom Gerät laden"
4. Die Animation wird automatisch in die App geladen und das Modal geschlossen

## Technische Details

### Frontend (Web-App)

- **`useESP8266.ts`**: 
  - `getFramesFromDevice()` - Lädt binäre Daten vom ESP8266
  - `loadFramesFromDevice()` - Wrapper-Funktion für den Import
  
- **`useFrameCompression.ts`**:
  - `decompressAnimation()` - Dekomprimiert das binäre Format zurück zu Pixel-Arrays
  - Rotiert die Frames um 180° zurück (da sie beim Upload gedreht wurden)

- **`ESP8266Setup.vue`**:
  - Neuer Button "📥 Frames vom Gerät laden"
  - Wird deaktiviert wenn keine Frames auf dem Gerät gespeichert sind
  - Emittiert `load-frames` Event mit der geladenen Animation

- **`index.vue`**:
  - `handleLoadFramesFromDevice()` - Importiert die Animation in den Editor

### Firmware (ESP8266)

- **`handleGetFrames()`** wurde angepasst:
  - Sendet jetzt binäre Daten statt JSON
  - Content-Type: `application/octet-stream`
  - Streamt die Datei in 512-Byte-Chunks
  - CORS-Header für Cross-Origin-Requests

## Datenformat

Die Frames werden im gleichen binären Format übertragen wie beim Upload:

```
Animation-Header (16 Bytes):
  - Magic: "FMLX" (4 Bytes)
  - Version: uint16_t (2 Bytes)
  - Frame Count: uint16_t (2 Bytes)
  - Loop: uint8_t (1 Byte)
  - Reserved: 7 Bytes

Frame-Header (8 Bytes pro Frame):
  - Duration: uint32_t (4 Bytes)
  - Width: uint8_t (1 Byte)
  - Height: uint8_t (1 Byte)
  - Reserved: uint16_t (2 Bytes)

Pixel-Daten (width × height × 3 Bytes):
  - R, G, B (je 1 Byte pro Pixel)
```

## Hinweise

- Die Frames werden automatisch um 180° gedreht, um die korrekte Orientierung wiederherzustellen
- Der Button ist nur aktiv, wenn Frames auf dem Gerät gespeichert sind (`frameCount > 0`)
- Die aktuelle Animation in der App wird überschrieben
- Das ESP8266 Setup Modal wird automatisch geschlossen nach erfolgreichem Laden
