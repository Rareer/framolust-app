<script setup lang="ts">
import { ref, watch } from 'vue'
import type { LEDAnimation } from '~/composables/useOpenAI'

const isApiKeyModalOpen = ref(false)
const isESP8266SetupOpen = ref(false)

// ESP8266 Network Integration
const { uploadFramesToDevice, selectedDevice } = useESP8266()

// ESP8266 Status für Anzeige
const esp8266Status = computed(() => selectedDevice.value)

// Debug: Watch selectedDevice changes
watch(selectedDevice, (newDevice) => {
  console.log('🔄 selectedDevice changed:', newDevice)
}, { deep: true })

// Initialize with empty/dark pixels
const pixels = ref<string[][]>(
  Array(16).fill(null).map(() => Array(16).fill('#1a1a1a'))
)

const currentAnimation = ref<LEDAnimation | null>(null)
const currentFrameIndex = ref(0)
const isPlaying = ref(false)
const animationInterval = ref<NodeJS.Timeout | null>(null)

const handleCroppedImage = (imageData: string[][]) => {
  stopAnimation()
  pixels.value = imageData
  sendToESP8266()
}

const resetMatrix = () => {
  stopAnimation()
  pixels.value = Array(16).fill(null).map(() => Array(16).fill('#1a1a1a'))
  sendToESP8266()
}

const handleAnimationGenerated = (animation: LEDAnimation) => {
  // Stoppe alte Animation
  stopAnimation()
  
  // Setze neue Animation
  currentAnimation.value = animation
  currentFrameIndex.value = 0
  
  // Starte neue Animation
  playAnimation()
}

const playAnimation = () => {
  if (!currentAnimation.value || isPlaying.value) return
  
  isPlaying.value = true
  showFrame(0)
}

const stopAnimation = () => {
  isPlaying.value = false
  if (animationInterval.value) {
    clearTimeout(animationInterval.value)
    animationInterval.value = null
  }
}

const showFrame = (frameIndex: number) => {
  if (!currentAnimation.value || !isPlaying.value) return
  
  const frame = currentAnimation.value.frames[frameIndex]
  if (!frame) return
  
  pixels.value = frame.pixels
  currentFrameIndex.value = frameIndex
  sendToESP8266()
  
  // Schedule next frame
  animationInterval.value = setTimeout(() => {
    const nextIndex = (frameIndex + 1) % currentAnimation.value!.frames.length
    
    // Stop if not looping and reached the end
    if (!currentAnimation.value!.loop && nextIndex === 0) {
      isPlaying.value = false
      return
    }
    
    showFrame(nextIndex)
  }, frame.duration)
}

const togglePlayPause = () => {
  if (isPlaying.value) {
    stopAnimation()
  } else {
    playAnimation()
  }
}

// Send current matrix to ESP8266 (via HTTP)
const sendToESP8266 = () => {
  // Frames werden jetzt über HTTP/WiFi gesendet, nicht mehr über Serial
  // Die Funktion bleibt für Kompatibilität, macht aber nichts mehr
  // Frames werden beim "Frames hochladen" Button im ESP8266 Modal gesendet
}

// Watch for manual pixel changes and send to ESP8266
watch(() => pixels.value, () => {
  sendToESP8266()
}, { deep: true })

// Upload frames to ESP8266 via network
const uploadFramesToESP = async (deviceIp: string) => {
  if (!currentAnimation.value) {
    alert('Keine Animation vorhanden!')
    return
  }

  try {
    const { compressAnimation } = useFrameCompression()
    
    // Konvertiere Animation zu Binär-Format
    const animation = {
      description: currentAnimation.value.description || 'Custom Animation',
      loop: currentAnimation.value.loop !== false, // Default: true
      frames: currentAnimation.value.frames.map(frame => ({
        pixels: frame.pixels, // 16x16 Array von Hex-Farben
        duration: frame.duration,
      }))
    }
    
    // Komprimiere zu Binär
    const binaryData = compressAnimation(animation)
    console.log(`📦 Uploading: ${binaryData.length} bytes (binary)`)
    console.log(`📦 Frames: ${animation.frames.length}`)
    
    // Konvertiere zu Blob
    const blob = new Blob([binaryData.buffer as ArrayBuffer], { type: 'application/octet-stream' })

    const response = await fetch(`http://${deviceIp}/frames`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      body: blob,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`HTTP ${response.status}:`, errorText)
      throw new Error(`HTTP ${response.status}`)
    }

    const result = await response.json()
    alert(`✓ Frames erfolgreich hochgeladen!\n${result.frameCount || animation.frames.length} Frames auf ESP8266 gespeichert.`)
  } catch (error) {
    console.error('Upload failed:', error)
    alert('❌ Upload fehlgeschlagen! Prüfe die Verbindung zum ESP8266.')
  }
}

