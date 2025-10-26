<script setup lang="ts">
interface Props {
  pixels: string[][]
  showGrid?: boolean
  selectedPixels?: Set<string>
  selectionEnabled?: boolean
}

interface Emits {
  (e: 'pixel-click', x: number, y: number, shiftKey: boolean): void
  (e: 'pixel-mousedown', x: number, y: number): void
  (e: 'pixel-mouseenter', x: number, y: number): void
  (e: 'pixel-mouseup'): void
}

const props = withDefaults(defineProps<Props>(), {
  showGrid: true,
  selectionEnabled: false
})

const emit = defineEmits<Emits>()

// Konvertiert flachen Index zu x,y Koordinaten
const indexToCoord = (index: number) => {
  const x = index % 16
  const y = Math.floor(index / 16)
  return { x, y }
}

// Prüft ob ein Pixel selektiert ist
const isPixelSelected = (index: number): boolean => {
  if (!props.selectedPixels || !props.selectionEnabled) return false
  const { x, y } = indexToCoord(index)
  return props.selectedPixels.has(`${x},${y}`)
}

// Mouse-Event-Handler
const handlePixelClick = (index: number, event: MouseEvent) => {
  if (!props.selectionEnabled) return
  const { x, y } = indexToCoord(index)
  emit('pixel-click', x, y, event.shiftKey)
}

const handlePixelMouseDown = (index: number) => {
  if (!props.selectionEnabled) return
  const { x, y } = indexToCoord(index)
  emit('pixel-mousedown', x, y)
}

const handlePixelMouseEnter = (index: number) => {
  if (!props.selectionEnabled) return
  const { x, y } = indexToCoord(index)
  emit('pixel-mouseenter', x, y)
}
</script>

<template>
  <div class="w-full max-w-[600px] aspect-square p-3 md:p-6 rounded-2xl relative border-4 md:border-8 led-matrix-wrapper">
    <div 
      class="w-full h-full grid grid-cols-16 grid-rows-16 gap-0.5"
      :class="{ 'gap-0': !showGrid }"
      @mouseleave="emit('pixel-mouseup')"
    >
      <div
        v-for="(color, index) in pixels.flat()"
        :key="index"
        class="w-full h-full rounded-sm transition-all duration-200 led-pixel"
        :class="{
          'selected': isPixelSelected(index),
          'selectable cursor-pointer': selectionEnabled,
          'rounded-none': !showGrid
        }"
        :style="{ backgroundColor: color }"
        @click="handlePixelClick(index, $event)"
        @mousedown="handlePixelMouseDown(index)"
        @mouseenter="handlePixelMouseEnter(index)"
        @mouseup="emit('pixel-mouseup')"
      />
    </div>
  </div>
</template>

<style scoped>
.led-matrix-wrapper {
  background: linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 50%, #0f0f0f 100%);
  
  /* 3D Cinema Frame Effect */
  border-image: linear-gradient(
    135deg,
    #4f46e5 0%,
    #7c3aed 25%,
    #a855f7 50%,
    #7c3aed 75%,
    #4f46e5 100%
  ) 1;
  
  /* Deep Shadow for 3D Effect */
  box-shadow: 
    0 0 0 2px rgba(79, 70, 229, 0.3),
    0 8px 16px -4px rgba(0, 0, 0, 0.6),
    0 20px 40px -8px rgba(0, 0, 0, 0.4),
    inset 0 2px 4px rgba(255, 255, 255, 0.05),
    inset 0 -2px 4px rgba(0, 0, 0, 0.3);
}

.led-matrix-wrapper::before {
  content: '';
  position: absolute;
  inset: -12px;
  background: radial-gradient(
    circle at center,
    rgba(79, 70, 229, 0.15) 0%,
    rgba(124, 58, 237, 0.1) 40%,
    transparent 70%
  );
  border-radius: 1.25rem;
  z-index: -1;
  filter: blur(8px);
}

.led-pixel {
  box-shadow: 
    inset 0 0 3px rgba(0, 0, 0, 0.6),
    0 0 2px rgba(0, 0, 0, 0.3);
}

.led-pixel.selectable:hover {
  transform: scale(1.1);
  box-shadow: 
    inset 0 0 3px rgba(0, 0, 0, 0.6),
    0 0 8px rgba(79, 70, 229, 0.5);
}

.led-pixel.selected {
  box-shadow: 
    inset 0 0 3px rgba(0, 0, 0, 0.6),
    0 0 12px rgba(79, 70, 229, 0.8),
    0 0 0 2px rgba(79, 70, 229, 0.6);
  transform: scale(1.05);
  z-index: 10;
}
</style>
