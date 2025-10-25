# Build vorkompilierte Firmware Binary
# Diese wird einmalig erstellt und kann dann via Web Serial geflasht werden

param(
    [string]$Board = "esp8266:esp8266:nodemcuv2",
    [string]$OutputDir = "binaries"
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Framolux ESP8266 Binary Builder" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Pruefe ob Arduino CLI installiert ist
try {
    $version = arduino-cli version
    Write-Host "OK Arduino CLI gefunden: $version" -ForegroundColor Green
} catch {
    Write-Host "FEHLER Arduino CLI nicht gefunden!" -ForegroundColor Red
    Write-Host "Bitte installiere Arduino CLI: https://arduino.github.io/arduino-cli/" -ForegroundColor Yellow
    exit 1
}

# Sketch Pfad
$sketchPath = Join-Path $PSScriptRoot "framolux-esp8266-wifimanager"

if (-not (Test-Path $sketchPath)) {
    Write-Host "FEHLER Sketch nicht gefunden: $sketchPath" -ForegroundColor Red
    exit 1
}

Write-Host "OK Sketch gefunden: $sketchPath" -ForegroundColor Green
Write-Host ""

# Output Directory erstellen
$outputPath = Join-Path $PSScriptRoot $OutputDir
if (-not (Test-Path $outputPath)) {
    New-Item -ItemType Directory -Path $outputPath | Out-Null
}

Write-Host "Konfiguration:" -ForegroundColor Cyan
Write-Host "  Board: $Board"
Write-Host "  Output: $outputPath"
Write-Host ""

# Kompilieren
Write-Host "Kompiliere Firmware..." -ForegroundColor Yellow
Write-Host ""

$compileArgs = @(
    "compile",
    "--fqbn", $Board,
    "--output-dir", $outputPath,
    $sketchPath
)

& arduino-cli @compileArgs

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "FEHLER Kompilierung fehlgeschlagen!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "OK Kompilierung erfolgreich!" -ForegroundColor Green

# Finde .bin Datei
$binFile = Get-ChildItem -Path $outputPath -Filter "*.bin" | Select-Object -First 1

if ($binFile) {
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "Binary erstellt!" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Datei: $($binFile.FullName)" -ForegroundColor White
    Write-Host "Groesse: $([math]::Round($binFile.Length / 1KB, 2)) KB" -ForegroundColor White
    Write-Host ""
    Write-Host "Kopiere nach public/firmware/..." -ForegroundColor Yellow
    
    # Kopiere in public Ordner fuer WebApp
    $publicFirmwareDir = Join-Path $PSScriptRoot "..\public\firmware"
    if (-not (Test-Path $publicFirmwareDir)) {
        New-Item -ItemType Directory -Path $publicFirmwareDir | Out-Null
    }
    
    $targetFile = Join-Path $publicFirmwareDir "framolux-esp8266.bin"
    Copy-Item -Path $binFile.FullName -Destination $targetFile -Force
    
    Write-Host "OK Binary kopiert nach: $targetFile" -ForegroundColor Green
    Write-Host ""
    Write-Host "Die Firmware kann jetzt via Web Serial geflasht werden!" -ForegroundColor Cyan
} else {
    Write-Host "FEHLER Keine .bin Datei gefunden!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Build abgeschlossen!" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
