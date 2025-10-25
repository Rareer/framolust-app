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

      <!-- Step 1: Device ID (optional) -->
      <div class="setup-step">
        <h3 class="text-xl font-semibold mb-4">1. Device-ID (optional)</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">Custom Device-ID</label>
            <input
              v-model="customDeviceId"
              type="text"
              placeholder="Leer lassen für automatische ID (z.B. FLX123456)"
              class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              :disabled="isFlashing"
            />
            <p class="text-xs text-gray-500 mt-1">
              Wird aus MAC-Adresse generiert, wenn leer. Nützlich für mehrere Geräte.
            </p>
          </div>
        </div>
      </div>

      <!-- Step 2: Connect & Flash -->
      <div class="setup-step">
        <h3 class="text-xl font-semibold mb-4">2. ESP8266 per USB verbinden & flashen</h3>
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
                <span v-if="isConnected" class="text-xs text-green-700">
                  Bereit zum Flashen
                </span>
              </div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex gap-4">
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
              v-if="isConnected"
              @click="disconnectDevice"
              :disabled="isFlashing"
              class="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400"
            >
              Trennen
            </button>
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
        <h3 class="text-xl font-semibold mb-4">3. Flash-Log</h3>
        <div class="bg-black text-green-400 p-4 rounded-lg font-mono text-sm h-64 overflow-y-auto">
          <div v-for="(line, index) in flashLog" :key="index">
            {{ line }}
          </div>
        </div>
        <button
          @click="clearLog"
          class="mt-2 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-800 text-sm"
        >
          Log löschen
        </button>
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
              <li>Suche nach WiFi-Netzwerk <code class="bg-green-100 px-2 py-1 rounded">Framolux-XXXXXX</code></li>
              <li>Verbinde mit diesem Netzwerk (Passwort: <code class="bg-green-100 px-2 py-1 rounded">framolux123</code>)</li>
              <li>Browser öffnet automatisch Konfigurationsseite</li>
              <li>Wähle dein WLAN aus und gib Passwort ein</li>
              <li>Optional: Gib einen Device-Namen ein</li>
              <li>Klicke auf "Save" - Gerät verbindet sich mit deinem WLAN</li>
              <li>Notiere die IP-Adresse aus dem Serial Monitor</li>
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
  connect,
  disconnect,
  flashFirmware,
  clearLog,
} = useWebSerial()

const customDeviceId = ref('')
const flashComplete = ref(false)

const connectDevice = async () => {
  try {
    await connect()
  } catch (error) {
    alert('Verbindung fehlgeschlagen! Bitte prüfe die USB-Verbindung.')
  }
}

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
    
    await flashFirmware(firmwareUrl, customDeviceId.value)
    
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
