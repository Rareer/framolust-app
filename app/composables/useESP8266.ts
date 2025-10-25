/**
 * Composable für ESP8266 Integration
 * Handles WiFi-Konfiguration, Firmware-Flash und Frame-Upload
 */

export interface ESP8266Device {
  deviceId: string
  deviceName: string
  ip: string
  mac: string
  ssid: string
  rssi: number
  status: 'online' | 'offline'
  frameCount: number
  customName?: string // User-defined custom name
  firmware?: string // Firmware identifier (e.g. "framolux")
  version?: string // Firmware version
  isFramolux?: boolean // Quick check if it's our firmware
}

export interface WiFiConfig {
  ssid: string
  password: string
}

export const useESP8266 = () => {
  const devices = ref<ESP8266Device[]>([])
  const selectedDevice = ref<ESP8266Device | null>(null)
  const isScanning = ref(false)
  const isUploading = ref(false)
  const uploadProgress = ref(0)

  /**
   * Scanne nach ESP8266 Geräten im lokalen Netzwerk
   * Verwendet IP-Range Scan über Backend
   */
  const scanForDevices = async (subnet?: string) => {
    isScanning.value = true
    devices.value = []

    try {
      console.log('Starting device scan...')
      
      // IP-Range Scan über Backend
      const response = await $fetch<{ success: boolean, devices: ESP8266Device[], subnet: string }>('/api/esp8266/discover', {
        method: 'GET',
        query: subnet ? { subnet } : {},
      })

      console.log(`Scan complete. Found ${response.devices.length} devices.`)
      devices.value = response.devices
      
      return response.devices
    } catch (error) {
      console.error('Device scan failed:', error)
      return []
    } finally {
      isScanning.value = false
    }
  }

  /**
   * Prüfe ob ein Gerät Framolux Firmware hat
   */
  const checkFramoluxFirmware = async (ip: string): Promise<{ isFramolux: boolean, version?: string, info?: any }> => {
    try {
      const response = await $fetch<any>(`http://${ip}/info`, {
        method: 'GET',
        timeout: 3000,
      })

      // Prüfe ob es unsere Firmware ist
      const isFramolux = response.firmware === 'framolux'
      
      return {
        isFramolux,
        version: response.version,
        info: response
      }
    } catch (error) {
      console.error('Failed to check firmware:', error)
      return { isFramolux: false }
    }
  }

  /**
   * Verbinde mit einem spezifischen Gerät über IP
   */
  const connectToDevice = async (ip: string): Promise<ESP8266Device | null> => {
    try {
      // Prüfe zuerst ob es Framolux Firmware ist
      const firmwareCheck = await checkFramoluxFirmware(ip)
      
      if (!firmwareCheck.isFramolux) {
        console.warn(`Device at ${ip} does not have Framolux firmware`)
        return null
      }

      const response = firmwareCheck.info

      const device: ESP8266Device = {
        ...response,
        status: 'online',
        isFramolux: true,
      }

      // Füge Gerät zur Liste hinzu, falls noch nicht vorhanden
      const existingIndex = devices.value.findIndex(d => d.deviceId === device.deviceId)
      if (existingIndex >= 0) {
        devices.value[existingIndex] = device
      } else {
        devices.value.push(device)
      }

      selectedDevice.value = device
      return device
    } catch (error) {
      console.error('Failed to connect to device:', error)
      return null
    }
  }

  /**
   * Prüfe Status eines Geräts
   */
  const checkDeviceStatus = async (ip: string) => {
    try {
      const response = await $fetch<{
        status: string
        deviceId: string
        frameCount: number
        freeHeap: number
        uptime: number
      }>(`http://${ip}/status`, {
        method: 'GET',
      })

      return response
    } catch (error) {
      console.error('Failed to check device status:', error)
      return null
    }
  }

  /**
   * Lade Frames auf ESP8266 hoch
   */
  const uploadFramesToDevice = async (
    deviceIp: string,
    frames: Array<{ duration: number; leds: string[] }>
  ) => {
    isUploading.value = true
    uploadProgress.value = 0

    try {
      const payload = {
        frames,
        totalFrames: frames.length,
        timestamp: Date.now(),
      }

      // Simuliere Upload-Progress (da $fetch kein onUploadProgress unterstützt)
      const payloadSize = JSON.stringify(payload).length
      const chunks = Math.ceil(payloadSize / 10000) // Simuliere Chunks
      
      const progressInterval = setInterval(() => {
        if (uploadProgress.value < 90) {
          uploadProgress.value += Math.floor(90 / chunks)
        }
      }, 100)

      const response = await $fetch<{
        success: boolean
        frameCount: number
        message: string
      }>(`http://${deviceIp}/frames`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      clearInterval(progressInterval)

      uploadProgress.value = 100
      return response
    } catch (error) {
      console.error('Failed to upload frames:', error)
      throw error
    } finally {
      isUploading.value = false
      setTimeout(() => {
        uploadProgress.value = 0
      }, 2000)
    }
  }

  /**
   * Hole gespeicherte Frames vom Gerät
   */
  const getFramesFromDevice = async (deviceIp: string) => {
    try {
      const response = await $fetch<{
        frames: Array<{ duration: number; leds: string[] }>
        totalFrames: number
      }>(`http://${deviceIp}/frames`, {
        method: 'GET',
      })

      return response
    } catch (error) {
      console.error('Failed to get frames from device:', error)
      return null
    }
  }

  /**
   * Lösche alle Frames vom Gerät
   */
  const clearFramesOnDevice = async (deviceIp: string) => {
    try {
      const response = await $fetch<{
        success: boolean
        message: string
      }>(`http://${deviceIp}/frames`, {
        method: 'DELETE',
      })

      return response
    } catch (error) {
      console.error('Failed to clear frames:', error)
      throw error
    }
  }

  /**
   * Ändere Device-Namen
   */
  const renameDevice = async (deviceIp: string, newName: string) => {
    try {
      const response = await $fetch<{
        success: boolean
        deviceName: string
        message: string
      }>(`http://${deviceIp}/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deviceName: newName }),
      })

      // Aktualisiere lokale Device-Liste
      const device = devices.value.find(d => d.ip === deviceIp)
      if (device) {
        device.deviceName = newName
        saveKnownDevices()
      }

      return response
    } catch (error) {
      console.error('Failed to rename device:', error)
      throw error
    }
  }

  /**
   * Generiere Build-Command für Firmware mit WiFi-Credentials
   */
  const generateBuildCommand = (config: WiFiConfig, deviceId: string = '', upload: boolean = false): string => {
    const isWindows = navigator.platform.toLowerCase().includes('win')
    
    const deviceIdParam = deviceId ? ` -DeviceId "${deviceId}"` : ''
    const deviceIdParamBash = deviceId ? ` --device-id "${deviceId}"` : ''
    
    if (isWindows) {
      return `powershell -ExecutionPolicy Bypass -File .\\firmware\\build.ps1 -SSID "${config.ssid}" -Password "${config.password}"${deviceIdParam}${upload ? ' -Upload' : ''}`
    } else {
      return `./firmware/build.sh --ssid "${config.ssid}" --password "${config.password}"${deviceIdParamBash}${upload ? ' --upload' : ''}`
    }
  }

  /**
   * Speichere WiFi-Konfiguration lokal
   */
  const saveWiFiConfig = (config: WiFiConfig) => {
    if (process.client) {
      localStorage.setItem('framolux_wifi_config', JSON.stringify(config))
    }
  }

  /**
   * Lade gespeicherte WiFi-Konfiguration
   */
  const loadWiFiConfig = (): WiFiConfig | null => {
    if (process.client) {
      const stored = localStorage.getItem('framolux_wifi_config')
      if (stored) {
        try {
          return JSON.parse(stored)
        } catch {
          return null
        }
      }
    }
    return null
  }

  /**
   * Speichere bekannte Geräte
   */
  const saveKnownDevices = () => {
    if (process.client) {
      const devicesToSave = devices.value.map(d => ({
        deviceId: d.deviceId,
        deviceName: d.deviceName,
        ip: d.ip,
        mac: d.mac,
      }))
      localStorage.setItem('framolux_known_devices', JSON.stringify(devicesToSave))
    }
  }

  /**
   * Lade bekannte Geräte
   */
  const loadKnownDevices = () => {
    if (process.client) {
      const stored = localStorage.getItem('framolux_known_devices')
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          // Prüfe Status der bekannten Geräte
          parsed.forEach(async (device: any) => {
            const status = await checkDeviceStatus(device.ip)
            if (status) {
              devices.value.push({
                ...device,
                status: 'online',
                frameCount: status.frameCount,
                ssid: '',
                rssi: 0,
              })
            }
          })
        } catch {
          // Ignore errors
        }
      }
    }
  }

  /**
   * Sende Test-Frame an Gerät
   */
  const sendTestFrame = async (ip: string) => {
    try {
      // Erstelle einfachen Test-Frame (16x16 Pixel-Array)
      // Zeige ein grünes Kreuz auf schwarzem Hintergrund
      const pixels: string[][] = []
      for (let y = 0; y < 16; y++) {
        const row: string[] = []
        for (let x = 0; x < 16; x++) {
          // Grünes Kreuz in der Mitte
          if (x === 8 || y === 8) {
            row.push('#00FF00')
          } else {
            row.push('#000000')
          }
        }
        pixels.push(row)
      }

      const testFrame = {
        pixels,
        duration: 3000,
      }

      const response = await $fetch(`http://${ip}/frames`, {
        method: 'POST',
        body: {
          description: 'Test Animation',
          loop: true,
          frames: [testFrame],
        },
      })

      return { success: true, response }
    } catch (error) {
      console.error('Test frame failed:', error)
      return { success: false, error }
    }
  }

  return {
    devices,
    selectedDevice,
    isScanning,
    isUploading,
    uploadProgress,
    scanForDevices,
    connectToDevice,
    checkFramoluxFirmware,
    checkDeviceStatus,
    uploadFramesToDevice,
    getFramesFromDevice,
    clearFramesOnDevice,
    renameDevice,
    generateBuildCommand,
    saveWiFiConfig,
    loadWiFiConfig,
    saveKnownDevices,
    loadKnownDevices,
    sendTestFrame,
  }
}
