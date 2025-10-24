<script setup lang="ts">
import { ref, computed } from 'vue'

interface Emits {
  (e: 'cropped', imageData: string[][]): void
}

const emit = defineEmits<Emits>()

const imageFile = ref<File | null>(null)
const imageUrl = ref<string>('')
const canvas = ref<HTMLCanvasElement | null>(null)
const cropCanvas = ref<HTMLCanvasElement | null>(null)
const img = ref<HTMLImageElement | null>(null)

// Crop area state
const cropArea = ref({
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  isDragging: false,
  dragStartX: 0,
  dragStartY: 0
})

const isImageLoaded = computed(() => !!imageUrl.value)

const handleFileUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  
  if (file && file.type.startsWith('image/')) {
    imageFile.value = file
    imageUrl.value = URL.createObjectURL(file)
    
    // Load image
    const image = new Image()
    image.onload = () => {
      img.value = image
      drawImage()
      
      // Initialize crop area in center
      const size = Math.min(image.width, image.height) * 0.5
      cropArea.value = {
        x: (image.width - size) / 2,
        y: (image.height - size) / 2,
        width: size,
        height: size,
        isDragging: false,
        dragStartX: 0,
        dragStartY: 0
      }
    }
    image.src = imageUrl.value
  }
}

const drawImage = () => {
  if (!canvas.value || !img.value) return
  
  const ctx = canvas.value.getContext('2d')
  if (!ctx) return
  
  canvas.value.width = img.value.width
  canvas.value.height = img.value.height
  ctx.drawImage(img.value, 0, 0)
  
  // Draw crop overlay
  drawCropOverlay()
}

const drawCropOverlay = () => {
  if (!canvas.value || !img.value) return
  
  const ctx = canvas.value.getContext('2d')
  if (!ctx) return
  
  // Redraw image
  ctx.clearRect(0, 0, canvas.value.width, canvas.value.height)
  ctx.drawImage(img.value, 0, 0)
  
  // Draw dark overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
  ctx.fillRect(0, 0, canvas.value.width, canvas.value.height)
  
  // Clear crop area
  ctx.clearRect(cropArea.value.x, cropArea.value.y, cropArea.value.width, cropArea.value.height)
  ctx.drawImage(
    img.value,
    cropArea.value.x, cropArea.value.y, cropArea.value.width, cropArea.value.height,
    cropArea.value.x, cropArea.value.y, cropArea.value.width, cropArea.value.height
  )
  
  // Draw border
  ctx.strokeStyle = '#3b82f6'
  ctx.lineWidth = 2
  ctx.strokeRect(cropArea.value.x, cropArea.value.y, cropArea.value.width, cropArea.value.height)
}

const startDrag = (event: MouseEvent) => {
  const rect = canvas.value?.getBoundingClientRect()
  if (!rect) return
  
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  
  // Check if click is inside crop area
  if (
    x >= cropArea.value.x &&
    x <= cropArea.value.x + cropArea.value.width &&
    y >= cropArea.value.y &&
    y <= cropArea.value.y + cropArea.value.height
  ) {
    cropArea.value.isDragging = true
    cropArea.value.dragStartX = x - cropArea.value.x
    cropArea.value.dragStartY = y - cropArea.value.y
  }
}

const drag = (event: MouseEvent) => {
  if (!cropArea.value.isDragging || !canvas.value || !img.value) return
  
  const rect = canvas.value.getBoundingClientRect()
  const x = event.clientX - rect.left - cropArea.value.dragStartX
  const y = event.clientY - rect.top - cropArea.value.dragStartY
  
  // Constrain to canvas bounds
  cropArea.value.x = Math.max(0, Math.min(x, img.value.width - cropArea.value.width))
  cropArea.value.y = Math.max(0, Math.min(y, img.value.height - cropArea.value.height))
  
  drawCropOverlay()
}

const stopDrag = () => {
  cropArea.value.isDragging = false
}

const updateCropSize = (newSize: number) => {
  if (!img.value) return
  
  const maxSize = Math.min(img.value.width, img.value.height)
  cropArea.value.width = Math.min(newSize, maxSize)
  cropArea.value.height = cropArea.value.width
  
  // Adjust position if needed
  cropArea.value.x = Math.min(cropArea.value.x, img.value.width - cropArea.value.width)
  cropArea.value.y = Math.min(cropArea.value.y, img.value.height - cropArea.value.height)
  
  drawCropOverlay()
}

const quantizeImage = () => {
  if (!img.value || !cropCanvas.value) return
  
  const ctx = cropCanvas.value.getContext('2d')
  if (!ctx) return
  
  // Draw cropped area to crop canvas
  cropCanvas.value.width = 16
  cropCanvas.value.height = 16
  
  ctx.drawImage(
    img.value,
    cropArea.value.x, cropArea.value.y, cropArea.value.width, cropArea.value.height,
    0, 0, 16, 16
  )
  
  // Get pixel data
  const imageData = ctx.getImageData(0, 0, 16, 16)
  const pixels: string[][] = []
  
  for (let y = 0; y < 16; y++) {
    const row: string[] = []
    for (let x = 0; x < 16; x++) {
      const i = (y * 16 + x) * 4
      const r = imageData.data[i]
      const g = imageData.data[i + 1]
      const b = imageData.data[i + 2]
      row.push(`rgb(${r}, ${g}, ${b})`)
    }
    pixels.push(row)
  }
  
  emit('cropped', pixels)
}
</script>

<template>
  <div class="image-cropper">
    <UCard>
      <template #header>
        <h3 class="text-lg font-semibold">Bild hochladen & zuschneiden</h3>
      </template>
      
      <div class="space-y-4">
        <div>
          <input
            type="file"
            accept="image/*"
            @change="handleFileUpload"
            class="hidden"
            id="file-upload"
          />
          <UButton
            label="Bild auswählen"
            icon="i-heroicons-photo"
            @click="() => document.getElementById('file-upload')?.click()"
            size="lg"
            block
          />
        </div>
        
        <div v-if="isImageLoaded" class="space-y-4">
          <div class="canvas-container">
            <canvas
              ref="canvas"
              @mousedown="startDrag"
              @mousemove="drag"
              @mouseup="stopDrag"
              @mouseleave="stopDrag"
              class="max-w-full h-auto border border-gray-200 dark:border-gray-700 rounded cursor-move"
            />
          </div>
          
          <div class="space-y-2">
            <label class="text-sm font-medium">Ausschnittgröße</label>
            <input
              type="range"
              :min="50"
              :max="Math.min(img?.width || 500, img?.height || 500)"
              :value="cropArea.width"
              @input="(e) => updateCropSize(Number((e.target as HTMLInputElement).value))"
              class="w-full"
            />
            <p class="text-xs text-gray-500">{{ Math.round(cropArea.width) }}px</p>
          </div>
          
          <UButton
            label="Auf 16x16 quantifizieren"
            icon="i-heroicons-squares-2x2"
            @click="quantizeImage"
            color="primary"
            size="lg"
            block
          />
        </div>
        
        <canvas ref="cropCanvas" class="hidden" />
      </div>
    </UCard>
  </div>
</template>

<style scoped>
.canvas-container {
  display: flex;
  justify-content: center;
  overflow: auto;
  max-height: 500px;
}

input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  height: 6px;
  border-radius: 3px;
  background: #e5e7eb;
  outline: none;
}

input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
}

input[type="range"]::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
  border: none;
}

.dark input[type="range"] {
  background: #374151;
}
</style>
