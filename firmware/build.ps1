# Framolux ESP8266 Build Script
# Kompiliert die Firmware mit benutzerdefinierten WiFi-Credentials

param(
    [Parameter(Mandatory=$true)]
    [string]$SSID,
    
    [Parameter(Mandatory=$true)]
    [string]$Password,
    
    [string]$DeviceId = "",
    
    [string]$Board = "esp8266:esp8266:nodemcuv2",
    
    [string]$Port = "",
    
    [switch]$Upload
)

$ErrorActionPreference = "Stop"

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Framolux ESP8266 Build Script" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Prüfe ob Arduino CLI installiert ist
try {
    $version = arduino-cli version
    Write-Host "✓ Arduino CLI gefunden: $version" -ForegroundColor Green
} catch {
    Write-Host "✗ Arduino CLI nicht gefunden!" -ForegroundColor Red
    Write-Host "Bitte installiere Arduino CLI: https://arduino.github.io/arduino-cli/" -ForegroundColor Yellow
    exit 1
}

# Sketch Pfad
$sketchPath = Join-Path $PSScriptRoot "framolux-esp8266"

if (-not (Test-Path $sketchPath)) {
    Write-Host "✗ Sketch nicht gefunden: $sketchPath" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Sketch gefunden: $sketchPath" -ForegroundColor Green
Write-Host ""

# Generiere Device ID falls nicht angegeben
if ([string]::IsNullOrEmpty($DeviceId)) {
    $DeviceId = "FLX" + (Get-Random -Minimum 100000 -Maximum 999999).ToString()
    Write-Host "✓ Device ID generiert: $DeviceId" -ForegroundColor Green
} else {
    Write-Host "✓ Device ID: $DeviceId" -ForegroundColor Green
}

# Build Properties mit WiFi Credentials und Device ID
$buildProps = @(
    "build.extra_flags=-DWIFI_SSID=\`"$SSID\`" -DWIFI_PASSWORD=\`"$Password\`" -DDEVICE_ID=\`"$DeviceId\`""
)

Write-Host ""
Write-Host "Konfiguration:" -ForegroundColor Cyan
Write-Host "  SSID: $SSID"
Write-Host "  Device ID: $DeviceId"
Write-Host "  Board: $Board"
Write-Host ""

# Kompilieren
Write-Host "Kompiliere Firmware..." -ForegroundColor Yellow

$compileArgs = @(
    "compile",
    "--fqbn", $Board,
    "--build-property", $buildProps[0],
    $sketchPath
)

try {
    & arduino-cli @compileArgs
    Write-Host ""
    Write-Host "✓ Kompilierung erfolgreich!" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "✗ Kompilierung fehlgeschlagen!" -ForegroundColor Red
    exit 1
}

# Upload (optional)
if ($Upload) {
    Write-Host ""
    
    # Port automatisch erkennen, falls nicht angegeben
    if ([string]::IsNullOrEmpty($Port)) {
        Write-Host "Suche nach ESP8266..." -ForegroundColor Yellow
        $boards = arduino-cli board list --format json | ConvertFrom-Json
        
        foreach ($board in $boards) {
            if ($board.matching_boards) {
                foreach ($match in $board.matching_boards) {
                    if ($match.fqbn -like "esp8266:*") {
                        $Port = $board.address
                        Write-Host "✓ ESP8266 gefunden auf Port: $Port" -ForegroundColor Green
                        break
                    }
                }
            }
        }
        
        if ([string]::IsNullOrEmpty($Port)) {
            Write-Host "✗ Kein ESP8266 gefunden!" -ForegroundColor Red
            Write-Host "Bitte Port manuell angeben mit -Port COM3" -ForegroundColor Yellow
            exit 1
        }
    }
    
    Write-Host ""
    Write-Host "Uploade Firmware auf $Port..." -ForegroundColor Yellow
    
    $uploadArgs = @(
        "upload",
        "-p", $Port,
        "--fqbn", $Board,
        $sketchPath
    )
    
    try {
        & arduino-cli @uploadArgs
        Write-Host ""
        Write-Host "✓ Upload erfolgreich!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Das Gerät sollte sich jetzt mit dem WLAN verbinden." -ForegroundColor Cyan
        Write-Host "Öffne den Serial Monitor um die IP-Adresse zu sehen:" -ForegroundColor Cyan
        Write-Host "  arduino-cli monitor -p $Port -c baudrate=115200" -ForegroundColor White
    } catch {
        Write-Host ""
        Write-Host "✗ Upload fehlgeschlagen!" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Build abgeschlossen!" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
