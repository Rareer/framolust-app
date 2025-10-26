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

// Global state (shared across all component instances)
const devices = ref<ESP8266Device[]>([])
const selectedDevice = ref<ESP8266Device | null>(null)
const isScanning = ref(false)
const isUploading = ref(false)
const uploadProgress = ref(0)
const isDeviceOnline = ref(false)
const lastPingTime = ref<number | null>(null)
let healthCheckInterval: NodeJS.Timeout | null = null

// Lade gespeichertes Gerät beim Start
if (process.client) {
  const savedDevice = localStorage.getItem('framolux_selected_device')
  if (savedDevice) {
    try {
      selectedDevice.value = JSON.parse(savedDevice)
      console.log('📱 Restored selected device from localStorage:', selectedDevice.value)
    } catch (e) {
      console.error('Failed to restore selected device:', e)
    }
  }
}

// Speichere selectedDevice automatisch
if (process.client) {
  watch(selectedDevice, (newDevice) => {
    if (newDevice) {
      localStorage.setItem('framolux_selected_device', JSON.stringify(newDevice))
      console.log('💾 Saved selected device to localStorage:', newDevice)
    } else {
      localStorage.removeItem('framolux_selected_device')
      console.log('🗑️ Removed selected device from localStorage')
    }
  }, { deep: true })
}

