import type { LEDAnimation } from '~/composables/useOpenAI'

/**
 * Composable für ESP8266 Upload-Logik
 */
export const useDeviceUpload = () => {
  const { uploadFramesToDevice, selectedDevice, isDeviceOnline } = useESP8266()
  const { transformForPhysicalMatrix } = useMatrixTransform()

  /**
   * Lädt ein einzelnes Bild (Frame) auf den ESP8266
   */
  const uploadSingleFrame = async (matrix: string[][]) => {
    if (!selectedDevice.value || !isDeviceOnline.value) {
      if (selectedDevice.value && !isDeviceOnline.value) {
        alert('⚠️ ESP8266 ist nicht erreichbar. Bild wurde nur lokal geladen.')
      } else {
        alert('ℹ️ Kein ESP8266 verbunden. Bild wurde nur lokal geladen.')
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
      alert('✅ Bild erfolgreich auf ESP8266 geladen!')
      return true
    } catch (error) {
      console.error('Upload failed:', error)
      alert('❌ Upload fehlgeschlagen! Prüfe die Verbindung zum ESP8266.')
      return false
    }
  }

  /**
   * Lädt eine komplette Animation auf den ESP8266
   */
  const uploadAnimation = async (animation: LEDAnimation) => {
    if (!selectedDevice.value || !isDeviceOnline.value) {
      alert('Keine Animation vorhanden oder ESP8266 nicht verbunden!')
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
      alert(`✓ Frames erfolgreich hochgeladen!\n${result.frameCount || transformedAnimation.frames.length} Frames auf ESP8266 gespeichert.`)
      return true
    } catch (error) {
      console.error('Upload failed:', error)
      alert('❌ Upload fehlgeschlagen! Prüfe die Verbindung zum ESP8266.')
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
