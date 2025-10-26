<script setup lang="ts">
import type { LEDAnimation } from '~/composables/useOpenAI'

interface Props {
  currentAnimation: LEDAnimation | null
  currentFrameIndex: number
  isPlaying: boolean
  selectedDevice: { deviceName: string; ip: string } | null
  isDeviceOnline: boolean
}

interface Emits {
  (e: 'delete-all-frames'): void
  (e: 'open-ai-prompt'): void
  (e: 'open-image-upload'): void
  (e: 'delete-frame'): void
  (e: 'go-to-frame', frameIndex: number): void
  (e: 'add-frame'): void
  (e: 'toggle-play-pause'): void
  (e: 'upload-to-device'): void
  (e: 'open-device-setup'): void
  (e: 'update:currentFrameIndex', value: number): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Local model for v-model on slider
const localFrameIndex = computed({
  get: () => props.currentFrameIndex,
  set: (value: number) => {
    emit('update:currentFrameIndex', value)
    emit('go-to-frame', value)
  }
})
</script>

<template>
  <div class="flex justify-center">
    <div class="flex items-center gap-2 bg-gray-900/50 backdrop-blur-sm rounded-lg p-3 border border-gray-800/50 shadow-xl">
      <!-- Delete All Frames Button -->
      <UButton
        icon="i-heroicons-trash"
        color="error"
        variant="soft"
        size="lg"
        @click="emit('delete-all-frames')"
        title="Alle Frames löschen"
      />
      
      <!-- Divider -->
      <div class="h-8 w-px bg-gray-700"></div>
      
      <!-- AI Prompt Button -->
      <UButton
        icon="i-heroicons-sparkles"
        color="primary"
        variant="soft"
        size="lg"
        @click="emit('open-ai-prompt')"
        title="AI Animation/Bild generieren"
      />
      
      <!-- Bild Upload Button -->
      <UButton
        icon="i-heroicons-arrow-up-tray"
        color="primary"
        variant="soft"
        size="lg"
        @click="emit('open-image-upload')"
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
          @click="emit('delete-frame')"
          title="Frame löschen"
          :disabled="currentAnimation.frames.length <= 1"
        />
        
        <!-- Frame Slider & Info -->
        <div class="flex items-center gap-2 px-2">
          <span class="text-xs text-gray-400 whitespace-nowrap">
            {{ currentFrameIndex + 1 }}/{{ currentAnimation.frames.length }}
          </span>
          <input
            v-model.number="localFrameIndex"
            type="range"
            :min="0"
            :max="currentAnimation.frames.length - 1"
            class="w-32 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
        </div>
        
        <!-- Add Frame -->
        <UButton
          icon="i-heroicons-plus"
          color="neutral"
          variant="soft"
          size="sm"
          @click="emit('add-frame')"
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
          @click="emit('toggle-play-pause')"
          :title="isPlaying ? 'Pause' : 'Play'"
        />
      </template>
      
      <!-- Divider -->
      <div class="h-8 w-px bg-gray-700"></div>
      
      <!-- Upload to ESP8266 Button -->
      <UButton
        v-if="selectedDevice && isDeviceOnline"
        icon="i-heroicons-arrow-up-tray"
        color="success"
        size="lg"
        @click="emit('upload-to-device')"
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
        @click="emit('open-device-setup')"
        title="ESP8266 einrichten"
      />
    </div>
  </div>
</template>
