<template>
  <div class="web-serial-flasher">
    <h2 class="text-2xl font-bold mb-6">ESP8266 Flashen (Web Serial)</h2>

    <!-- Browser Support Check -->
    <div v-if="!isSupported" class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
      <p class="text-red-800 font-semibold">❌ Web Serial API nicht unterstützt</p>
      <p class="text-sm text-red-600 mt-2">
        Bitte verwende Chrome, Edge oder Opera (Version 89+)
      </p>
    </div>

    <div v-else class="space-y-6">
      <!-- Info Box -->
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p class="text-sm text-blue-800">
          <strong>ℹ️ Hinweis:</strong> Hier flashst du die Firmware auf ein <strong>neues</strong> oder <strong>zurückgesetztes</strong> ESP8266-Gerät per USB.
          Wenn dein Gerät bereits geflasht ist und im WLAN läuft, kannst du direkt unten nach Geräten suchen.
        </p>
      </div>

      <!-- Step 1: Connect & Flash -->
      <div class="setup-step">
        <h3 class="text-xl font-semibold mb-4">1. ESP8266 per USB verbinden & flashen</h3>
        <div class="space-y-4">
          <!-- Connection Status -->
          <div class="p-4 rounded-lg" :class="isConnected ? 'bg-green-50 border border-green-200' : 'bg-gray-100'">
            <div class="flex items-center gap-3">
              <div
                class="w-3 h-3 rounded-full"
                :class="isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'"
              ></div>
              <div class="flex-1">
                <span class="font-medium block">
                  USB: {{ isConnected ? '✓ Verbunden' : 'Nicht verbunden' }}
                </span>
                <span v-if="isConnected && isFramoluxFirmware" class="text-xs text-green-700 block">
                  ✓ Framolux Firmware {{ firmwareVersion }} erkannt
                </span>
                <span v-else-if="isConnected && !isFramoluxFirmware" class="text-xs text-orange-600 block">
                  ⚠ Unbekannte Firmware - Bitte Framolux Firmware flashen
                </span>
                <span v-else-if="isConnected" class="text-xs text-gray-600 block">
                  Warte auf Serial Output...
                </span>
              </div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex gap-4 flex-wrap">
            <button
              v-if="!isConnected"
              @click="connectDevice"
              :disabled="isFlashing"
              class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              🔌 ESP8266 per USB verbinden
            </button>

            <button
              v-if="isConnected && !isFlashing"
              @click="startFlash"
              class="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              ⚡ Firmware flashen
            </button>

            <button
              v-if="isConnected && !isFramoluxFirmware"
              @click="triggerReset"
              class="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
              title="Versuche ESP8266 neu zu starten um Firmware zu erkennen"
            >
              🔄 Reset & Detect
            </button>

            <button
              v-if="isConnected"
              @click="disconnectDevice"
              class="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Trennen
            </button>
          </div>

          <!-- Info: Serial Monitor -->
          <div v-if="isConnected && isFramoluxFirmware" class="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p class="text-sm text-blue-800 mb-2">
              <strong>💡 Serial Monitor aktiv:</strong> Du siehst alle Ausgaben des ESP8266 im Log unten.
            </p>
            <button
              @click="showSerialConfig = !showSerialConfig"
              class="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              {{ showSerialConfig ? '▼ Erweiterte Serial-Konfiguration ausblenden' : '▶ Erweiterte Serial-Konfiguration anzeigen' }}
            </button>
          </div>

          <!-- Serial Configuration -->
          <div v-if="isConnected && isFramoluxFirmware && showSerialConfig" class="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
            <h4 class="font-semibold text-gray-800">WiFi über Serial konfigurieren</h4>
            <p class="text-sm text-gray-600">
              Konfiguriere WiFi direkt über USB ohne den WiFi Access Point zu nutzen.
            </p>
            
            <div class="space-y-3">
              <div>
                <label class="block text-sm font-medium mb-1">WLAN-Name (SSID)</label>
                <input
                  v-model="serialWifiSsid"
                  type="text"
                  placeholder="Dein WLAN-Name"
                  class="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium mb-1">WLAN-Passwort</label>
                <input
                  v-model="serialWifiPassword"
                  type="password"
                  placeholder="Dein WLAN-Passwort"
                  class="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium mb-1">Geräte-Name (optional)</label>
                <input
                  v-model="serialDeviceName"
                  type="text"
                  placeholder="z.B. Wohnzimmer"
                  maxlength="16"
                  class="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium mb-1">OpenAI API Key (optional)</label>
                <input
                  v-model="serialApiKey"
                  type="password"
                  placeholder="sk-proj-..."
                  class="w-full px-3 py-2 border rounded-lg text-sm font-mono"
                />
                <p class="text-xs text-gray-500 mt-1">
                  Wird sicher auf dem ESP8266 gespeichert. Für KI-generierte Frames.
                </p>
              </div>
              
              <div class="flex gap-2 flex-wrap">
                <button
                  @click="configureViaSerial"
                  :disabled="!serialWifiSsid || !serialWifiPassword"
                  class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 text-sm"
                >
                  📡 WiFi konfigurieren
                </button>
                
                <button
                  @click="setApiKey"
                  :disabled="!serialApiKey"
                  class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 text-sm"
                >
                  🔑 API Key setzen
                </button>
                
                <button
                  @click="getStatus"
                  class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
                >
                  📊 Status abrufen
                </button>
              </div>
            </div>
          </div>

          <!-- Flash Progress -->
          <div v-if="isFlashing" class="space-y-2">
            <div class="w-full bg-gray-200 rounded-full h-4">
              <div
                class="bg-green-600 h-4 rounded-full transition-all duration-300 flex items-center justify-center text-xs text-white font-semibold"
                :style="{ width: `${flashProgress}%` }"
              >
                {{ flashProgress }}%
              </div>
            </div>
            <p class="text-sm text-center text-gray-600">Flashe Firmware...</p>
          </div>

          <!-- Instructions -->
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p class="text-sm font-semibold text-blue-800 mb-2">📝 Anleitung (nur für neue Geräte):</p>
            <ol class="text-sm text-blue-700 space-y-1 list-decimal list-inside">
              <li><strong>ESP8266 per USB-Kabel</strong> an Computer anschließen</li>
              <li>Auf <strong>"🔌 ESP8266 verbinden"</strong> klicken</li>
              <li>Im Browser-Dialog den <strong>richtigen COM-Port</strong> auswählen</li>
              <li>Auf <strong>"⚡ Firmware flashen"</strong> klicken</li>
              <li>Warten bis Flash abgeschlossen ist (~30 Sekunden)</li>
              <li>Danach: WiFi-Konfiguration (siehe unten)</li>
            </ol>
          </div>
        </div>
      </div>

      <!-- Step 3: Log Output -->
      <div v-if="flashLog.length > 0" class="setup-step">
        <h3 class="text-xl font-semibold mb-4">3. Flash-Log & Serial Monitor</h3>
        <div class="bg-black text-green-400 p-4 rounded-lg font-mono text-sm h-96 overflow-y-auto" ref="logContainer">
          <div v-for="(line, index) in flashLog" :key="index" :class="getLogLineClass(line)">
            {{ line }}
          </div>
        </div>
        <div class="mt-2 flex gap-2">
          <button
            @click="clearLog"
            class="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-800 text-sm"
          >
            Log löschen
          </button>
          <button
            v-if="isConnected && isFramoluxFirmware"
            @click="scrollToBottom"
            class="px-4 py-2 bg-blue-700 text-white rounded hover:bg-blue-800 text-sm"
          >
            ⬇ Zum Ende scrollen
          </button>
        </div>
      </div>

      <!-- Step 4: After Flash -->
      <div v-if="flashComplete" class="setup-step">
        <h3 class="text-xl font-semibold mb-4">4. WiFi konfigurieren</h3>
        <div class="bg-green-50 border border-green-200 rounded-lg p-4">
          <p class="text-green-800 font-semibold mb-2">✅ Flash erfolgreich!</p>
          <p class="text-sm text-green-700 mb-4">
            Der ESP8266 startet jetzt und erstellt einen WiFi Access Point.
          </p>
          <div class="space-y-2 text-sm text-green-700">
            <p><strong>Nächste Schritte:</strong></p>
            <ol class="list-decimal list-inside space-y-1 ml-2">
              <li>Suche nach WiFi-Netzwerk <code class="bg-green-100 px-2 py-1 rounded">Framolux-XXXXXX</code> (siehe Serial Monitor oben für genauen Namen)</li>
              <li>Verbinde mit diesem Netzwerk (Passwort: <code class="bg-green-100 px-2 py-1 rounded">framolux123</code>)</li>
              <li>Browser öffnet automatisch Konfigurationsseite (oder manuell: <code class="bg-green-100 px-2 py-1 rounded">http://192.168.4.1</code>)</li>
              <li>Wähle dein WLAN aus und gib Passwort ein</li>
              <li><strong>Wichtig:</strong> Gib einen benutzerdefinierten Namen ein (z.B. "Wohnzimmer", "Kueche") - nur Buchstaben und Zahlen!</li>
              <li>Klicke auf "Save" - Gerät verbindet sich mit deinem WLAN</li>
              <li>Beim nächsten Neustart heißt das WiFi dann: <code class="bg-green-100 px-2 py-1 rounded">Framolux-DeinName-XXXX</code></li>
              <li>Notiere die IP-Adresse aus dem Serial Monitor für die Verbindung</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const {
  isSupported,
  isConnected,
  isFlashing,
  flashProgress,
  flashLog,
  isFramoluxFirmware,
  firmwareVersion,
  connect,
  disconnect,
  flashFirmware,
  clearLog,
  configureWiFiViaSerial,
  setDeviceNameViaSerial,
  getDeviceStatus,
  setApiKeyViaSerial,
  getApiKeyStatus,
  deleteApiKey,
} = useWebSerial()

const flashComplete = ref(false)
const logContainer = ref<HTMLElement | null>(null)
const showSerialConfig = ref(false)
const serialWifiSsid = ref('')
const serialWifiPassword = ref('')
const serialDeviceName = ref('')
const serialApiKey = ref('')

const connectDevice = async () => {
  try {
    await connect()
  } catch (error) {
    alert('Verbindung fehlgeschlagen! Bitte prüfe die USB-Verbindung.')
  }
}

const triggerReset = async () => {
  // Trenne und verbinde neu um Reset zu triggern
  await disconnect()
  await new Promise(resolve => setTimeout(resolve, 500))
  await connect()
}

const configureViaSerial = async () => {
  if (!serialWifiSsid.value || !serialWifiPassword.value) {
    alert('Bitte SSID und Passwort eingeben')
    return
  }
  
  // Setze Device-Namen falls angegeben
  if (serialDeviceName.value) {
    await setDeviceNameViaSerial(serialDeviceName.value)
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  
  // Konfiguriere WiFi
  await configureWiFiViaSerial(serialWifiSsid.value, serialWifiPassword.value)
}

const getStatus = async () => {
  await getDeviceStatus()
}

const setApiKey = async () => {
  if (!serialApiKey.value) {
    alert('Bitte API Key eingeben')
    return
  }
  
  await setApiKeyViaSerial(serialApiKey.value)
  serialApiKey.value = '' // Clear nach dem Setzen
}

// Highlight wichtige Log-Zeilen
const getLogLineClass = (line: string) => {
  if (line.includes('✓') || line.includes('success')) {
    return 'text-green-400 font-semibold'
  }
  if (line.includes('✗') || line.includes('error') || line.includes('failed')) {
    return 'text-red-400 font-semibold'
  }
  if (line.includes('AP SSID:') || line.includes('IP address:') || line.includes('WiFi connected')) {
    return 'text-yellow-300 font-bold'
  }
  if (line.includes('[Serial]')) {
    return 'text-cyan-400'
  }
  if (line.includes('===')) {
    return 'text-blue-400 font-semibold'
  }
  return 'text-green-400'
}

// Scrolle zum Ende des Logs
const scrollToBottom = () => {
  if (logContainer.value) {
    logContainer.value.scrollTop = logContainer.value.scrollHeight
  }
}

// Auto-scroll wenn neue Log-Einträge kommen
watch(() => flashLog.value.length, () => {
  nextTick(() => scrollToBottom())
})

const disconnectDevice = async () => {
  await disconnect()
  flashComplete.value = false
}

const startFlash = async () => {
  if (!confirm('Firmware jetzt flashen? Dies dauert ca. 30 Sekunden.')) {
    return
  }

  try {
    flashComplete.value = false
    
    // URL zur vorkompilierten Firmware
    // Diese muss im public/ Ordner liegen
    const firmwareUrl = '/firmware/framolux-esp8266.bin'
    
    await flashFirmware(firmwareUrl, '')
    
    flashComplete.value = true
  } catch (error) {
    alert('Flash fehlgeschlagen! Siehe Log für Details.')
  }
}
</script>

<style scoped>
.setup-step {
  border-left: 4px solid #3b82f6;
  padding-left: 1rem;
}

code {
  font-family: 'Courier New', monospace;
}
</style>
