<script setup lang="ts">
interface Props {
  selectedPixelCount: number
  selectedColors: string[]
  hasClipboard: boolean
  currentColor: string
  editorMode: 'select' | 'paint'
}

interface Emits {
  (e: 'color-change', color: string): void
  (e: 'copy-frame'): void
  (e: 'paste-frame'): void
  (e: 'clear-selection'): void
  (e: 'toggle-mode'): void
  (e: 'fill-all'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const handleColorChange = (color: string | undefined) => {
  if (color) {
    emit('color-change', color)
  }
}
</script>

<template>
  <div class="flex justify-center">
    <div class="flex items-center gap-3 bg-gray-900/50 backdrop-blur-sm rounded-lg p-3 border border-gray-800/50 shadow-xl">
      <!-- Mode Toggle -->
      <UButton
        :icon="editorMode === 'select' ? 'i-heroicons-cursor-arrow-rays' : 'i-heroicons-paint-brush'"
        :color="editorMode === 'select' ? 'primary' : 'success'"
        variant="soft"
        size="lg"
        @click="emit('toggle-mode')"
        :title="editorMode === 'select' ? 'Select-Modus (Pixel auswählen)' : 'Paint-Modus (Pixel einfärben)'"
      />
      
      <!-- Divider -->
      <div class="h-8 w-px bg-gray-700"></div>
      
      <!-- Color Display Button with Popover -->
      <UPopover :disabled="editorMode === 'select' && selectedPixelCount === 0">
        <button
          :disabled="editorMode === 'select' && selectedPixelCount === 0"
          class="relative w-10 h-10 rounded border-2 transition-all"
          :class="[
            editorMode === 'select' && selectedPixelCount === 0 ? 'border-gray-700 cursor-not-allowed opacity-50' : 'border-gray-600 hover:border-indigo-500 cursor-pointer hover:scale-110',
            selectedColors.length > 1 ? 'ring-2 ring-orange-500/50' : ''
          ]"
          :title="editorMode === 'paint' ? 'Pinselfarbe ändern' : selectedColors.length > 1 ? `${selectedColors.length} verschiedene Farben` : 'Farbe ändern'"
        >
          <!-- Hauptfarbe -->
          <div
            class="absolute inset-0 rounded"
            :style="{ backgroundColor: editorMode === 'paint' ? currentColor : (selectedColors[0] || currentColor) }"
          ></div>
          
          <!-- Mehrfarbiger Indikator (nur im Select-Modus) -->
          <div
            v-if="editorMode === 'select' && selectedColors.length > 1"
            class="absolute inset-0 rounded overflow-hidden"
          >
            <div class="flex h-full">
              <div
                v-for="(color, index) in selectedColors.slice(0, 4)"
                :key="index"
                class="flex-1"
                :style="{ backgroundColor: color }"
              ></div>
            </div>
          </div>
          
          <!-- Paint Brush Icon im Paint-Modus -->
          <div v-if="editorMode === 'paint'" class="absolute inset-0 flex items-center justify-center">
            <UIcon
              name="i-heroicons-paint-brush"
              class="w-4 h-4 text-white drop-shadow-lg"
            />
          </div>
        </button>
        
        <template #content>
          <div class="p-4">
            <UColorPicker
              :model-value="currentColor"
              @update:model-value="handleColorChange"
            />
          </div>
        </template>
      </UPopover>
      
      <!-- Fill All Button -->
      <UButton
        icon="i-heroicons-squares-2x2"
        color="primary"
        variant="soft"
        size="sm"
        @click="emit('fill-all')"
        title="Alle Pixel einfärben"
      />
      
      <!-- Clear Selection (nur im Select-Modus) -->
      <UButton
        v-if="editorMode === 'select'"
        icon="i-heroicons-x-mark"
        color="neutral"
        variant="soft"
        size="sm"
        @click="emit('clear-selection')"
        :disabled="selectedPixelCount === 0"
        title="Auswahl aufheben"
      />
      
      <!-- Divider -->
      <div class="h-8 w-px bg-gray-700"></div>
      
      <!-- Copy Frame -->
      <UButton
        icon="i-heroicons-clipboard-document"
        color="neutral"
        variant="soft"
        size="sm"
        @click="emit('copy-frame')"
        title="Frame kopieren"
      />
      
      <!-- Paste Frame -->
      <UButton
        icon="i-heroicons-clipboard-document-check"
        color="neutral"
        variant="soft"
        size="sm"
        @click="emit('paste-frame')"
        :disabled="!hasClipboard"
        title="Frame einfügen"
      />
    </div>
  </div>
</template>
