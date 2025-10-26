<script setup lang="ts">
interface Props {
  colors: string[]
  disabled?: boolean
}

interface Emits {
  (e: 'click'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Computed: Zeigt an ob mehrere Farben selektiert sind
const hasMultipleColors = computed(() => props.colors.length > 1)

// Computed: Primäre Farbe (erste Farbe oder schwarz wenn keine)
const primaryColor = computed(() => props.colors[0] || '#000000')
</script>

<template>
  <button
    @click="emit('click')"
    :disabled="disabled"
    class="relative w-10 h-10 rounded border-2 transition-all"
    :class="[
      disabled ? 'border-gray-700 cursor-not-allowed opacity-50' : 'border-gray-600 hover:border-indigo-500 cursor-pointer',
      hasMultipleColors ? 'ring-2 ring-orange-500/50' : ''
    ]"
    :title="hasMultipleColors ? `${colors.length} verschiedene Farben` : 'Farbe ändern'"
  >
    <!-- Hauptfarbe -->
    <div
      class="absolute inset-0 rounded"
      :style="{ backgroundColor: primaryColor }"
    ></div>
    
    <!-- Mehrfarbiger Indikator -->
    <div
      v-if="hasMultipleColors"
      class="absolute inset-0 rounded overflow-hidden"
    >
      <div class="flex h-full">
        <div
          v-for="(color, index) in colors.slice(0, 4)"
          :key="index"
          class="flex-1"
          :style="{ backgroundColor: color }"
        ></div>
      </div>
    </div>
    
    <!-- Icon für Farbauswahl -->
    <div class="absolute inset-0 flex items-center justify-center">
      <UIcon
        v-if="!disabled"
        name="i-heroicons-pencil"
        class="w-4 h-4 text-white drop-shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
      />
    </div>
  </button>
</template>
