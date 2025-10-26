<script setup lang="ts">
import { ref } from 'vue'

interface Emits {
  (e: 'image-uploaded', matrix: string[][]): void
}

const emit = defineEmits<Emits>()

const { quantizeImage } = useImageQuantizer()

const isOpen = ref(false)
const uploadedImage = ref<string | null>(null)
const croppedImage = ref<string | null>(null)
const quantizedMatrix = ref<string[][] | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const cropperContainer = ref<HTMLDivElement | null>(null)
const isProcessing = ref(false)

// Cropper state
const cropArea = ref({
  x: 0,
  y: 0,
  size: 200
})
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const imageElement = ref<HTMLImageElement | null>(null)
const imageSize = ref({ width: 0, height: 0 })

const openModal = () => {
  isOpen.value = true
}

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  
  if (!file) return
  
  if (!file.type.startsWith('image/')) {
    alert('Bitte wähle eine Bilddatei aus')
    return
  }

  const reader = new FileReader()
  reader.onload = (e) => {
    uploadedImage.value = e.target?.result as string
    croppedImage.value = null
    quantizedMatrix.value = null
    
    // Wait for image to load to get dimensions
    setTimeout(() => {
      if (imageElement.value) {
        const img = imageElement.value
        imageSize.value = {
          width: img.clientWidth,
          height: img.clientHeight
        }
        
        // Center crop area
        const minDim = Math.min(img.clientWidth, img.clientHeight)
        cropArea.value = {
          x: (img.clientWidth - minDim) / 2,
          y: (img.clientHeight - minDim) / 2,
          size: minDim
        }
      }
    }, 100)
  }
  reader.readAsDataURL(file)
}

const handleCropStart = (event: MouseEvent) => {
  isDragging.value = true
  dragStart.value = {
    x: event.clientX - cropArea.value.x,
    y: event.clientY - cropArea.value.y
  }
}

const handleCropMove = (event: MouseEvent) => {
  if (!isDragging.value || !imageElement.value) return
  
  const newX = event.clientX - dragStart.value.x
  const newY = event.clientY - dragStart.value.y
  
  // Constrain to image bounds
  const maxX = imageSize.value.width - cropArea.value.size
  const maxY = imageSize.value.height - cropArea.value.size
  
  cropArea.value.x = Math.max(0, Math.min(newX, maxX))
  cropArea.value.y = Math.max(0, Math.min(newY, maxY))
}

const handleCropEnd = () => {
  isDragging.value = false
}

const handleCrop = async () => {
  if (!uploadedImage.value || !imageElement.value) return
  
  isProcessing.value = true
  
  const img = imageElement.value
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  
  if (!ctx) {
    isProcessing.value = false
    return
  }
  
  // Calculate scale factor (displayed size vs actual size)
  const scaleX = img.naturalWidth / img.clientWidth
  const scaleY = img.naturalHeight / img.clientHeight
  
  // Set canvas to crop size
  const cropSize = cropArea.value.size * scaleX
  canvas.width = cropSize
  canvas.height = cropSize
  
  // Draw cropped portion
  ctx.drawImage(
    img,
    cropArea.value.x * scaleX,
    cropArea.value.y * scaleY,
    cropSize,
    cropSize,
    0,
    0,
    cropSize,
    cropSize
  )
  
  croppedImage.value = canvas.toDataURL()
  
  // Quantize to 16x16
  const matrix = await quantizeImage(croppedImage.value)
  if (matrix) {
    quantizedMatrix.value = matrix
  }
  
  isProcessing.value = false
}

const handleConfirm = () => {
  if (!quantizedMatrix.value) return
  
  emit('image-uploaded', quantizedMatrix.value)
  handleClose()
}

const handleClose = () => {
  uploadedImage.value = null
  croppedImage.value = null
  quantizedMatrix.value = null
  isOpen.value = false
}

const triggerFileInput = () => {
  fileInput.value?.click()
}

defineExpose({
  openModal
})
</script>

