import { ref } from 'vue'

/**
 * Composable für Frame Copy/Paste Funktionalität
 */
export const useFrameClipboard = () => {
  const clipboard = ref<string[][] | null>(null)

  /**
   * Kopiert einen Frame in die Zwischenablage
   */
  const copyFrame = (pixels: string[][]): void => {
    // Deep copy
    clipboard.value = JSON.parse(JSON.stringify(pixels))
  }

  /**
   * Fügt den Frame aus der Zwischenablage ein
   */
  const pasteFrame = (): string[][] | null => {
    if (!clipboard.value) return null
    // Deep copy zurück
    return JSON.parse(JSON.stringify(clipboard.value))
  }

  /**
   * Prüft ob etwas in der Zwischenablage ist
   */
  const hasClipboard = (): boolean => {
    return clipboard.value !== null
  }

  /**
   * Löscht die Zwischenablage
   */
  const clearClipboard = (): void => {
    clipboard.value = null
  }

  return {
    copyFrame,
    pasteFrame,
    hasClipboard,
    clearClipboard
  }
}
