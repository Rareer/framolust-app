<script setup lang="ts">
import { ref, watch } from 'vue'
import type { LEDAnimation } from '~/composables/useOpenAI'

const isApiKeyModalOpen = ref(false)
const isESP8266SetupOpen = ref(false)
const isAIPromptModalOpen = ref(false)
const directImageUploadRef = ref<{ openModal: () => void } | null>(null)

// ESP8266 Network Integration
const { uploadFramesToDevice, selectedDevice, isDeviceOnline, startHealthCheck, stopHealthCheck } = useESP8266()

// Matrix Transformation
const { transformForPhysicalMatrix } = useMatrixTransform()

// Frame Manager
const {
  currentAnimation,
  currentFrameIndex,
  isPlaying,
  playAnimation,
  stopAnimation,
  togglePlayPause,
  goToFrame,
  addFrame,
  deleteFrame,
  setAnimation,
  resetAnimation
} = useFrameManager()

// ESP8266 Status für Anzeige
const esp8266Status = computed(() => selectedDevice.value)

// Initialize with empty/dark pixels
const pixels = ref<string[][]>(
  Array(16).fill(null).map(() => Array(16).fill('#1a1a1a'))
)

// Initialisiere mit einer leeren Animation (ein Frame)
onMounted(() => {
  if (!currentAnimation.value) {
    currentAnimation.value = {
      description: 'Manuelle Animation',
      loop: true,
      frames: [{
        pixels: pixels.value,
        duration: 1000
      }]
    }
  }
})

const handleCroppedImage = (imageData: string[][]) => {
  stopAnimation()
  pixels.value = imageData
  sendToESP8266()
}

const handleDirectImageUpload = async (matrix: string[][]) => {
  // Stoppe Animation und aktualisiere aktuellen Frame
  stopAnimation()
  pixels.value = matrix
  
  // Aktualisiere aktuellen Frame in der Animation
  if (currentAnimation.value) {
    currentAnimation.value.frames[currentFrameIndex.value] = {
      pixels: matrix,
      duration: currentAnimation.value.frames[currentFrameIndex.value]?.duration || 1000
    }
  }
  
  // Wenn ESP8266 verbunden und online, direkt hochladen
  if (selectedDevice.value && isDeviceOnline.value) {
    try {
      // Transformiere Matrix für physische LED-Anordnung
      const transformedMatrix = transformForPhysicalMatrix(matrix)
      
      // Erstelle ein einzelnes Frame aus der transformierten Matrix
      const frames = [{
        pixels: transformedMatrix,
        duration: 1000
      }]
      
      await uploadFramesToDevice(selectedDevice.value.ip, frames)
      alert('✅ Bild erfolgreich auf ESP8266 geladen!')
    } catch (error) {
      console.error('Upload failed:', error)
      alert('❌ Upload fehlgeschlagen! Prüfe die Verbindung zum ESP8266.')
    }
  } else if (selectedDevice.value && !isDeviceOnline.value) {
    alert('⚠️ ESP8266 ist nicht erreichbar. Bild wurde nur lokal geladen.')
  } else {
    alert('ℹ️ Kein ESP8266 verbunden. Bild wurde nur lokal geladen.')
  }
}

const openDirectImageUpload = () => {
  directImageUploadRef.value?.openModal()
}

const resetMatrix = () => {
  // Reset zur initialen leeren Animation
  const emptyPixels = Array(16).fill(null).map(() => Array(16).fill('#1a1a1a'))
  pixels.value = emptyPixels
  
  currentAnimation.value = {
    description: 'Manuelle Animation',
    loop: true,
    frames: [{
      pixels: emptyPixels,
      duration: 1000
    }]
  }
  
  currentFrameIndex.value = 0
  stopAnimation()
  sendToESP8266()
}

// Wrapper-Funktionen für Event-Handler
const handleTogglePlayPause = () => {
  togglePlayPause((framePixels) => {
    pixels.value = framePixels
  })
}

const handleGoToFrame = (frameIndex: number) => {
  goToFrame(frameIndex, (framePixels) => {
    pixels.value = framePixels
  })
}

const handleAddFrame = () => {
  addFrame((framePixels) => {
    pixels.value = framePixels
  })
}

const handleDeleteFrame = () => {
  deleteFrame((framePixels) => {
    pixels.value = framePixels
  })
}