<template>
  <div>
    <UModal 
      v-model:open="isOpen"
      :ui="{
        wrapper: 'bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl ring-1 ring-gray-800/50 max-w-4xl',
        overlay: 'backdrop-blur-sm'
      }"
    >
      <template #header>
        <div class="flex items-center justify-between gap-3 w-full">
          <div class="flex items-center gap-3">
            <div class="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
              <UIcon name="i-heroicons-arrow-up-tray" class="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h2 class="text-2xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                Bild auf Matrix laden
              </h2>
              <p class="text-sm text-gray-400">Lade ein Bild direkt auf die LED-Matrix</p>
            </div>
          </div>
          <UButton
            icon="i-heroicons-x-mark"
            color="neutral"
            variant="ghost"
            size="lg"
            @click="handleClose"
            title="Schließen"
          />
        </div>
      </template>

      <template #body>
        <div class="p-6 space-y-6 bg-gray-900 rounded-2xl">
          <!-- File Input (Hidden) -->
          <input
            ref="fileInput"
            type="file"
            accept="image/*"
            class="hidden"
            @change="handleFileSelect"
          />

          <!-- Upload Button -->
          <div v-if="!uploadedImage" class="flex flex-col items-center justify-center py-12 border-2 border-dashed border-gray-700 rounded-lg hover:border-purple-500/50 transition-colors cursor-pointer" @click="triggerFileInput">
            <UIcon name="i-heroicons-arrow-up-tray" class="w-12 h-12 text-gray-500 mb-4" />
            <p class="text-lg font-medium text-gray-300 mb-2">Bild hochladen</p>
            <p class="text-sm text-gray-500">Klicke hier oder ziehe ein Bild hierher</p>
          </div>

          <!-- Crop Area -->
          <div v-if="uploadedImage && !croppedImage" class="space-y-4">
            <div class="text-center">
              <p class="text-sm font-medium text-gray-300 mb-2">Wähle einen quadratischen Ausschnitt</p>
              <p class="text-xs text-gray-500">Ziehe das Rechteck, um den Bereich anzupassen</p>
            </div>
            
            <div 
              ref="cropperContainer"
              class="relative inline-block max-w-full mx-auto"
              @mousemove="handleCropMove"
              @mouseup="handleCropEnd"
              @mouseleave="handleCropEnd"
            >
              <img
                ref="imageElement"
                :src="uploadedImage"
                class="max-w-full max-h-96 rounded-lg"
                alt="Upload"
              />
              
              <!-- Crop Overlay -->
              <div
                class="absolute border-2 border-purple-400 bg-purple-400/10 cursor-move"
                :style="{
                  left: cropArea.x + 'px',
                  top: cropArea.y + 'px',
                  width: cropArea.size + 'px',
                  height: cropArea.size + 'px'
                }"
                @mousedown="handleCropStart"
              >
                <div class="absolute inset-0 grid grid-cols-3 grid-rows-3">
                  <div v-for="i in 9" :key="i" class="border border-purple-400/30"></div>
                </div>
              </div>
            </div>

            <div class="flex justify-center gap-3">
              <UButton
                label="Neues Bild"
                icon="i-heroicons-arrow-path"
                color="neutral"
                variant="soft"
                @click="triggerFileInput"
              />
              <UButton
                label="Ausschnitt bestätigen"
                icon="i-heroicons-check"
                color="primary"
                :loading="isProcessing"
                @click="handleCrop"
              />
            </div>
          </div>

          <!-- Preview & Quantized Result -->
          <div v-if="croppedImage" class="space-y-4">
            <div class="grid grid-cols-2 gap-6">
              <!-- Cropped Preview -->
              <div class="space-y-2">
                <p class="text-sm font-medium text-gray-300 text-center">Ausgewählter Bereich</p>
                <div class="flex justify-center">
                  <img :src="croppedImage" class="w-48 h-48 rounded-lg border border-gray-700" alt="Cropped" />
                </div>
              </div>

              <!-- 16x16 Preview -->
              <div class="space-y-2">
                <p class="text-sm font-medium text-gray-300 text-center">16x16 Pixel Vorschau</p>
                <div class="flex justify-center">
                  <div class="w-48 h-48 border border-gray-700 rounded-lg overflow-hidden">
                    <LedMatrix v-if="quantizedMatrix" :pixels="quantizedMatrix" :show-grid="false" />
                  </div>
                </div>
              </div>
            </div>

            <!-- Info -->
            <div class="bg-purple-500/5 border border-purple-500/20 rounded-lg p-4">
              <div class="flex gap-3">
                <UIcon name="i-heroicons-information-circle" class="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                <div class="text-sm text-gray-400">
                  <p>Das Bild wurde auf 16x16 Pixel reduziert und wird direkt auf die Matrix geladen.</p>
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex justify-center gap-3">
              <UButton
                label="Neuer Ausschnitt"
                icon="i-heroicons-arrow-path"
                color="neutral"
                variant="soft"
                @click="croppedImage = null; quantizedMatrix = null"
              />
              <UButton
                label="Auf Matrix laden"
                icon="i-heroicons-check"
                color="primary"
                @click="handleConfirm"
              />
            </div>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
.cursor-move {
  cursor: move;
}
</style>
