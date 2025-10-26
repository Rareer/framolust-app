import type { LEDAnimation } from '~/composables/useOpenAI'

/**
 * Composable für ESP8266 Upload-Logik
 */
export const useDeviceUpload = () => {
  const { uploadFramesToDevice, selectedDevice, isDeviceOnline } = useESP8266()
  const { transformForPhysicalMatrix } = useMatrixTransform()
  const toast = useToast()

  /**
   * Lädt ein einzelnes Bild (Frame) auf den ESP8266
   */
  const uploadSingleFrame = async (matrix: string[][]) => {
    if (!selectedDevice.value || !isDeviceOnline.value) {
      if (selectedDevice.value && !isDeviceOnline.value) {
        toast.add({
          title: 'Gerät offline',
          description: 'ESP8266 ist nicht erreichbar. Bild wurde nur lokal geladen.',
          color: 'warning',
          icon: 'i-heroicons-exclamation-triangle'
        })
      } else {
        toast.add({
          title: 'Kein Gerät',
          description: 'Kein ESP8266 verbunden. Bild wurde nur lokal geladen.',
          color: 'info',
          icon: 'i-heroicons-information-circle'
        })
      }
      return false
    }

    try {
      // Transformiere Matrix für physische LED-Anordnung
      const transformedMatrix = transformForPhysicalMatrix(matrix)
      
      // Erstelle ein einzelnes Frame
      const frames = [{
        pixels: transformedMatrix,
        duration: 1000
      }]
      
      await uploadFramesToDevice(selectedDevice.value.ip, frames)
      toast.add({
        title: 'Upload erfolgreich',
        description: 'Bild wurde auf ESP8266 geladen',
        color: 'success',
        icon: 'i-heroicons-check-circle'
      })
      return true
    } catch (error) {
      console.error('Upload failed:', error)
      toast.add({
        title: 'Upload fehlgeschlagen',
        description: 'Prüfe die Verbindung zum ESP8266',
        color: 'error',
        icon: 'i-heroicons-x-circle'
      })
      return false
    }
  }

  /**
   * Lädt eine komplette Animation auf den ESP8266
   */
  const uploadAnimation = async (animation: LEDAnimation) => {
    if (!selectedDevice.value || !isDeviceOnline.value) {
      toast.add({
        title: 'Upload nicht möglich',
        description: 'Keine Animation vorhanden oder ESP8266 nicht verbunden',
        color: 'warning',
        icon: 'i-heroicons-exclamation-triangle'
      })
      return false
    }

    try {
      const { compressAnimation } = useFrameCompression()
      
      // Konvertiere Animation zu Binär-Format mit Transformation
      const transformedAnimation = {
        description: animation.description || 'Custom Animation',
        loop: animation.loop !== false, // Default: true
        frames: animation.frames.map(frame => ({
          pixels: transformForPhysicalMatrix(frame.pixels), // Transformiere für physische Matrix
          duration: frame.duration,
        }))
      }
      
      // Komprimiere zu Binär
      const binaryData = compressAnimation(transformedAnimation)
      console.log(`📦 Uploading: ${binaryData.length} bytes (binary)`)
      console.log(`📦 Frames: ${transformedAnimation.frames.length}`)
      
      // Konvertiere zu Blob
      const blob = new Blob([binaryData.buffer as ArrayBuffer], { type: 'application/octet-stream' })

      const response = await fetch(`http://${selectedDevice.value.ip}/frames`, {
        method: 'POST',
        body: blob,
        headers: {
          'Content-Type': 'application/octet-stream'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      toast.add({
        title: 'Animation hochgeladen',
        description: `${result.frameCount || transformedAnimation.frames.length} Frames auf ESP8266 gespeichert`,
        color: 'success',
        icon: 'i-heroicons-check-circle'
      })
      return true
    } catch (error) {
      console.error('Upload failed:', error)
      toast.add({
        title: 'Upload fehlgeschlagen',
        description: 'Prüfe die Verbindung zum ESP8266',
        color: 'error',
        icon: 'i-heroicons-x-circle'
      })
      return false
    }
  }

  return {
    uploadSingleFrame,
    uploadAnimation,
    selectedDevice,
    isDeviceOnline
  }
}
