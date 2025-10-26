import { ref, type Ref } from 'vue'

/**
 * Composable für Matrix/Pixel-Management
 */
export const useMatrixEditor = () => {
  // Initialize with empty/dark pixels
  const pixels = ref<string[][]>(
    Array(16).fill(null).map(() => Array(16).fill('#1a1a1a'))
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
    pixels.value = Array(16).fill(null).map(() => Array(16).fill('#1a1a1a'))
  }

  /**
   * Erstellt eine leere Matrix
   */
  const createEmptyMatrix = (): string[][] => {
    return Array(16).fill(null).map(() => Array(16).fill('#1a1a1a'))
  }

  return {
    pixels,
    setPixels,
    resetPixels,
    createEmptyMatrix
  }
}
