<template>
  <div class="esp8266-setup">
    <!-- Web Serial Flasher -->
    <WebSerialFlasher />

    <!-- Device Management -->
    <div class="mt-8 border-t pt-8">
    <!-- Step: Gerät finden -->
    <div class="setup-step mb-8">
      <h3 class="text-xl font-semibold mb-4">Gerät im Netzwerk finden</h3>
      <div class="space-y-4">
        <div class="flex gap-4">
          <button
            @click="scanDevices"
            :disabled="isScanning"
            class="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
          >
            {{ isScanning ? 'Suche läuft...' : 'Nach Geräten suchen' }}
          </button>
          <button
            @click="showManualConnect = !showManualConnect"
            class="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Manuelle IP-Eingabe
          </button>
        </div>

        <!-- Manuelle IP-Eingabe -->
        <div v-if="showManualConnect" class="bg-gray-50 p-4 rounded-lg">
          <label class="block text-sm font-medium mb-2">IP-Adresse des ESP8266</label>
          <div class="flex gap-2">
            <input
              v-model="manualIp"
              type="text"
              placeholder="192.168.1.100"
              class="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <button
              @click="connectManually"
              class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Verbinden
            </button>
          </div>
        </div>

        <!-- Gefundene Geräte -->
        <div v-if="devices.length > 0" class="space-y-2">
          <p class="text-sm font-medium">Gefundene Geräte:</p>
          <div
            v-for="device in devices"
            :key="device.deviceId"
            class="border rounded-lg p-4 hover:bg-gray-50"
            :class="{ 'border-blue-500 bg-blue-50': selectedDevice?.deviceId === device.deviceId }"
          >
            <div class="flex justify-between items-start">
              <div class="flex-1 cursor-pointer" @click="selectDevice(device)">
                <div class="flex items-center gap-2">
                  <p class="font-semibold">{{ device.deviceName }}</p>
                  <span class="text-xs text-gray-500">({{ device.deviceId }})</span>
                </div>
                <p class="text-sm text-gray-600">IP: {{ device.ip }}</p>
                <p class="text-sm text-gray-600">MAC: {{ device.mac }}</p>
              </div>
              <div class="text-right flex flex-col gap-2">
                <span
                  class="inline-block px-2 py-1 text-xs rounded"
                  :class="device.status === 'online' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'"
                >
                  {{ device.status }}
                </span>
                <p class="text-sm text-gray-600">{{ device.frameCount }} Frames</p>
                <button
                  @click.stop="startRename(device)"
                  class="text-xs text-blue-600 hover:text-blue-800"
                >
                  ✏️ Umbenennen
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Step 4: Frames hochladen -->
    <div v-if="selectedDevice" class="setup-step">
      <h3 class="text-xl font-semibold mb-4">4. Frames hochladen</h3>
      <div class="space-y-4">
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p class="text-sm">
            <strong>Verbunden mit:</strong> {{ selectedDevice.deviceName }} ({{ selectedDevice.ip }})
          </p>
          <p class="text-sm">
            <strong>Gespeicherte Frames auf ESP8266:</strong> {{ selectedDevice.frameCount }}
          </p>
        </div>

        <!-- Info: Frames aus WebApp hochladen -->
        <div v-if="hasPendingFrames" class="bg-green-50 border border-green-200 rounded-lg p-4">
          <p class="text-sm text-green-800">
            <strong>💡 Tipp:</strong> Du hast eine Animation in der WebApp erstellt. 
            Klicke auf "Frames hochladen" um sie auf das ESP8266 zu übertragen.
          </p>
        </div>

        <div class="flex gap-4">
          <button
            @click="$emit('upload-frames', selectedDevice.ip)"
            :disabled="isUploading || !hasPendingFrames"
            class="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400"
            :title="!hasPendingFrames ? 'Erstelle zuerst eine Animation in der WebApp' : ''"
          >
            {{ isUploading ? 'Upload läuft...' : 'Frames hochladen' }}
          </button>
          <button
            @click="clearFrames"
            class="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Frames löschen
          </button>
        </div>

        <!-- Upload Progress -->
        <div v-if="isUploading" class="space-y-2">
          <div class="w-full bg-gray-200 rounded-full h-4">
            <div
              class="bg-purple-600 h-4 rounded-full transition-all duration-300"
              :style="{ width: `${uploadProgress}%` }"
            ></div>
          </div>
          <p class="text-sm text-center">{{ uploadProgress }}%</p>
        </div>
      </div>
    </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Props: Aktuelle Animation aus der WebApp
const props = defineProps<{
  currentAnimation?: {
    frames: any[]
    description: string
  } | null
}>()

const emit = defineEmits<{
  'upload-frames': [deviceIp: string]
}>()

const {
  devices,
  selectedDevice,
  isScanning,
  isUploading,
  uploadProgress,
  scanForDevices,
  connectToDevice,
  clearFramesOnDevice,
  renameDevice,
  loadKnownDevices,
} = useESP8266()

const showManualConnect = ref(false)
const manualIp = ref('')

// Prüfe ob Frames zum Upload bereit sind
const hasPendingFrames = computed(() => {
  return props.currentAnimation && props.currentAnimation.frames.length > 0
})

// Lade bekannte Geräte beim Mount
onMounted(() => {
  loadKnownDevices()
})

const scanDevices = async () => {
  await scanForDevices()
}

const connectManually = async () => {
  if (!manualIp.value) return
  const device = await connectToDevice(manualIp.value)
  if (device) {
    alert(`Verbunden mit ${device.deviceName}!`)
  } else {
    alert('Verbindung fehlgeschlagen. Prüfe die IP-Adresse.')
  }
}

const selectDevice = (device: any) => {
  selectedDevice.value = device
}

const startRename = async (device: any) => {
  const newName = prompt(`Neuer Name für ${device.deviceName}:`, device.deviceName)
  if (!newName || newName === device.deviceName) return

  try {
    await renameDevice(device.ip, newName)
    alert(`Gerät umbenannt zu: ${newName}`)
  } catch (error) {
    alert('Umbenennung fehlgeschlagen!')
  }
}

const clearFrames = async () => {
  if (!selectedDevice.value) return
  if (!confirm('Wirklich alle Frames vom Gerät löschen?')) return

  try {
    await clearFramesOnDevice(selectedDevice.value.ip)
    alert('Frames gelöscht!')
    // Aktualisiere Gerätestatus
    await connectToDevice(selectedDevice.value.ip)
  } catch (error) {
    alert('Fehler beim Löschen der Frames')
  }
}
</script>

<style scoped>
.esp8266-setup {
  max-width: 800px;
  margin: 0 auto;
}

.setup-step {
  border-left: 4px solid #3b82f6;
  padding-left: 1rem;
}
</style>