export const useESP8266 = () => {

  /**
   * Ping ein Gerät um zu prüfen ob es erreichbar ist
   */
  const pingDevice = async (ip: string, timeout: number = 2000): Promise<boolean> => {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)
      
      const response = await fetch(`http://${ip}/api/info`, {
        method: 'GET',
        signal: controller.signal,
        mode: 'cors',
      })
      
      clearTimeout(timeoutId)
      
      if (response.ok) {
        lastPingTime.value = Date.now()
        return true
      }
      return false
    } catch (error) {
      // Device nicht erreichbar
      return false
    }
  }

  /**
   * Starte automatischen Health-Check für das ausgewählte Gerät
   */
  const startHealthCheck = (intervalMs: number = 10000) => {
    // Stoppe vorherigen Interval falls vorhanden
    stopHealthCheck()
    
    // Initiales Ping
    if (selectedDevice.value) {
      pingDevice(selectedDevice.value.ip).then(online => {
        isDeviceOnline.value = online
        if (selectedDevice.value) {
          selectedDevice.value.status = online ? 'online' : 'offline'
        }
      })
    }
    
    // Starte regelmäßiges Pingen
    healthCheckInterval = setInterval(async () => {
      if (selectedDevice.value) {
        const online = await pingDevice(selectedDevice.value.ip)
        isDeviceOnline.value = online
        selectedDevice.value.status = online ? 'online' : 'offline'
        
        if (!online) {
          console.warn(`⚠️ Device ${selectedDevice.value.deviceName} (${selectedDevice.value.ip}) is offline`)
        }
      } else {
        // Kein Gerät ausgewählt, stoppe Health-Check
        stopHealthCheck()
      }
    }, intervalMs)
  }

  /**
   * Stoppe automatischen Health-Check
   */
  const stopHealthCheck = () => {
    if (healthCheckInterval) {
      clearInterval(healthCheckInterval)
      healthCheckInterval = null
    }
  }

  /**
   * Scanne nach ESP8266 Geräten im lokalen Netzwerk
   * Client-seitiger IP-Range Scan (funktioniert nur im Browser!)
   */
  const scanForDevices = async (subnet?: string) => {
    isScanning.value = true
    devices.value = []

    try {
      const scanSubnet = subnet || '192.168.1' // Default subnet
      console.log(`Starting device scan on ${scanSubnet}.x...`)
      
      const foundDevices: ESP8266Device[] = []
      const scanPromises: Promise<void>[] = []
      
      // Scanne IP-Range (1-254)
      for (let i = 1; i <= 254; i++) {
        const ip = `${scanSubnet}.${i}`
        
        const scanPromise = (async () => {
          try {
            // Timeout für jeden Request
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 1500) // 1.5s timeout
            
            const response = await fetch(`http://${ip}/api/info`, {
              signal: controller.signal,
              mode: 'cors',
            })
            
            clearTimeout(timeoutId)
            
            if (response.ok) {
              const data = await response.json()
              
              // Prüfe ob es ein Framolux-Gerät ist
              if (data.firmware === 'framolux' || data.deviceId?.startsWith('FLX')) {
                console.log(`✓ Found Framolux device at ${ip}:`, data)
                foundDevices.push({
                  ip,
                  deviceId: data.deviceId,
                  deviceName: data.deviceName || 'Unnamed',
                  firmware: data.firmware,
                  version: data.version,
                  ssid: data.ssid,
                  mac: data.mac || '',
                  rssi: data.rssi || 0,
                  frameCount: data.frameCount || 0,
                  status: 'online',
                })
              }
            }
          } catch (error) {
            // Ignore - device not found or timeout
          }
        })()
        
        scanPromises.push(scanPromise)
      }
      
      // Warte auf alle Scans
      await Promise.all(scanPromises)
      
      console.log(`✓ Scan complete. Found ${foundDevices.length} Framolux device(s).`)
      devices.value = foundDevices
      
      return foundDevices
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
   * Lade Frames auf ESP8266 hoch (Binär-Format)
   */
  const uploadFramesToDevice = async (
    deviceIp: string,
    frames: Array<{ duration: number; pixels: string[][] }>
  ) => {
    isUploading.value = true
    uploadProgress.value = 0

    try {
      const { compressAnimation, calculateCompressionStats } = useFrameCompression()
      
      // Konvertiere zu Animation-Format
      const animation = {
        description: 'Framolux Animation',
        loop: true,
        frames: frames.map(f => ({
          pixels: f.pixels,
          duration: f.duration
        }))
      }
      
      // Komprimiere zu Binär-Format
      const binaryData = compressAnimation(animation)
      
      // Zeige Kompressionsstatistiken
      const stats = calculateCompressionStats(animation)
      console.log(`📦 Compression: ${stats.jsonSize} → ${stats.binarySize} bytes (${stats.savings}% saved)`)
      console.log(`📦 Binary data type:`, binaryData.constructor.name)
      console.log(`📦 First 16 bytes:`, Array.from(binaryData.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '))
      
      // Simuliere Upload-Progress
      const progressInterval = setInterval(() => {
        if (uploadProgress.value < 90) {
          uploadProgress.value += 10
        }
      }, 100)

      // WICHTIG: Verwende fetch statt $fetch für binäre Daten
      // Konvertiere Uint8Array zu Blob für fetch
      const blob = new Blob([binaryData.buffer as ArrayBuffer], { type: 'application/octet-stream' })
      
      const fetchResponse = await fetch(`http://${deviceIp}/frames`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        body: blob,
      })
      
      if (!fetchResponse.ok) {
        throw new Error(`HTTP ${fetchResponse.status}: ${fetchResponse.statusText}`)
      }
      
      const response = await fetchResponse.json() as {
        success: boolean
        frameCount: number
        message: string
      }

      clearInterval(progressInterval)

      uploadProgress.value = 100
      console.log(`✓ Upload successful: ${response.frameCount} frames`)
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
   * Hole gespeicherte Frames vom Gerät (Binär-Format)
   */
  const getFramesFromDevice = async (deviceIp: string) => {
    try {
      // Hole binäre Daten vom ESP8266
      const response = await fetch(`http://${deviceIp}/frames`, {
        method: 'GET',
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      // Lese als ArrayBuffer
      const arrayBuffer = await response.arrayBuffer()
      const binaryData = new Uint8Array(arrayBuffer)

      console.log(`📦 Received ${binaryData.length} bytes from device`)
      console.log(`📦 First 16 bytes:`, Array.from(binaryData.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '))

      // Dekomprimiere mit useFrameCompression
      const { decompressAnimation } = useFrameCompression()
      const animation = decompressAnimation(binaryData)

      if (!animation) {
        throw new Error('Failed to decompress animation')
      }

      console.log(`✓ Decompressed animation: ${animation.frames.length} frames`)
      return animation
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
   * Sende Test-Frame an Gerät (Binär-Format)
   */
  const sendTestFrame = async (ip: string) => {
    try {
      const { compressAnimation } = useFrameCompression()
      
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

      const animation = {
        description: 'Test Animation',
        loop: true,
        frames: [{
          pixels,
          duration: 3000,
        }],
      }

      // Komprimiere zu Binär-Format
      const binaryData = compressAnimation(animation)
      console.log(`📦 Test frame: ${binaryData.length} bytes (binary)`)
      console.log(`📦 Binary data type:`, binaryData.constructor.name)
      console.log(`📦 First 16 bytes:`, Array.from(binaryData.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '))

      // WICHTIG: Verwende fetch statt $fetch für binäre Daten
      // Konvertiere Uint8Array zu Blob für fetch
      const blob = new Blob([binaryData.buffer as ArrayBuffer], { type: 'application/octet-stream' })
      
      const fetchResponse = await fetch(`http://${ip}/frames`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        body: blob,
      })
      
      if (!fetchResponse.ok) {
        const errorText = await fetchResponse.text()
        console.error(`HTTP ${fetchResponse.status}:`, errorText)
        throw new Error(`HTTP ${fetchResponse.status}: ${fetchResponse.statusText}`)
      }
      
      const response = await fetchResponse.json()

      console.log('✓ Test frame uploaded:', response)
      return { success: true, response }
    } catch (error) {
      console.error('Test frame failed:', error)
      return { success: false, error }
    }
  }

  /**
   * Lade Frames vom Gerät und importiere sie in die App
   */
  const loadFramesFromDevice = async (deviceIp: string) => {
    try {
      const animation = await getFramesFromDevice(deviceIp)
      
      if (!animation) {
        throw new Error('No animation data received')
      }

      return animation
    } catch (error) {
      console.error('Failed to load frames from device:', error)
      throw error
    }
  }

  return {
    devices,
    selectedDevice,
    isScanning,
    isUploading,
    uploadProgress,
    isDeviceOnline,
    lastPingTime,
    pingDevice,
    startHealthCheck,
    stopHealthCheck,
    scanForDevices,
    connectToDevice,
    checkFramoluxFirmware,
    checkDeviceStatus,
    uploadFramesToDevice,
    getFramesFromDevice,
    loadFramesFromDevice,
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
