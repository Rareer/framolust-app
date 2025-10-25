# CORS-Problem Lösung

## Problem

Beim POST-Request an den ESP8266-Webserver (`/frames` Endpoint) trat ein CORS-Fehler auf:
- Zuerst: Keine Response bei POST-Requests
- Dann: `PreflightMultipleAllowOriginValues` - mehrfache `Access-Control-Allow-Origin` Header

### Ursache

1. **Fehlende OPTIONS-Handler**: Browser senden bei Cross-Origin POST-Requests einen "Preflight"-Request mit der HTTP-Methode OPTIONS. Dieser muss mit den richtigen CORS-Headern beantwortet werden.

2. **Doppelte CORS-Header**: `server.enableCORS(true)` setzt automatisch CORS-Header, aber wir haben mit `server.sendHeader()` nochmal welche hinzugefügt. Dies führte zu **mehrfachen** `Access-Control-Allow-Origin` Headern, was vom Browser als Fehler gewertet wird.

3. **Doppelter `onNotFound` Handler** (nur WiFi-Manager-Version): Der `onNotFound` Handler wurde zweimal definiert - der zweite überschrieb den ersten, wodurch OPTIONS-Requests nicht korrekt behandelt wurden.

## Lösung

### 1. `server.enableCORS(true)` ENTFERNT

**WICHTIG**: `server.enableCORS(true)` darf NICHT verwendet werden, wenn man manuell CORS-Header setzt!

```cpp
void setupRoutes() {
  // WICHTIG: enableCORS(true) NICHT verwenden - führt zu doppelten Headers!
  // Wir setzen CORS-Header manuell in jedem Handler
  
  // ... Routes definieren
}
```

### 2. Explizite OPTIONS-Handler hinzugefügt

Für jeden Endpoint, der POST/PUT/DELETE unterstützt, wurde ein expliziter OPTIONS-Handler hinzugefügt:

```cpp
// OPTIONS Handler für /frames
server.on("/frames", HTTP_OPTIONS, []() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  server.sendHeader("Access-Control-Max-Age", "86400");
  server.send(204);
});

// OPTIONS Handler für /config
server.on("/config", HTTP_OPTIONS, []() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "PUT, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  server.sendHeader("Access-Control-Max-Age", "86400");
  server.send(204);
});
```

### 3. CORS-Header in ALLEN Handlern

Zusätzlich werden CORS-Header auch in den eigentlichen Request-Handlern gesetzt:

```cpp
void handleUploadFrames() {
  // CORS Headers explizit setzen
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  
  // ... Rest des Handlers
}
```

Jeder Handler (GET, POST, PUT, DELETE) muss CORS-Header setzen:

```cpp
void handleStatus() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  
  // ... Rest des Handlers
}

void handleUploadFrames() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  
  // ... Rest des Handlers
}
```

### 4. Catch-All OPTIONS-Handler (WiFi-Manager-Version)

Im `onNotFound` Handler wird geprüft, ob es ein OPTIONS-Request ist:

```cpp
server.onNotFound([]() {
  if (server.method() == HTTP_OPTIONS) {
    Serial.println("OPTIONS request (catch-all) for: " + server.uri());
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.sendHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    server.sendHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    server.sendHeader("Access-Control-Max-Age", "86400");
    server.send(204);
  } else {
    handleNotFound();
  }
});
```

## Betroffene Dateien

- `firmware/framolux-esp8266/framolux-esp8266.ino`
- `firmware/framolux-esp8266-wifimanager/framolux-esp8266-wifimanager.ino`

## Firmware neu flashen

Nach den Änderungen muss die Firmware neu kompiliert und auf den ESP8266 geflasht werden:

### Windows (PowerShell)
```powershell
cd firmware
.\build-binary.ps1
```

### Linux/Mac
```bash
cd firmware
./build-binary.sh
```

## Testen

Nach dem Flash kannst du testen, ob CORS funktioniert:

```javascript
// Im Browser-Console
fetch('http://192.168.1.xxx/frames', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    description: 'Test',
    loop: true,
    frames: [{ pixels: [[...]], duration: 1000 }]
  })
})
.then(r => r.json())
.then(console.log)
.catch(console.error)
```

## CORS-Header Erklärung

- **Access-Control-Allow-Origin**: `*` erlaubt Requests von jeder Domain
- **Access-Control-Allow-Methods**: Erlaubte HTTP-Methoden
- **Access-Control-Allow-Headers**: Erlaubte Request-Header
- **Access-Control-Max-Age**: Cache-Dauer für Preflight-Requests (24h)

## Hinweise

- Der OPTIONS-Request (Preflight) wird vom Browser automatisch gesendet
- Er prüft, ob der Server Cross-Origin-Requests erlaubt
- Erst nach erfolgreicher OPTIONS-Response wird der eigentliche POST-Request gesendet
- HTTP-Status 204 (No Content) ist die Standard-Response für OPTIONS
