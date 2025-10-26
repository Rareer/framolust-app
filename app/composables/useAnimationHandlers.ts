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
   */
  const handleImageGenerated = async (imageUrl: string) => {
    // Stoppe alte Animation
    stopAnimation()
    
    try {
      // Lade das Bild und rastere es auf 16x16
      const { quantizeImage } = useImageQuantizer()
      
      // Konvertiere die URL zu einem verwendbaren Format
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const reader = new FileReader()
      
      reader.onload = async (e) => {
        const imageData = e.target?.result as string
        const matrix = await quantizeImage(imageData)
        
        if (matrix) {
          setPixels(matrix)
          
          // Aktualisiere aktuellen Frame
          if (currentAnimation.value) {
            currentAnimation.value.frames[currentFrameIndex.value] = {
              pixels: matrix,
              duration: currentAnimation.value.frames[currentFrameIndex.value]?.duration || 1000
            }
          }
          
          // Upload zum ESP8266
          await uploadSingleFrame(matrix)
        }
      }
      
      reader.readAsDataURL(blob)
    } catch (error) {
      console.error('Fehler beim Rastern des Bildes:', error)
      alert('Fehler beim Verarbeiten des generierten Bildes')
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
