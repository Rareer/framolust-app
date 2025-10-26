<script setup lang="ts">
import { ref, computed } from 'vue'
import type { LEDAnimation } from '~/composables/useOpenAI'

interface Emits {
  (e: 'animation-generated', animation: LEDAnimation): void
  (e: 'image-generated', imageUrl: string): void
}

const emit = defineEmits<Emits>()

const { apiKey, isLoading, error, generateAnimation, generateImageForRasterization } = useOpenAI()

const prompt = ref('')
const isImageModalOpen = ref(false)
const uploadedImageMatrix = ref<string[][] | null>(null)
const imageDescription = ref<string>('')
const generateStaticImage = ref(false)

const handleGenerate = async () => {
  if (!prompt.value.trim()) return
  
  if (generateStaticImage.value) {
    // Generiere ein Bild mit DALL-E
    const imageUrl = await generateImageForRasterization(prompt.value)
    
    if (imageUrl) {
      emit('image-generated', imageUrl)
    }
  } else {
    // Sende Pixel-Matrix direkt an die KI für Animation
    const animation = await generateAnimation(prompt.value, uploadedImageMatrix.value)
    
    if (animation) {
      emit('animation-generated', animation)
    }
  }
}

const handleImageProcessed = (matrix: string[][], description: string) => {
  uploadedImageMatrix.value = matrix
  imageDescription.value = description
}

const clearImage = () => {
  uploadedImageMatrix.value = null
  imageDescription.value = ''
}

const hasApiKey = computed(() => !!apiKey.value)

const placeholderText = computed(() => {
  return generateStaticImage.value
    ? 'Beschreibe dein Bild (z.B. Ein Herz in rot mit hohen Kontrasten)...'
    : 'Beschreibe deine Animation (z.B. Ein pulsierendes Herz in rot)...'
})
</script>

<template>
  <div class="space-y-3">
    <!-- Checkbox für statisches Bild -->
    <div class="flex items-center gap-2 px-3 py-2 bg-gray-800/50 border border-gray-700/50 rounded-lg">
      <UCheckbox
        v-model="generateStaticImage"
        :disabled="!hasApiKey || isLoading"
      />
      <label 
        class="text-sm text-gray-300 cursor-pointer select-none"
        @click="!hasApiKey || isLoading ? null : generateStaticImage = !generateStaticImage"
      >
        Statisches Bild generieren (wird auf 16x16 gerastert)
      </label>
    </div>

    <div class="flex items-center gap-3">
      <UInput
        v-model="prompt"
        :placeholder="placeholderText"
        :disabled="!hasApiKey || isLoading"
        size="lg"
        class="flex-1"
        @keyup.enter="handleGenerate"
      />
      
      <!-- Image Upload Button (nur bei Animation) -->
      <UButton
        v-if="!generateStaticImage"
        icon="i-heroicons-photo"
        :color="uploadedImageMatrix ? 'success' : 'neutral'"
        variant="soft"
        size="lg"
        @click="isImageModalOpen = true"
        :title="uploadedImageMatrix ? 'Bild hochgeladen' : 'Bild hochladen'"
      />
      
      <!-- Generate Button -->
      <UButton
        icon="i-heroicons-sparkles"
        color="primary"
        size="lg"
        :loading="isLoading"
        :disabled="!hasApiKey || !prompt.trim() || isLoading"
        @click="handleGenerate"
        title="Animation generieren"
      />
    </div>

    <!-- Image Badge -->
    <div v-if="uploadedImageMatrix" class="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg">
      <UIcon name="i-heroicons-check-circle" class="w-4 h-4 text-green-400" />
      <span class="text-sm text-green-400">Bild wurde hochgeladen und wird verwendet</span>
      <UButton
        icon="i-heroicons-x-mark"
        color="neutral"
        variant="ghost"
        size="xs"
        @click="clearImage"
        title="Bild entfernen"
      />
    </div>

    <!-- Image Upload Modal -->
    <ImageUploadCropModal
      v-model:open="isImageModalOpen"
      @image-processed="handleImageProcessed"
    />
  </div>
</template>
