<script setup lang="ts">
import { ref, watch } from 'vue'
import type { LEDAnimation } from '~/composables/useOpenAI'

const isApiKeyModalOpen = ref(false)
const isESP8266SetupOpen = ref(false)
const isAIPromptModalOpen = ref(false)
const directImageUploadRef = ref<{ openModal: () => void } | null>(null)

// Composables
const { startHealthCheck, stopHealthCheck } = useESP8266()
const matrixEditor = useMatrixEditor()
const frameManager = useFrameManager()
const deviceUpload = useDeviceUpload()
const animationHandlers = useAnimationHandlers(frameManager, matrixEditor, deviceUpload)
const pixelSelection = usePixelSelection()
const frameClipboard = useFrameClipboard()

// Destructure für Template-Zugriff
const { pixels } = matrixEditor
const { currentAnimation, currentFrameIndex, isPlaying } = frameManager
const { selectedDevice, isDeviceOnline } = deviceUpload
const { handleAnimationGenerated, handleImageGenerated, handleDirectImageUpload, handleCroppedImage, initializeEmptyAnimation, resetAll } = animationHandlers
const { selectedPixels, selectedCount, isPixelSelected, selectPixel, startRectSelection, updateRectSelection, endRectSelection, clearSelection, getSelectedCoordinates, getSelectedColors, editorMode, paintColor, isPainting, toggleMode, setPaintColor, startPainting, stopPainting } = pixelSelection
const { copyFrame, pasteFrame, hasClipboard } = frameClipboard

// ESP8266 Status für Anzeige
const esp8266Status = computed(() => selectedDevice.value)

// Initialisiere mit einer leeren Animation (ein Frame)
onMounted(() => {
  initializeEmptyAnimation()
})

// Handler werden aus animationHandlers Composable verwendet

const openDirectImageUpload = () => {
  directImageUploadRef.value?.openModal()
}

// Delete All Frames Handler
const handleDeleteAllFrames = () => {
  // Bestätigung vom User
  if (!confirm('Möchtest du wirklich alle Frames löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) {
    return
  }
  
  // Erstelle neue leere Animation mit einem schwarzen Frame
  const emptyPixels = matrixEditor.createEmptyMatrix()
  matrixEditor.setPixels(emptyPixels)
  
  currentAnimation.value = {
    description: 'Manuelle Animation',
    loop: true,
    frames: [{
      pixels: emptyPixels,
      duration: 1000
    }]
  }
  
  currentFrameIndex.value = 0
  frameManager.stopAnimation()
  clearSelection()
}

// Frame Editor State - Selektion ist immer aktiviert, Modus wird über editorMode gesteuert
const selectionEnabled = ref(true)

// Computed: Farben der selektierten Pixel
const selectedColors = computed(() => {
  return getSelectedColors(pixels.value)
})

// Pixel-Selektion/Paint Event-Handler
const handlePixelClick = (x: number, y: number, shiftKey: boolean) => {
  if (editorMode.value === 'select') {
    selectPixel(x, y, shiftKey)
  } else {
    // Im Paint-Modus: Pixel einfärben
    paintPixel(x, y)
  }
}

const handlePixelMouseDown = (x: number, y: number) => {
  if (editorMode.value === 'select') {
    startRectSelection(x, y)
  } else {
    // Im Paint-Modus: Malen starten
    startPainting()
    paintPixel(x, y)
  }
}

const handlePixelMouseEnter = (x: number, y: number) => {
  if (editorMode.value === 'select') {
    updateRectSelection(x, y)
  } else if (isPainting.value) {
    // Im Paint-Modus: Pixel einfärben während Maus gedrückt
    paintPixel(x, y)
  }
}

const handlePixelMouseUp = () => {
  if (editorMode.value === 'select') {
    endRectSelection()
  } else {
    stopPainting()
  }
}

// Paint-Funktion
const paintPixel = (x: number, y: number) => {
  if (pixels.value[y] && pixels.value[y][x] !== undefined) {
    pixels.value[y][x] = paintColor.value
    
    // Aktualisiere aktuellen Frame in der Animation
    if (currentAnimation.value) {
      currentAnimation.value.frames[currentFrameIndex.value] = {
        pixels: pixels.value,
        duration: currentAnimation.value.frames[currentFrameIndex.value]?.duration || 1000
      }
    }
  }
}

// Color Change Handler
const handleColorChange = (color: string) => {
  if (editorMode.value === 'paint') {
    // Im Paint-Modus: Pinselfarbe ändern
    setPaintColor(color)
  } else {
    // Im Select-Modus: Farbe auf alle selektierten Pixel anwenden
    const coords = getSelectedCoordinates()
    coords.forEach(({ x, y }) => {
      if (pixels.value[y] && pixels.value[y][x] !== undefined) {
        pixels.value[y][x] = color
      }
    })
    
    // Aktualisiere aktuellen Frame in der Animation
    if (currentAnimation.value) {
      currentAnimation.value.frames[currentFrameIndex.value] = {
        pixels: pixels.value,
        duration: currentAnimation.value.frames[currentFrameIndex.value]?.duration || 1000
      }
    }
  }
}

// Frame Copy/Paste Handler
const handleCopyFrame = () => {
  copyFrame(pixels.value)
}

const handlePasteFrame = () => {
  const pastedPixels = pasteFrame()
  if (pastedPixels) {
    matrixEditor.setPixels(pastedPixels)
    
    // Aktualisiere aktuellen Frame in der Animation
    if (currentAnimation.value) {
      currentAnimation.value.frames[currentFrameIndex.value] = {
        pixels: pastedPixels,
        duration: currentAnimation.value.frames[currentFrameIndex.value]?.duration || 1000
      }
    }
  }
}

// Fill All Handler - Färbt alle Pixel in der aktuellen Farbe
const handleFillAll = () => {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const row = pixels.value[y]
      if (row && row[x] !== undefined) {
        row[x] = paintColor.value
      }
    }
  }
  
  // Aktualisiere aktuellen Frame in der Animation
  if (currentAnimation.value) {
    currentAnimation.value.frames[currentFrameIndex.value] = {
      pixels: pixels.value,
      duration: currentAnimation.value.frames[currentFrameIndex.value]?.duration || 1000
    }
  }
}