// Cleanup on unmount
onUnmounted(() => {
  stopAnimation()
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black">
    <UContainer class="py-12 max-w-3xl">
      <div class="max-w-4xl mx-auto space-y-10">
        <!-- Header with Cinema Style -->
        <div class="relative">
          <div class="text-center space-y-3">
            <h1 class="text-5xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
              LED Matrix Designer
            </h1>
            <div class="h-1 w-32 mx-auto bg-gradient-to-r from-transparent via-indigo-500 to-transparent rounded-full"></div>
          </div>
          
          <!-- API Key & ESP8266 Setup Buttons - Top Right -->
          <div class="absolute top-0 right-0 flex gap-2">
            <UButton
              icon="i-heroicons-cpu-chip"
              color="success"
              variant="soft"
              size="lg"
              @click="isESP8266SetupOpen = true"
              title="ESP8266 Setup"
            />
            <UButton
              icon="i-heroicons-key"
              color="primary"
              variant="soft"
              size="lg"
              @click="isApiKeyModalOpen = true"
              title="API Key konfigurieren"
            />
          </div>
        </div>

        <!-- LED Matrix Display - Cinema Center Stage -->
        <div class="flex justify-center py-8">
          <LedMatrix :pixels="pixels" />
        </div>

        <!-- ESP8266 Status -->
        <div class="flex justify-center">
          <div v-if="esp8266Status" class="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-lg">
            <div class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span class="text-sm font-medium text-green-400">ESP8266 im Netzwerk: {{ esp8266Status.deviceName }} ({{ esp8266Status.ip }})</span>
          </div>
          <div v-else class="flex items-center gap-2 px-4 py-2 bg-gray-500/10 border border-gray-500/20 rounded-lg">
            <div class="w-2 h-2 bg-gray-400 rounded-full"></div>
            <span class="text-sm font-medium text-gray-400">Kein ESP8266 verbunden - Klicke auf 🖥️ ESP8266 zum Einrichten</span>
          </div>
        </div>

        <!-- Controls: Prompt Input + Animation Controls -->
        <div class="bg-gray-900/50 backdrop-blur-sm rounded-lg p-4 border border-gray-800/50 shadow-xl space-y-3">
          <div class="flex items-center gap-3">
            <AnimationPrompt @animation-generated="handleAnimationGenerated" class="flex-1" />
            <UButton
              v-if="currentAnimation"
              :icon="isPlaying ? 'i-heroicons-pause' : 'i-heroicons-play'"
              color="primary"
              variant="soft"
              size="lg"
              @click="togglePlayPause"
              :title="isPlaying ? 'Pause' : 'Play'"
            />
            <UButton
              icon="i-heroicons-arrow-path"
              color="neutral"
              variant="soft"
              size="lg"
              @click="resetMatrix"
              title="Matrix zurücksetzen"
            />
          </div>
          
          <!-- Send to ESP8266 Button -->
          <div v-if="currentAnimation && selectedDevice" class="flex items-center gap-3 pt-2 border-t border-gray-700/50">
            <div class="flex-1 text-sm text-gray-400">
              <span class="font-medium text-green-400">{{ selectedDevice.deviceName }}</span> bereit
            </div>
            <UButton
              icon="i-heroicons-arrow-up-tray"
              color="success"
              size="lg"
              @click="uploadFramesToESP(selectedDevice.ip)"
              label="An ESP8266 senden"
            />
          </div>
          <div v-else-if="currentAnimation && !selectedDevice" class="flex items-center gap-3 pt-2 border-t border-gray-700/50">
            <div class="flex-1 text-sm text-gray-400">
              Kein ESP8266 verbunden
            </div>
            <UButton
              icon="i-heroicons-cpu-chip"
              color="neutral"
              variant="soft"
              size="lg"
              @click="isESP8266SetupOpen = true"
              label="ESP8266 einrichten"
            />
          </div>
        </div>

        <!-- Arduino Code Generator -->
        <div class="flex justify-center">
          <ArduinoCodeGenerator :animation="currentAnimation" :pixels="pixels" />
        </div>
      </div>
    </UContainer>
    
    <!-- Ambient Light Effect -->
    <div class="fixed inset-0 pointer-events-none">
      <div class="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl"></div>
      <div class="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl"></div>
    </div>

    <!-- API Key Modal -->
    <ApiKeyModal v-model:open="isApiKeyModalOpen" />

    <!-- ESP8266 Setup Modal -->
    <UModal v-model:open="isESP8266SetupOpen">
      <template #body>
        <UCard class="max-w-4xl">
          <template #header>
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-xl font-bold">ESP8266 Setup & Verwaltung</h3>
                <p class="text-sm text-gray-500 mt-1">Firmware flashen oder Geräte verwalten</p>
              </div>
              <UButton
                icon="i-heroicons-x-mark"
                color="neutral"
                variant="ghost"
                @click="isESP8266SetupOpen = false"
              />
            </div>
          </template>
          <ESP8266Setup 
            :current-animation="currentAnimation"
            @upload-frames="uploadFramesToESP" 
          />
        </UCard>
      </template>
    </UModal>
  </div>
</template>
