<script setup lang="ts">
import { ref, computed } from 'vue'
import type { LEDAnimation } from '~/composables/useOpenAI'

interface Props {
  animation: LEDAnimation | null
  pixels: string[][]
}

const props = defineProps<Props>()

const { 
  generatedCode, 
  isGenerating, 
  generateCode, 
  downloadCode, 
  copyToClipboard,
  getCodeStats 
} = useArduinoCodeGenerator()

const isModalOpen = ref(false)
const copySuccess = ref(false)

const handleGenerate = () => {
  generateCode(props.animation, props.pixels)
  isModalOpen.value = true
}

const handleCopy = async () => {
  const success = await copyToClipboard()
  if (success) {
    copySuccess.value = true
    setTimeout(() => {
      copySuccess.value = false
    }, 2000)
  }
}

const handleDownload = () => {
  const filename = props.animation 
    ? `${props.animation.description.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ino`
    : 'esp8266_matrix.ino'
  downloadCode(filename)
}

const codeStats = computed(() => getCodeStats())
const hasAnimation = computed(() => props.animation !== null)
</script>

<template>
  <div>
    <!-- Generate Button -->
    <div class="flex items-center gap-3">
      <UButton
        icon="i-heroicons-code-bracket"
        label="Arduino Code generieren"
        color="secondary"
        variant="soft"
        size="lg"
        :loading="isGenerating"
        @click="handleGenerate"
      />
      
      <div v-if="hasAnimation" class="flex items-center gap-2 text-sm text-gray-400">
        <UIcon name="i-heroicons-film" class="w-4 h-4" />
        <span>{{ animation?.frames.length }} Frames</span>
      </div>
    </div>

    <!-- Code Modal -->
    <UModal 
      v-model:open="isModalOpen"
      :ui="{
        wrapper: 'bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl ring-1 ring-gray-800/50 max-w-6xl',
        overlay: 'backdrop-blur-sm'
      }"
    >
      <template #header>
        <div class="flex items-center justify-between gap-3 w-full">
          <div class="flex items-center gap-3">
            <div class="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
              <UIcon name="i-heroicons-code-bracket" class="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h2 class="text-2xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
                Arduino Code
              </h2>
              <p class="text-sm text-gray-400">ESP8266 NeoPixel Matrix</p>
            </div>
          </div>
          <UButton
            icon="i-heroicons-x-mark"
            color="neutral"
            variant="ghost"
            size="lg"
            @click="isModalOpen = false"
            title="Schließen"
          />
        </div>
      </template>

      <template #body>
        <div class="p-6 space-y-4 bg-gray-900 rounded-2xl max-h-[70vh] overflow-y-auto">
      <!-- Stats and Actions -->
      <div class="flex items-center justify-between p-3 bg-gray-900/50 backdrop-blur-sm rounded-lg border border-gray-800/50">
        <div class="flex items-center gap-4 text-sm text-gray-400">
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-document-text" class="w-4 h-4" />
            <span>{{ codeStats.lines }} Zeilen</span>
          </div>
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-circle-stack" class="w-4 h-4" />
            <span>{{ codeStats.size }}</span>
          </div>
        </div>
        
        <div class="flex items-center gap-2">
          <UButton
            :icon="copySuccess ? 'i-heroicons-check' : 'i-heroicons-clipboard'"
            :label="copySuccess ? 'Kopiert!' : 'Kopieren'"
            :color="copySuccess ? 'success' : 'neutral'"
            variant="soft"
            size="sm"
            @click="handleCopy"
          />
          <UButton
            icon="i-heroicons-arrow-down-tray"
            label="Download .ino"
            color="primary"
            variant="soft"
            size="sm"
            @click="handleDownload"
          />
        </div>
      </div>

      <!-- Code Preview -->
      <div class="relative">
        <div class="absolute top-3 right-3 z-10">
          <UBadge color="secondary" variant="subtle">
            Arduino C++
          </UBadge>
        </div>
        <pre class="bg-gray-950 border border-gray-800 rounded-lg p-4 overflow-x-auto text-xs leading-relaxed"><code class="text-gray-300">{{ generatedCode }}</code></pre>
      </div>

      <!-- Info Alert -->
      <div class="bg-indigo-500/5 border border-indigo-500/20 rounded-lg p-4">
        <div class="flex gap-3">
          <UIcon name="i-heroicons-information-circle" class="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
          <div class="space-y-2 text-sm">
            <p class="font-medium text-indigo-300">So verwendest du den Code:</p>
            <ol class="text-gray-400 space-y-1 list-decimal list-inside">
              <li>Öffne die Arduino IDE</li>
              <li>Installiere die "Adafruit NeoPixel" Bibliothek</li>
              <li>Kopiere den Code oder lade die .ino Datei herunter</li>
              <li>Wähle dein ESP8266 Board aus (z.B. "NodeMCU 1.0")</li>
              <li>Verbinde die NeoPixel Matrix mit Pin D2 (GPIO4)</li>
              <li>Lade den Code auf deinen ESP8266 hoch</li>
            </ol>
          </div>
        </div>
      </div>

          <!-- Warning for large animations -->
          <UAlert
            v-if="codeStats.sizeBytes > 100000"
            icon="i-heroicons-exclamation-triangle"
            color="warning"
            variant="subtle"
            title="Große Animation"
            description="Diese Animation ist sehr groß. Stelle sicher, dass dein ESP8266 genug Speicher hat (empfohlen: ESP8266 mit 4MB Flash)."
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
