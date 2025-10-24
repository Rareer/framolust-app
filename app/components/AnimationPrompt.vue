<script setup lang="ts">
import { ref } from 'vue'
import type { LEDAnimation } from '~/composables/useOpenAI'

interface Emits {
  (e: 'animation-generated', animation: LEDAnimation): void
}

const emit = defineEmits<Emits>()

const { apiKey, isLoading, error, generateAnimation } = useOpenAI()

const prompt = ref('')
const lastAnimation = ref<LEDAnimation | null>(null)

const examplePrompts = [
  'Ein pulsierendes Herz in rot',
  'Ein sich drehender Regenbogen-Kreis',
  'Fallende Sterne vom Himmel',
  'Eine Welle die von links nach rechts läuft',
  'Ein blinkender Smiley',
  'Feuerwerk-Explosion in bunten Farben'
]

const useExample = (example: string) => {
  prompt.value = example
}

const handleGenerate = async () => {
  if (!prompt.value.trim()) return
  
  const animation = await generateAnimation(prompt.value)
  
  if (animation) {
    lastAnimation.value = animation
    emit('animation-generated', animation)
  }
}

const hasApiKey = computed(() => !!apiKey.value)
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-heroicons-sparkles" class="w-5 h-5" />
        <h3 class="text-lg font-semibold">AI Animation Generator</h3>
      </div>
    </template>

    <div class="space-y-4">
      <!-- Prompt Input -->
      <div class="space-y-2">
        <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
          Beschreibe deine Animation
        </label>
        <UTextarea
          v-model="prompt"
          placeholder="z.B. Ein pulsierendes Herz in rot..."
          :rows="3"
          :disabled="!hasApiKey || isLoading"
          size="lg"
        />
      </div>

      <!-- Example Prompts -->
      <div class="space-y-2">
        <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
          Beispiele
        </label>
        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="example in examplePrompts"
            :key="example"
            :label="example"
            color="neutral"
            variant="soft"
            size="xs"
            @click="useExample(example)"
            :disabled="!hasApiKey || isLoading"
          />
        </div>
      </div>

      <!-- Generate Button -->
      <UButton
        label="Animation generieren"
        icon="i-heroicons-sparkles"
        color="primary"
        size="lg"
        block
        :loading="isLoading"
        :disabled="!hasApiKey || !prompt.trim() || isLoading"
        @click="handleGenerate"
      />

      <!-- Error Display -->
      <UAlert
        v-if="error"
        icon="i-heroicons-exclamation-triangle"
        color="error"
        variant="subtle"
        :title="error"
      />

      <!-- API Key Warning -->
      <UAlert
        v-if="!hasApiKey"
        icon="i-heroicons-information-circle"
        color="warning"
        variant="subtle"
        title="API Key erforderlich"
        description="Bitte konfiguriere zuerst deinen OpenAI API Key oben."
      />

      <!-- Last Animation Info -->
      <div v-if="lastAnimation" class="pt-4 border-t border-gray-200 dark:border-gray-700">
        <div class="space-y-2">
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-check-circle" class="w-5 h-5 text-green-500" />
            <span class="text-sm font-medium">Animation generiert</span>
          </div>
          <div class="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <p><strong>Beschreibung:</strong> {{ lastAnimation.description }}</p>
            <p><strong>Frames:</strong> {{ lastAnimation.frames.length }}</p>
            <p><strong>Loop:</strong> {{ lastAnimation.loop ? 'Ja' : 'Nein' }}</p>
          </div>
        </div>
      </div>
    </div>
  </UCard>
</template>
