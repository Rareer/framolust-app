# Test-Frame 400-Fehler Fix ✅

## Problem

Nach Entfernung des JSON-Supports sendete `sendTestFrame()` noch JSON-Format:

```typescript
// Alt (JSON)
const response = await $fetch(`http://${ip}/frames`, {
  method: 'POST',
  body: {
    description: 'Test Animation',
    loop: true,
    frames: [testFrame],
  },
})
```

Die Firmware akzeptiert aber nur noch **Binär-Format** → HTTP 400 Error

## Lösung

`sendTestFrame()` wurde aktualisiert um binäres Format zu verwenden:

```typescript
// Neu (Binär)
const { compressAnimation } = useFrameCompression()

const animation = {
  description: 'Test Animation',
  loop: true,
  frames: [{ pixels, duration: 3000 }],
}

const binaryData = compressAnimation(animation)

const response = await $fetch(`http://${ip}/frames`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/octet-stream',
  },
  body: binaryData,
})
```

## Test

Nach dem Fix:

1. **Sende Test-Frame** über Web-App
2. **Console zeigt**:
   ```
   📦 Test frame: 792 bytes (binary)
   ✓ Test frame uploaded: { success: true, frameCount: 1, ... }
   ```
3. **ESP8266 Serial Monitor**:
   ```
   === POST /frames ===
   Received data: 792 bytes
   ✓ Valid binary format detected
   ✓ Binary frames saved: 1 frames, 792 bytes
   📦 Starting BINARY animation playback
   ```
4. **LED-Display**: Grünes Kreuz wird angezeigt

## Geänderte Datei

- `app/composables/useESP8266.ts` - `sendTestFrame()` verwendet jetzt Binär-Format

## Hinweis

Alle Frame-Uploads verwenden jetzt automatisch binäres Format:
- ✅ `uploadFramesToDevice()` - Binär
- ✅ `sendTestFrame()` - Binär
- ❌ JSON - Nicht mehr unterstützt
