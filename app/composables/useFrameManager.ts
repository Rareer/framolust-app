import { ref, watch, type Ref } from 'vue'
import type { LEDAnimation } from '~/composables/useOpenAI'

/**
 * Composable für Frame-Management und Animation-Steuerung
 */
export const useFrameManager = () => {
  const currentAnimation = ref<LEDAnimation | null>(null)
  const currentFrameIndex = ref(0)
  const isPlaying = ref(false)
  const animationInterval = ref<NodeJS.Timeout | null>(null)
  
  // Enforce global FPS for preview
  const TARGET_FPS = 15
  const FRAME_INTERVAL_MS = Math.round(1000 / TARGET_FPS) // ~67ms

  /**
   * Startet die Animation
   */
  const playAnimation = (onFrameUpdate: (pixels: string[][]) => void) => {
    if (!currentAnimation.value || isPlaying.value) return
    
    isPlaying.value = true
    showFrame(0, onFrameUpdate)
  }

  /**
   * Stoppt die Animation
   */
  const stopAnimation = () => {
    isPlaying.value = false
    if (animationInterval.value) {
      clearTimeout(animationInterval.value)
      animationInterval.value = null
    }
  }

  /**
   * Zeigt einen spezifischen Frame
   */
  const showFrame = (frameIndex: number, onFrameUpdate: (pixels: string[][]) => void) => {
    if (!currentAnimation.value || !isPlaying.value) return
    
    const frame = currentAnimation.value.frames[frameIndex]
    if (!frame) return
    
    onFrameUpdate(frame.pixels)
    currentFrameIndex.value = frameIndex
    
    // Schedule next frame
    animationInterval.value = setTimeout(() => {
      const nextIndex = (frameIndex + 1) % currentAnimation.value!.frames.length
      
      // Stop if not looping and reached the end
      if (!currentAnimation.value!.loop && nextIndex === 0) {
        isPlaying.value = false
        return
      }
      
      showFrame(nextIndex, onFrameUpdate)
    }, FRAME_INTERVAL_MS)
  }

  /**
   * Toggle Play/Pause
   */
  const togglePlayPause = (onFrameUpdate: (pixels: string[][]) => void) => {
    if (isPlaying.value) {
      stopAnimation()
    } else {
      playAnimation(onFrameUpdate)
    }
  }

  /**
   * Navigiert zu einem spezifischen Frame
   */
  const goToFrame = (frameIndex: number, onFrameUpdate: (pixels: string[][]) => void) => {
    if (!currentAnimation.value) return
    
    stopAnimation()
    currentFrameIndex.value = frameIndex
    const frame = currentAnimation.value.frames[frameIndex]
    if (frame) {
      onFrameUpdate(frame.pixels)
    }
  }

  /**
   * Fügt einen neuen Frame hinzu (dupliziert aktuellen Frame)
   */
  const addFrame = (onFrameUpdate: (pixels: string[][]) => void) => {
    if (!currentAnimation.value) return
    
    // Dupliziere aktuellen Frame
    const currentFrame = currentAnimation.value.frames[currentFrameIndex.value]
    if (!currentFrame) return
    
    const newFrame = {
      pixels: JSON.parse(JSON.stringify(currentFrame.pixels)), // Deep copy
      duration: currentFrame.duration
    }
    
    // Füge nach aktuellem Frame ein
    currentAnimation.value.frames.splice(currentFrameIndex.value + 1, 0, newFrame)
    currentFrameIndex.value++
    onFrameUpdate(newFrame.pixels)
  }

  /**
   * Löscht den aktuellen Frame
   */
  const deleteFrame = (onFrameUpdate: (pixels: string[][]) => void) => {
    if (!currentAnimation.value || currentAnimation.value.frames.length <= 1) {
      alert('Eine Animation muss mindestens einen Frame haben!')
      return
    }
    
    currentAnimation.value.frames.splice(currentFrameIndex.value, 1)
    
    // Passe Index an wenn nötig
    if (currentFrameIndex.value >= currentAnimation.value.frames.length) {
      currentFrameIndex.value = currentAnimation.value.frames.length - 1
    }
    
    // Zeige neuen aktuellen Frame
    const frame = currentAnimation.value.frames[currentFrameIndex.value]
    if (frame) {
      onFrameUpdate(frame.pixels)
    }
  }

  /**
   * Setzt eine neue Animation
   */
  const setAnimation = (animation: LEDAnimation, onFrameUpdate: (pixels: string[][]) => void) => {
    stopAnimation()
    currentAnimation.value = animation
    currentFrameIndex.value = 0
    
    // Zeige ersten Frame
    if (animation.frames[0]) {
      onFrameUpdate(animation.frames[0].pixels)
    }
  }

  /**
   * Setzt die Animation zurück
   */
  const resetAnimation = () => {
    stopAnimation()
    currentAnimation.value = null
    currentFrameIndex.value = 0
  }

  return {
    // State
    currentAnimation,
    currentFrameIndex,
    isPlaying,
    
    // Methods
    playAnimation,
    stopAnimation,
    togglePlayPause,
    goToFrame,
    addFrame,
    deleteFrame,
    setAnimation,
    resetAnimation
  }
}