const handleAnimationGenerated = (animation: LEDAnimation) => {
  // AI-Generierung ersetzt vorhandene Frames komplett
  setAnimation(animation, (framePixels) => {
    pixels.value = framePixels
  })
  
  // Starte Animation automatisch
  playAnimation((framePixels) => {
    pixels.value = framePixels
  })
}

const handleImageGenerated = async (imageUrl: string) => {
  // Stoppe alte Animation
  resetAnimation()
  
  try {
    // Lade das Bild und rastere es auf 16x16
    const { quantizeImage } = useImageQuantizer()
    
    // Konvertiere die URL zu einem verwendbaren Format
    const response = await fetch(imageUrl)
    const blob = await response.blob()
    const reader = new FileReader()
    
    reader.onload = async (e) => {
      const imageData = e.target?.result as string
      const matrix = await quantizeImage(imageData)
      
      if (matrix) {
        pixels.value = matrix
        
        // Wenn ESP8266 verbunden und online, direkt hochladen
        if (selectedDevice.value && isDeviceOnline.value) {
          try {
            // Transformiere Matrix für physische LED-Anordnung
            const transformedMatrix = transformForPhysicalMatrix(matrix)
            
            const frames = [{
              pixels: transformedMatrix,
              duration: 1000
            }]
            
            await uploadFramesToDevice(selectedDevice.value.ip, frames)
            console.log('✅ AI-generiertes Bild erfolgreich auf ESP8266 geladen!')
          } catch (error) {
            console.error('Upload failed:', error)
          }
        }
      }
    }
    
    reader.readAsDataURL(blob)
  } catch (error) {
    console.error('Fehler beim Rastern des Bildes:', error)
    alert('Fehler beim Verarbeiten des generierten Bildes')
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
    
    // Konvertiere Animation zu Binär-Format mit Transformation
    const animation = {
      description: currentAnimation.value.description || 'Custom Animation',
      loop: currentAnimation.value.loop !== false, // Default: true
      frames: currentAnimation.value.frames.map(frame => ({
        pixels: transformForPhysicalMatrix(frame.pixels), // Transformiere für physische Matrix
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

// Starte Health-Check wenn ein Gerät ausgewählt ist
onMounted(() => {
  if (selectedDevice.value) {
    startHealthCheck()
  }
})

// Watch für Änderungen am selectedDevice
watch(selectedDevice, (newDevice) => {
  console.log('🔄 selectedDevice changed:', newDevice)
  if (newDevice) {
    startHealthCheck()
  } else {
    stopHealthCheck()
  }
}, { deep: true })

// Cleanup on unmount
onUnmounted(() => {
  stopAnimation()
  stopHealthCheck()
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black">
    <UContainer class="py-12 max-w-6xl">
      <div class="max-w-6xl mx-auto space-y-10">
        <!-- Header with Cinema Style -->
        <div class="relative">
          <div class="text-center space-y-3">
            <h1 class="text-5xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
              LED Matrix Designer
            </h1>
            <div class="h-1 w-32 mx-auto bg-gradient-to-r from-transparent via-indigo-500 to-transparent rounded-full"></div>
          </div>
          
          <!-- Status & Settings - Top Right -->
          <div class="absolute top-0 right-0 flex items-center gap-3">
            <!-- Online Status Indicator -->
            <div v-if="esp8266Status && isDeviceOnline" class="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg" :title="`${esp8266Status.deviceName} (${esp8266Status.ip})`">
              <div class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <UIcon name="i-heroicons-wifi" class="w-5 h-5 text-green-400" />
            </div>
            <div v-else-if="esp8266Status && !isDeviceOnline" class="flex items-center gap-2 px-3 py-2 bg-orange-500/10 border border-orange-500/20 rounded-lg" :title="`${esp8266Status.deviceName} nicht erreichbar`">
              <div class="w-2 h-2 bg-orange-400 rounded-full"></div>
              <UIcon name="i-heroicons-wifi" class="w-5 h-5 text-orange-400" />
            </div>
            <div v-else class="flex items-center gap-2 px-3 py-2 bg-gray-500/10 border border-gray-500/20 rounded-lg" title="Kein Gerät verbunden">
              <UIcon name="i-heroicons-wifi" class="w-5 h-5 text-gray-400" />
            </div>
            
            <!-- Settings Buttons -->
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

        <!-- Werkzeugleiste unter der Matrix -->
        <div class="flex justify-center">
          <div class="flex items-center gap-2 bg-gray-900/50 backdrop-blur-sm rounded-lg p-3 border border-gray-800/50 shadow-xl">
            <!-- AI Prompt Button -->
            <UButton
              icon="i-heroicons-sparkles"
              color="primary"
              variant="soft"
              size="lg"
              @click="isAIPromptModalOpen = true"
              title="AI Animation/Bild generieren"
            />
            
            <!-- Bild Upload Button -->
            <UButton
              icon="i-heroicons-arrow-up-tray"
              color="primary"
              variant="soft"
              size="lg"
              @click="openDirectImageUpload"
              title="Bild hochladen"
            />
            
            <!-- Divider -->
            <div class="h-8 w-px bg-gray-700"></div>
            
            <!-- Frame Management (immer sichtbar) -->
            <template v-if="currentAnimation">
              <!-- Delete Frame -->
              <UButton
                icon="i-heroicons-minus"
                color="neutral"
                variant="soft"
                size="sm"
                @click="handleDeleteFrame"
                title="Frame löschen"
                :disabled="currentAnimation.frames.length <= 1"
              />
              
              <!-- Frame Slider & Info -->
              <div class="flex items-center gap-2 px-2">
                <span class="text-xs text-gray-400 whitespace-nowrap">{{ currentFrameIndex + 1 }}/{{ currentAnimation.frames.length }}</span>
                <input
                  v-model.number="currentFrameIndex"
                  type="range"
                  :min="0"
                  :max="currentAnimation.frames.length - 1"
                  class="w-32 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  @input="handleGoToFrame(currentFrameIndex)"
                />
              </div>
              
              <!-- Add Frame -->
              <UButton
                icon="i-heroicons-plus"
                color="neutral"
                variant="soft"
                size="sm"
                @click="handleAddFrame"
                title="Frame hinzufügen"
              />
              
              <!-- Divider -->
              <div class="h-8 w-px bg-gray-700"></div>
              
              <!-- Play/Pause Button -->
              <UButton
                :icon="isPlaying ? 'i-heroicons-pause' : 'i-heroicons-play'"
                color="primary"
                variant="soft"
                size="lg"
                @click="handleTogglePlayPause"
                :title="isPlaying ? 'Pause' : 'Play'"
              />
            </template>
            
            <!-- Reset Button -->
            <UButton
              icon="i-heroicons-arrow-path"
              color="neutral"
              variant="soft"
              size="lg"
              @click="resetMatrix"
              title="Matrix zurücksetzen"
            />
            
            <!-- Divider -->
            <div class="h-8 w-px bg-gray-700"></div>
            
            <!-- Upload to ESP8266 Button -->
            <UButton
              v-if="selectedDevice && isDeviceOnline"
              icon="i-heroicons-arrow-up-tray"
              color="success"
              size="lg"
              @click="uploadFramesToESP(selectedDevice.ip)"
              title="An ESP8266 senden"
            />
            <UButton
              v-else-if="selectedDevice && !isDeviceOnline"
              icon="i-heroicons-arrow-up-tray"
              color="neutral"
              size="lg"
              disabled
              title="Gerät offline"
            />
            <UButton
              v-else
              icon="i-heroicons-cpu-chip"
              color="neutral"
              variant="soft"
              size="lg"
              @click="isESP8266SetupOpen = true"
              title="ESP8266 einrichten"
            />
          </div>
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

    <!-- Direct Image Upload Modal -->
    <DirectImageUpload 
      ref="directImageUploadRef"
      @image-uploaded="handleDirectImageUpload"
    />

    <!-- AI Prompt Modal -->
    <UModal v-model:open="isAIPromptModalOpen">
      <template #header>
        <div class="flex items-center gap-3">
          <div class="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
            <UIcon name="i-heroicons-sparkles" class="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h3 class="text-xl font-bold">AI Animation/Bild generieren</h3>
            <p class="text-sm text-gray-500 mt-1">Erstelle Animationen oder Bilder mit KI</p>
          </div>
        </div>
      </template>
      
      <template #body>
        <div class="space-y-4">
          <AnimationPrompt 
            @animation-generated="handleAnimationGenerated; isAIPromptModalOpen = false" 
            @image-generated="handleImageGenerated; isAIPromptModalOpen = false"
          />
        </div>
      </template>
    </UModal>

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
