import { ref } from 'vue'

export const useImageQuantizer = () => {
  const isProcessing = ref(false)
  const error = ref<string | null>(null)

  /**
   * Quantize an image to 16x16 pixels with color reduction
   * @param imageData - Base64 or Blob URL of the cropped image
   * @returns 16x16 array of hex color strings
   */
  const quantizeImage = async (imageData: string): Promise<string[][] | null> => {
    isProcessing.value = true
    error.value = null

    try {
      // Create image element
      const img = new Image()
      img.crossOrigin = 'anonymous'
      
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        img.src = imageData
      })

      // Create canvas for downscaling
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      
      if (!ctx) {
        throw new Error('Could not get canvas context')
      }

      // Set canvas to 16x16
      canvas.width = 16
      canvas.height = 16

      // Disable image smoothing for pixelated effect
      ctx.imageSmoothingEnabled = false

      // Draw image scaled down to 16x16
      ctx.drawImage(img, 0, 0, 16, 16)

      // Get pixel data
      const imageDataObj = ctx.getImageData(0, 0, 16, 16)
      const pixels = imageDataObj.data

      // Convert to 2D array of hex colors
      const matrix: string[][] = []
      
      for (let y = 0; y < 16; y++) {
        const row: string[] = []
        for (let x = 0; x < 16; x++) {
          const index = (y * 16 + x) * 4
          const r = pixels[index] ?? 0
          const g = pixels[index + 1] ?? 0
          const b = pixels[index + 2] ?? 0
          
          // Convert to hex
          const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
          row.push(hex)
        }
        matrix.push(row)
      }

      return matrix
    } catch (err: any) {
      error.value = `Fehler beim Verarbeiten des Bildes: ${err.message}`
      return null
    } finally {
      isProcessing.value = false
    }
  }

  /**
   * Generate a base64 preview of the quantized image
   */
  const generatePreview = (matrix: string[][]): string => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    if (!ctx) return ''

    canvas.width = 16
    canvas.height = 16

    // Draw each pixel
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        ctx.fillStyle = matrix[y]?.[x] || '#000000'
        ctx.fillRect(x, y, 1, 1)
      }
    }

    return canvas.toDataURL()
  }

  /**
   * Convert matrix to a text description for the AI prompt
   */
  const matrixToPromptDescription = (matrix: string[][]): string => {
    // Analyze dominant colors
    const colorMap = new Map<string, number>()
    
    matrix.flat().forEach(color => {
      colorMap.set(color, (colorMap.get(color) || 0) + 1)
    })

    // Get top colors
    const sortedColors = Array.from(colorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    const colorDescriptions = sortedColors.map(([color, count]) => {
      const percentage = Math.round((count / 256) * 100)
      return `${color} (${percentage}%)`
    })

    return `Image colors: ${colorDescriptions.join(', ')}`
  }

  return {
    isProcessing,
    error,
    quantizeImage,
    generatePreview,
    matrixToPromptDescription
  }
}
