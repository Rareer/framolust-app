import { ref, computed } from 'vue'

export interface PixelCoordinate {
  x: number
  y: number
}

/**
 * Composable für Pixel-Selektion in der LED Matrix
 */
export const usePixelSelection = () => {
  const selectedPixels = ref<Set<string>>(new Set())
  const isSelecting = ref(false)
  const selectionStart = ref<PixelCoordinate | null>(null)
  const currentHover = ref<PixelCoordinate | null>(null)
  const editorMode = ref<'select' | 'paint'>('select')
  const paintColor = ref('#ffffff')
  const isPainting = ref(false)

  /**
   * Konvertiert Koordinaten zu einem eindeutigen String-Key
   */
  const coordToKey = (x: number, y: number): string => {
    return `${x},${y}`
  }

  /**
   * Konvertiert String-Key zurück zu Koordinaten
   */
  const keyToCoord = (key: string): PixelCoordinate => {
    const parts = key.split(',').map(Number)
    return { x: parts[0] || 0, y: parts[1] || 0 }
  }

  /**
   * Prüft ob ein Pixel selektiert ist
   */
  const isPixelSelected = (x: number, y: number): boolean => {
    return selectedPixels.value.has(coordToKey(x, y))
  }

  /**
   * Selektiert ein einzelnes Pixel (mit Shift = Toggle, ohne = Replace)
   */
  const selectPixel = (x: number, y: number, shiftKey: boolean = false) => {
    const key = coordToKey(x, y)
    
    if (shiftKey) {
      // Toggle: Hinzufügen oder entfernen
      if (selectedPixels.value.has(key)) {
        selectedPixels.value.delete(key)
      } else {
        selectedPixels.value.add(key)
      }
    } else {
      // Replace: Nur dieses Pixel selektieren
      selectedPixels.value.clear()
      selectedPixels.value.add(key)
    }
  }

  /**
   * Startet eine Rechteck-Selektion
   */
  const startRectSelection = (x: number, y: number) => {
    isSelecting.value = true
    selectionStart.value = { x, y }
    selectedPixels.value.clear()
    selectedPixels.value.add(coordToKey(x, y))
  }

  /**
   * Aktualisiert die Rechteck-Selektion während des Ziehens
   */
  const updateRectSelection = (x: number, y: number) => {
    if (!isSelecting.value || !selectionStart.value) return
    
    currentHover.value = { x, y }
    
    // Berechne Rechteck
    const minX = Math.min(selectionStart.value.x, x)
    const maxX = Math.max(selectionStart.value.x, x)
    const minY = Math.min(selectionStart.value.y, y)
    const maxY = Math.max(selectionStart.value.y, y)
    
    // Selektiere alle Pixel im Rechteck
    selectedPixels.value.clear()
    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        selectedPixels.value.add(coordToKey(px, py))
      }
    }
  }

  /**
   * Beendet die Rechteck-Selektion
   */
  const endRectSelection = () => {
    isSelecting.value = false
    selectionStart.value = null
    currentHover.value = null
  }

  /**
   * Löscht alle Selektionen
   */
  const clearSelection = () => {
    selectedPixels.value.clear()
    isSelecting.value = false
    selectionStart.value = null
    currentHover.value = null
  }

  /**
   * Gibt alle selektierten Pixel-Koordinaten zurück
   */
  const getSelectedCoordinates = (): PixelCoordinate[] => {
    return Array.from(selectedPixels.value).map(keyToCoord)
  }

  /**
   * Computed: Anzahl der selektierten Pixel
   */
  const selectedCount = computed(() => selectedPixels.value.size)

  /**
   * Computed: Gibt die Farben der selektierten Pixel zurück
   */
  const getSelectedColors = (pixels: string[][]): string[] => {
    const colors = new Set<string>()
    getSelectedCoordinates().forEach(({ x, y }) => {
      if (pixels[y] && pixels[y][x]) {
        colors.add(pixels[y][x])
      }
    })
    return Array.from(colors)
  }

  /**
   * Toggle zwischen Select und Paint Modus
   */
  const toggleMode = () => {
    editorMode.value = editorMode.value === 'select' ? 'paint' : 'select'
    clearSelection()
    isPainting.value = false
  }

  /**
   * Setzt die Paint-Farbe
   */
  const setPaintColor = (color: string) => {
    paintColor.value = color
  }

  /**
   * Startet das Malen
   */
  const startPainting = () => {
    isPainting.value = true
  }

  /**
   * Stoppt das Malen
   */
  const stopPainting = () => {
    isPainting.value = false
  }

  return {
    // State
    selectedPixels,
    isSelecting,
    selectedCount,
    editorMode,
    paintColor,
    isPainting,
    
    // Selection Methods
    isPixelSelected,
    selectPixel,
    startRectSelection,
    updateRectSelection,
    endRectSelection,
    clearSelection,
    getSelectedCoordinates,
    getSelectedColors,
    
    // Paint Methods
    toggleMode,
    setPaintColor,
    startPainting,
    stopPainting
  }
}
