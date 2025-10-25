<script setup lang="ts">
import { ref, watch } from 'vue'
import type { LEDAnimation } from '~/composables/useOpenAI'

const isApiKeyModalOpen = ref(false)

// Serial Port for ESP8266
const { isConnected: isSerialConnected, sendLEDMatrix } = useSerialPort()

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
  currentAnimation.value = animation
  currentFrameIndex.value = 0
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

// Send current matrix to ESP8266
const sendToESP8266 = () => {
  if (isSerialConnected.value) {
    sendLEDMatrix(pixels.value)
  }
}

// Watch for manual pixel changes and send to ESP8266
watch(() => pixels.value, () => {
  sendToESP8266()
}, { deep: true })

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
          
          <!-- API Key Button - Top Right -->
          <div class="absolute top-0 right-0">
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

        <!-- ESP8266 Connection -->
        <div class="flex justify-center">
          <SerialConnection />
        </div>

        <!-- Controls: Prompt Input + Animation Controls -->
        <div class="bg-gray-900/50 backdrop-blur-sm rounded-lg p-4 border border-gray-800/50 shadow-xl">
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
  </div>
</template>
