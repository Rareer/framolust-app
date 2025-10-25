<script setup lang="ts">
interface Props {
  pixels: string[][]
  showGrid?: boolean
}

withDefaults(defineProps<Props>(), {
  showGrid: true
})
</script>

<template>
  <div class="led-matrix-wrapper">
    <div class="led-matrix" :class="{ 'no-grid': !showGrid }">
      <div
        v-for="(color, index) in pixels.flat()"
        :key="index"
        class="led-pixel"
        :style="{ backgroundColor: color }"
      />
    </div>
  </div>
</template>

<style scoped>
.led-matrix-wrapper {
  width: 100%;
  max-width: 600px;
  aspect-ratio: 1;
  padding: 1.5rem;
  background: linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 50%, #0f0f0f 100%);
  border-radius: 1rem;
  
  /* 3D Cinema Frame Effect */
  border: 8px solid;
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
  
  /* Subtle glow */
  position: relative;
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

.led-matrix {
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: repeat(16, 1fr);
  grid-template-rows: repeat(16, 1fr);
  gap: 2px;
}

.led-matrix.no-grid {
  gap: 0;
}

.led-pixel {
  width: 100%;
  height: 100%;
  border-radius: 2px;
  transition: background-color 0.2s ease;
  box-shadow: 
    inset 0 0 3px rgba(0, 0, 0, 0.6),
    0 0 2px rgba(0, 0, 0, 0.3);
}

.no-grid .led-pixel {
  border-radius: 0;
  box-shadow: none;
}
</style>
