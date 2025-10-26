import { ref } from 'vue'

/**
 * Composable für LED Power Control
 */
export const usePowerControl = () => {
  const isPoweredOn = ref(true)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Schaltet die LEDs ein
   */
  const powerOn = async (deviceIp: string): Promise<boolean> => {
    if (!deviceIp) {
      error.value = 'Keine Geräte-IP verfügbar'
      return false
    }

    isLoading.value = true
    error.value = null

    try {
      const response = await fetch(`http://${deviceIp}/power/on`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Power On fehlgeschlagen: ${response.status}`)
      }

      const data = await response.json()
      isPoweredOn.value = data.powered ?? true
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unbekannter Fehler'
      console.error('Power On Error:', err)
      return false
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Schaltet die LEDs aus
   */
  const powerOff = async (deviceIp: string): Promise<boolean> => {
    if (!deviceIp) {
      error.value = 'Keine Geräte-IP verfügbar'
      return false
    }

    isLoading.value = true
    error.value = null

    try {
      const response = await fetch(`http://${deviceIp}/power/off`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Power Off fehlgeschlagen: ${response.status}`)
      }

      const data = await response.json()
      isPoweredOn.value = data.powered ?? false
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unbekannter Fehler'
      console.error('Power Off Error:', err)
      return false
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Togglet den Power-Status
   */
  const togglePower = async (deviceIp: string): Promise<boolean> => {
    if (isPoweredOn.value) {
      return await powerOff(deviceIp)
    } else {
      return await powerOn(deviceIp)
    }
  }

  /**
   * Lädt den aktuellen Power-Status vom Gerät
   */
  const fetchPowerStatus = async (deviceIp: string): Promise<void> => {
    if (!deviceIp) return

    try {
      const response = await fetch(`http://${deviceIp}/power/status`)
      
      if (!response.ok) {
        throw new Error(`Status-Abfrage fehlgeschlagen: ${response.status}`)
      }

      const data = await response.json()
      isPoweredOn.value = data.powered ?? true
    } catch (err) {
      console.error('Power Status Error:', err)
      // Bei Fehler nehmen wir an, dass das Gerät an ist
      isPoweredOn.value = true
    }
  }

  return {
    isPoweredOn,
    isLoading,
    error,
    powerOn,
    powerOff,
    togglePower,
    fetchPowerStatus
  }
}
