<script setup lang="ts">
interface Props {
  pixels: string[][]
  size?: number
}

const props = withDefaults(defineProps<Props>(), {
  size: 20
})

const pixelStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`
}))
</script>

<template>
  <div class="led-matrix">
    <div
      v-for="(row, rowIndex) in pixels"
      :key="rowIndex"
      class="led-row"
    >
      <div
        v-for="(color, colIndex) in row"
        :key="colIndex"
        class="led-pixel"
        :style="{ ...pixelStyle, backgroundColor: color }"
      />
    </div>
  </div>
</template>

<style scoped>
.led-matrix {
  display: inline-flex;
  flex-direction: column;
  gap: 2px;
  padding: 1rem;
  background: #1a1a1a;
  border-radius: 0.5rem;
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
}

.led-row {
  display: flex;
  gap: 2px;
}

.led-pixel {
  border-radius: 2px;
  transition: background-color 0.2s ease;
  box-shadow: inset 0 0 2px rgba(0, 0, 0, 0.5);
}
</style>
