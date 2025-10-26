import { ref, type Ref } from 'vue'

/**
 * Composable für Matrix/Pixel-Management
 */
export const useMatrixEditor = () => {
  // Initialize with empty/dark pixels (pure black)
  const pixels = ref<string[][]>(
    Array(16).fill(null).map(() => Array(16).fill('#000000'))
  )

  /**
   * Setzt die Matrix auf einen neuen Wert
   */
  const setPixels = (newPixels: string[][]) => {
    pixels.value = newPixels
  }

  /**
   * Setzt die Matrix zurück auf leer/dunkel
   */
  const resetPixels = () => {
    pixels.value = Array(16).fill(null).map(() => Array(16).fill('#000000'))
  }

  /**
   * Erstellt eine leere Matrix
   */
  const createEmptyMatrix = (): string[][] => {
    return Array(16).fill(null).map(() => Array(16).fill('#000000'))
  }

  return {
    pixels,
    setPixels,
    resetPixels,
    createEmptyMatrix
  }
}
