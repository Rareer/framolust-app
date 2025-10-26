import type { LEDAnimation } from '~/composables/useOpenAI'

/**
 * Composable für Animation-Event-Handler
 */
export const useAnimationHandlers = (
  frameManager: ReturnType<typeof useFrameManager>,
  matrixEditor: ReturnType<typeof useMatrixEditor>,
  deviceUpload: ReturnType<typeof useDeviceUpload>
) => {
  const { setAnimation, playAnimation, stopAnimation, currentAnimation, currentFrameIndex } = frameManager
  const { pixels, setPixels, createEmptyMatrix } = matrixEditor
  const { uploadSingleFrame } = deviceUpload

  /**
   * Handler für AI-generierte Animationen
   */
  const handleAnimationGenerated = (animation: LEDAnimation) => {
    // AI-Generierung ersetzt vorhandene Frames komplett
    setAnimation(animation, (framePixels) => {
      setPixels(framePixels)
    })
    
    // Starte Animation automatisch
    playAnimation((framePixels) => {
      setPixels(framePixels)
    })
  }

  /**
   * Handler für AI-generierte Bilder
   * Aktualisiert nur das aktuelle Frame, ohne andere Frames zu löschen oder automatisch hochzuladen
   */
  const handleImageGenerated = async (imageUrl: string) => {
    // Stoppe Animation (aber behalte alle Frames)
    stopAnimation()
    
    try {
      // Lade das Bild und rastere es auf 16x16
      const { quantizeImage } = useImageQuantizer()
      
      // Verwende Proxy-Endpoint um CORS-Probleme zu vermeiden
      const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`
      
      const response = await fetch(proxyUrl)
      
      if (!response.ok) {
        throw new Error(`Proxy-Fehler: ${response.status} ${response.statusText}`)
      }
      
      const blob = await response.blob()
      
      // Konvertiere Blob zu Data URL
      const reader = new FileReader()
      
      reader.onload = async (e) => {
        const imageData = e.target?.result as string
        const matrix = await quantizeImage(imageData)
        
        if (matrix) {
          // Aktualisiere nur die Pixel-Anzeige
          setPixels(matrix)
          
          // Aktualisiere nur das aktuelle Frame in der Animation
          if (currentAnimation.value) {
            currentAnimation.value.frames[currentFrameIndex.value] = {
              pixels: matrix,
              duration: currentAnimation.value.frames[currentFrameIndex.value]?.duration || 1000
            }
          }
          
          // Kein automatischer Upload zum ESP8266
          // User kann manuell hochladen wenn gewünscht
        } else {
          throw new Error('Quantisierung fehlgeschlagen')
        }
      }
      
      reader.onerror = () => {
        throw new Error('Fehler beim Lesen des Bildes')
      }
      
      reader.readAsDataURL(blob)
    } catch (error) {
      console.error('Fehler beim Verarbeiten des generierten Bildes:', error)
      alert(`Fehler beim Verarbeiten des generierten Bildes: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`)
    }
  }

  /**
   * Handler für direkten Bild-Upload
   */
  const handleDirectImageUpload = async (matrix: string[][]) => {
    // Stoppe Animation und aktualisiere aktuellen Frame
    stopAnimation()
    setPixels(matrix)
    
    // Aktualisiere aktuellen Frame in der Animation
    if (currentAnimation.value) {
      currentAnimation.value.frames[currentFrameIndex.value] = {
        pixels: matrix,
        duration: currentAnimation.value.frames[currentFrameIndex.value]?.duration || 1000
      }
    }
    
    // Upload zum ESP8266
    await uploadSingleFrame(matrix)
  }

  /**
   * Handler für Cropped Image (falls noch verwendet)
   */
  const handleCroppedImage = (imageData: string[][]) => {
    stopAnimation()
    setPixels(imageData)
  }

  /**
   * Initialisiert eine leere Animation beim Start
   */
  const initializeEmptyAnimation = () => {
    if (!currentAnimation.value) {
      const emptyPixels = createEmptyMatrix()
      currentAnimation.value = {
        description: 'Manuelle Animation',
        loop: true,
        frames: [{
          pixels: emptyPixels,
          duration: 1000
        }]
      }
    }
  }

  /**
   * Setzt alles zurück
   */
  const resetAll = () => {
    const emptyPixels = createEmptyMatrix()
    setPixels(emptyPixels)
    
    currentAnimation.value = {
      description: 'Manuelle Animation',
      loop: true,
      frames: [{
        pixels: emptyPixels,
        duration: 1000
      }]
    }
    
    currentFrameIndex.value = 0
    stopAnimation()
  }

  return {
    handleAnimationGenerated,
    handleImageGenerated,
    handleDirectImageUpload,
    handleCroppedImage,
    initializeEmptyAnimation,
    resetAll
  }
}
