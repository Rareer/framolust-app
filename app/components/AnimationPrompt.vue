<script setup lang="ts">
import { ref } from 'vue'
import type { LEDAnimation } from '~/composables/useOpenAI'

interface Emits {
  (e: 'animation-generated', animation: LEDAnimation): void
}

const emit = defineEmits<Emits>()

const { apiKey, isLoading, error, generateAnimation } = useOpenAI()

const prompt = ref('')

const handleGenerate = async () => {
  if (!prompt.value.trim()) return
  
  const animation = await generateAnimation(prompt.value)
  
  if (animation) {
    emit('animation-generated', animation)
  }
}

const hasApiKey = computed(() => !!apiKey.value)
</script>

<template>
  <div class="flex items-center gap-2">
    <UInput
      v-model="prompt"
      placeholder="Beschreibe deine Animation (z.B. Ein pulsierendes Herz in rot)..."
      :disabled="!hasApiKey || isLoading"
      class="flex-1"
      @keyup.enter="handleGenerate"
    />
    <UButton
      icon="i-heroicons-sparkles"
      color="primary"
      :loading="isLoading"
      :disabled="!hasApiKey || !prompt.trim() || isLoading"
      @click="handleGenerate"
      title="Animation generieren"
    />
  </div>
</template>
