<script setup lang="ts">
import { ref } from 'vue'
import type { LEDAnimation } from '~/composables/useOpenAI'

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
}

const resetMatrix = () => {
  stopAnimation()
  pixels.value = Array(16).fill(null).map(() => Array(16).fill('#1a1a1a'))
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

// Cleanup on unmount
onUnmounted(() => {
  stopAnimation()
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
    <UContainer class="py-8">
      <div class="space-y-8">
        <!-- Header -->
        <div class="text-center space-y-2">
          <h1 class="text-4xl font-bold text-gray-900 dark:text-white">
            LED Matrix Designer
          </h1>
          <p class="text-gray-600 dark:text-gray-400">
            Erstelle LED-Matrix-Animationen mit KI
          </p>
        </div>

        <!-- API Key Configuration -->
        <ApiKeyInput />

        <!-- Main Content Grid -->
        <div class="grid lg:grid-cols-2 gap-8">
          <!-- Left Column: AI Generator -->
          <div class="space-y-6">
            <AnimationPrompt @animation-generated="handleAnimationGenerated" />
          </div>

          <!-- Right Column: LED Matrix Display -->
          <div class="space-y-6">
            <UCard>
              <template #header>
                <div class="flex items-center justify-between">
                  <h3 class="text-lg font-semibold">16x16 LED Matrix</h3>
                  <div class="flex gap-2">
                    <UButton
                      v-if="currentAnimation"
                      :icon="isPlaying ? 'i-heroicons-pause' : 'i-heroicons-play'"
                      :color="isPlaying ? 'warning' : 'success'"
                      variant="soft"
                      @click="togglePlayPause"
                      :title="isPlaying ? 'Pause' : 'Play'"
                    />
                    <UButton
                      icon="i-heroicons-arrow-path"
                      color="neutral"
                      variant="ghost"
                      @click="resetMatrix"
                      title="Matrix zurücksetzen"
                    />
                  </div>
                </div>
              </template>

              <div class="flex justify-center">
                <LedMatrix :pixels="pixels" :size="20" />
              </div>

              <template #footer>
                <div class="text-center text-sm text-gray-500 dark:text-gray-400 space-y-1">
                  <p>Pixel-Größe: 16x16</p>
                  <p v-if="currentAnimation && isPlaying">
                    Frame {{ currentFrameIndex + 1 }} / {{ currentAnimation.frames.length }}
                  </p>
                </div>
              </template>
            </UCard>
          </div>
        </div>

        <!-- Info Section -->
        <UCard>
          <div class="prose dark:prose-invert max-w-none">
            <h3>Anleitung</h3>
            <ol>
              <li>Konfiguriere deinen OpenAI API Key (wird lokal gespeichert)</li>
              <li>Beschreibe die gewünschte Animation im Textfeld</li>
              <li>Klicke auf "Animation generieren" und warte auf das Ergebnis</li>
              <li>Die Animation wird automatisch auf der LED-Matrix abgespielt</li>
              <li>Nutze Play/Pause um die Animation zu steuern</li>
            </ol>
          </div>
        </UCard>
      </div>
    </UContainer>
  </div>
</template>
