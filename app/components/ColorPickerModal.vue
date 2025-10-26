<script setup lang="ts">
interface Props {
  open: boolean
  currentColor: string
  pixelCount: number
}

interface Emits {
  (e: 'update:open', value: boolean): void
  (e: 'color-selected', color: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const selectedColor = ref(props.currentColor)

// Computed für v-model binding
const isOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value)
})

// Watch für Prop-Änderungen
watch(() => props.currentColor, (newColor) => {
  selectedColor.value = newColor
})

const applyColor = () => {
  emit('color-selected', selectedColor.value)
  emit('update:open', false)
}

const cancel = () => {
  emit('update:open', false)
}
</script>

<template>
  <UModal v-model:open="isOpen">
    <template #header>
      <div class="flex items-center gap-3">
        <div class="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
          <UIcon name="i-heroicons-paint-brush" class="w-6 h-6 text-indigo-400" />
        </div>
        <div>
          <h3 class="text-xl font-bold">Farbe ändern</h3>
          <p class="text-sm text-gray-500 mt-1">{{ pixelCount }} Pixel werden eingefärbt</p>
        </div>
      </div>
    </template>
    
    <template #body>
      <div class="space-y-4 p-6">
        <!-- Color Picker -->
        <div class="flex flex-col gap-3">
          <label class="text-sm font-medium text-gray-300">Farbe wählen</label>
          <input
            v-model="selectedColor"
            type="color"
            class="w-full h-32 rounded-lg cursor-pointer border-2 border-gray-700 bg-gray-800"
          />
          
          <!-- Hex Input -->
          <div class="flex items-center gap-2">
            <input
              v-model="selectedColor"
              type="text"
              placeholder="#000000"
              class="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm font-mono"
            />
            <div
              class="w-10 h-10 rounded border-2 border-gray-700"
              :style="{ backgroundColor: selectedColor }"
            ></div>
          </div>
        </div>
        
        <!-- Preset Colors -->
        <div class="space-y-2">
          <label class="text-sm font-medium text-gray-300">Vordefinierte Farben</label>
          <div class="grid grid-cols-8 gap-2">
            <button
              v-for="color in ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffffff', '#000000', '#ff8800', '#88ff00', '#0088ff', '#8800ff', '#ff0088', '#00ff88', '#888888', '#444444']"
              :key="color"
              @click="selectedColor = color"
              class="w-10 h-10 rounded border-2 transition-all hover:scale-110"
              :class="selectedColor === color ? 'border-indigo-500' : 'border-gray-700'"
              :style="{ backgroundColor: color }"
            ></button>
          </div>
        </div>
      </div>
    </template>
    
    <template #footer>
      <div class="flex justify-end gap-2 p-4 border-t border-gray-800">
        <UButton
          color="neutral"
          variant="soft"
          @click="cancel"
          label="Abbrechen"
        />
        <UButton
          color="primary"
          @click="applyColor"
          label="Anwenden"
        />
      </div>
    </template>
  </UModal>
</template>