// Wrapper-Funktionen für Event-Handler mit Pixel-Update
const handleTogglePlayPause = () => {
  frameManager.togglePlayPause((framePixels) => {
    matrixEditor.setPixels(framePixels)
  })
}

const handleGoToFrame = (frameIndex: number) => {
  frameManager.goToFrame(frameIndex, (framePixels) => {
    matrixEditor.setPixels(framePixels)
  })
}

const handleAddFrame = () => {
  frameManager.addFrame((framePixels) => {
    matrixEditor.setPixels(framePixels)
  })
}

const handleDeleteFrame = () => {
  frameManager.deleteFrame((framePixels) => {
    matrixEditor.setPixels(framePixels)
  })
}


// Send current matrix to ESP8266 (via HTTP)
const sendToESP8266 = () => {
  // Frames werden jetzt über HTTP/WiFi gesendet, nicht mehr über Serial
  // Die Funktion bleibt für Kompatibilität, macht aber nichts mehr
  // Frames werden beim "Frames hochladen" Button im ESP8266 Modal gesendet
}

// Upload frames to ESP8266 via network
const uploadFramesToESP = async () => {
  if (!currentAnimation.value) {
    alert('Keine Animation vorhanden!')
    return
  }
  
  await deviceUpload.uploadAnimation(currentAnimation.value)
}

// Watch for manual pixel changes and send to ESP8266
watch(() => pixels.value, () => {
  // Removed sendToESP8266() call
}, { deep: true })

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
  frameManager.stopAnimation()
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
          <LedMatrix
            :pixels="pixels"
            :selection-enabled="selectionEnabled"
            :selected-pixels="selectedPixels"
            @pixel-click="handlePixelClick"
            @pixel-mousedown="handlePixelMouseDown"
            @pixel-mouseenter="handlePixelMouseEnter"
            @pixel-mouseup="handlePixelMouseUp"
          />
        </div>
        
        <!-- Frame Editor Toolbar -->
        <FrameEditorToolbar
          :selected-pixel-count="selectedCount"
          :selected-colors="selectedColors"
          :has-clipboard="hasClipboard()"
          :current-color="paintColor"
          :editor-mode="editorMode"
          @color-change="handleColorChange"
          @copy-frame="handleCopyFrame"
          @paste-frame="handlePasteFrame"
          @clear-selection="clearSelection"
          @toggle-mode="toggleMode"
          @fill-all="handleFillAll"
        />

        <!-- Werkzeugleiste unter der Matrix -->
        <MatrixToolbar
          :current-animation="currentAnimation"
          v-model:current-frame-index="currentFrameIndex"
          :is-playing="isPlaying"
          :selected-device="selectedDevice"
          :is-device-online="isDeviceOnline"
          @delete-all-frames="handleDeleteAllFrames"
          @open-ai-prompt="isAIPromptModalOpen = true"
          @open-image-upload="openDirectImageUpload"
          @delete-frame="handleDeleteFrame"
          @go-to-frame="handleGoToFrame"
          @add-frame="handleAddFrame"
          @toggle-play-pause="handleTogglePlayPause"
          @upload-to-device="uploadFramesToESP"
          @open-device-setup="isESP8266SetupOpen = true"
        />

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
