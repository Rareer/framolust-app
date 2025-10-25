/**
 * Composable für Web Serial API
 * Ermöglicht direktes Flashen von ESP8266 aus dem Browser
 */

import { ESPLoader, Transport } from 'esptool-js'

export const useWebSerial = () => {
  const isSupported = ref(false)
  const isConnected = ref(false)
  const isFlashing = ref(false)
  const flashProgress = ref(0)
  const flashLog = ref<string[]>([])
  const isFramoluxFirmware = ref(false)
  const firmwareVersion = ref<string>('')
  
  let port: SerialPort | null = null
  let transport: Transport | null = null
  let esploader: ESPLoader | null = null
  let reader: ReadableStreamDefaultReader | null = null

  /**
   * Prüfe ob Web Serial API unterstützt wird
   */
  const checkSupport = () => {
    if (process.client) {
      isSupported.value = 'serial' in navigator
    }
    return isSupported.value
  }

  /**
   * Verbinde mit ESP8266 via Serial Port
   * Zeigt IMMER den Browser-Dialog zur Port-Auswahl
   */
  const connect = async () => {
    if (!checkSupport()) {
      throw new Error('Web Serial API not supported in this browser')
    }

    try {
      // Schließe existierenden Port falls vorhanden
      if (port) {
        try {
          const portInfo = port as any
          if (portInfo.readable || portInfo.writable) {
            await port.close()
            await new Promise(resolve => setTimeout(resolve, 100))
          }
        } catch (e) {
          console.log('Error closing existing port:', e)
        }
        port = null
        isConnected.value = false
      }

      // Zeige IMMER Browser-Dialog zur Port-Auswahl
      addLog('Please select serial port...')
      const requestedPort = await navigator.serial.requestPort()
      
      // Prüfe ob dieser Port bereits offen ist
      const portInfo = requestedPort as any
      if (portInfo.readable && portInfo.writable) {
        // Port ist bereits offen - verwende ihn
        port = requestedPort
        isConnected.value = true
        addLog('✓ Port already open, using existing connection')
        
        // Überwache Disconnect
        setupDisconnectListener()
        return true
      }
      
      // Open Port
      try {
        await requestedPort.open({ baudRate: 115200 })
        port = requestedPort
        isConnected.value = true
        addLog('✓ Connected to device')
        
        // Überwache Disconnect
        setupDisconnectListener()
        
        // Lese Serial Output um Firmware zu erkennen
        readSerialOutput()
        
        return true
      } catch (openError: any) {
        // Falls Port bereits offen ist, verwende ihn trotzdem
        if (openError?.message?.includes('already open')) {
          port = requestedPort
          isConnected.value = true
          addLog('✓ Port already open, using existing connection')
          
          // Überwache Disconnect
          setupDisconnectListener()
          return true
        }
        throw openError
      }
    } catch (error: any) {
      // User hat Dialog abgebrochen
      if (error?.name === 'NotFoundError') {
        addLog('Port selection cancelled')
        return false
      }
      
      console.error('Failed to connect:', error)
      addLog('✗ Connection failed: ' + error)
      throw error
    }
  }

  /**
   * Überwache physische Trennung des Geräts
   */
  const setupDisconnectListener = () => {
    if (!port) return
    
    const portInfo = port as any
    if (portInfo.addEventListener) {
      portInfo.addEventListener('disconnect', () => {
        console.log('Device physically disconnected')
        addLog('⚠ Device disconnected')
        port = null
        transport = null
        esploader = null
        reader = null
        isConnected.value = false
        isFramoluxFirmware.value = false
      })
    }
  }

  /**
   * Lese Serial Output und erkenne Firmware
   */
  const readSerialOutput = async () => {
    if (!port || !port.readable) return

    try {
      const textDecoder = new TextDecoderStream()
      port.readable.pipeTo(textDecoder.writable as any)
      reader = textDecoder.readable.getReader()

      let buffer = ''
      
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        
        buffer += value
        
        // Prüfe auf Framolux Firmware Identifier
        if (buffer.includes('FRAMOLUX FIRMWARE')) {
          isFramoluxFirmware.value = true
          addLog('✓ Framolux Firmware detected!')
          
          // Extrahiere Version
          const versionMatch = buffer.match(/Version:\s*(\S+)/)
          if (versionMatch && versionMatch[1]) {
            firmwareVersion.value = versionMatch[1]
            addLog(`✓ Firmware Version: ${firmwareVersion.value}`)
          }
        }
        
        // Zeige Serial Output im Log
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        lines.forEach(line => {
          if (line.trim()) {
            addLog(`[Serial] ${line.trim()}`)
          }
        })
      }
    } catch (error) {
      console.error('Error reading serial:', error)
    } finally {
      reader?.releaseLock()
    }
  }

  /**
   * Trenne Verbindung
   */
  const disconnect = async () => {
    if (port) {
      try {
        // Prüfe ob Port offen ist bevor wir versuchen zu schließen
        const portInfo = port as any
        if (portInfo.readable || portInfo.writable) {
          await port.close()
          addLog('✓ Disconnected')
        } else {
          addLog('✓ Port was already closed')
        }
        
        port = null
        transport = null
        esploader = null
        isConnected.value = false
      } catch (error: any) {
        console.error('Failed to disconnect:', error)
        // Auch bei Fehler aufräumen
        port = null
        transport = null
        esploader = null
        isConnected.value = false
        
        // Ignoriere "already closed" Fehler
        if (!error?.message?.includes('already closed')) {
          addLog('⚠ Disconnect error (ignored): ' + error.message)
        }
      }
    }
  }

  /**
   * Flashe Firmware auf ESP8266
   */
  const flashFirmware = async (firmwareUrl: string, deviceId?: string) => {
    if (!port) {
      throw new Error('Not connected to device')
    }

    isFlashing.value = true
    flashProgress.value = 0
    flashLog.value = []

    try {
      addLog('Starting flash process...')
      
      // Lade Firmware
      addLog('Downloading firmware...')
      const response = await fetch(firmwareUrl)
      if (!response.ok) {
        throw new Error('Failed to download firmware')
      }
      
      const firmwareBlob = await response.blob()
      const firmwareBuffer = await firmwareBlob.arrayBuffer()
      
      addLog(`✓ Firmware loaded (${(firmwareBuffer.byteLength / 1024).toFixed(2)} KB)`)
      
      // Schließe Port falls offen (Transport wird ihn neu öffnen)
      const portInfo = port as any
      if (portInfo.readable || portInfo.writable) {
        addLog('Closing port for flash process...')
        try {
          await port.close()
          // Warte kurz damit Port wirklich geschlossen ist
          await new Promise(resolve => setTimeout(resolve, 100))
        } catch (e) {
          console.log('Error closing port:', e)
          // Ignoriere Fehler beim Schließen
        }
      }
      
      // Warte nochmal kurz bevor Transport initialisiert wird
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Initialisiere Transport (öffnet Port intern)
      addLog('Initializing transport...')
      transport = new Transport(port)
      
      // Initialisiere ESP Loader
      esploader = new ESPLoader({
        transport,
        baudrate: 115200,
        romBaudrate: 115200,
        terminal: {
          clean: () => {},
          writeLine: (line: string) => addLog(line),
          write: (text: string) => addLog(text),
        },
      } as any)

      // Verbinde mit Chip
      addLog('Connecting to ESP8266...')
      const chip = await esploader.main()
      addLog(`✓ Connected to ${chip}`)

      // Flash Firmware
      addLog('Erasing flash...')
      flashProgress.value = 10
      
      // Konvertiere ArrayBuffer zu String für esptool-js
      const firmwareArray = new Uint8Array(firmwareBuffer)
      let firmwareString = ''
      for (let i = 0; i < firmwareArray.length; i++) {
        const byte = firmwareArray[i]
        if (byte !== undefined) {
          firmwareString += String.fromCharCode(byte)
        }
      }
      
      await esploader.writeFlash({
        fileArray: [
          {
            data: firmwareString,
            address: 0x00000,
          },
        ],
        flashSize: 'keep',
        flashMode: 'dio',
        flashFreq: '40m',
        eraseAll: false,
        compress: true,
        reportProgress: (fileIndex: number, written: number, total: number) => {
          const progress = Math.round((written / total) * 90) + 10
          flashProgress.value = progress
        },
      })

      flashProgress.value = 100
      addLog('✓ Flash complete!')
      addLog('Resetting device...')
      
      // Hard Reset
      await esploader.hardReset()
      
      addLog('✓ Device reset successfully')
      addLog('\n=================================')
      addLog('Flash completed successfully!')
      if (deviceId) {
        addLog(`Device ID: ${deviceId}`)
      }
      addLog('=================================\n')
      addLog('Next steps:')
      addLog('1. Device will restart and create WiFi AP')
      addLog('2. Connect to "Framolux-XXXXXX" WiFi')
      addLog('3. Configure your WiFi credentials')
      addLog('4. Device will connect to your network')
      
      // Trenne nach erfolgreichem Flash
      addLog('Disconnecting...')
      await disconnect()
      
      return true
    } catch (error) {
      console.error('Flash failed:', error)
      addLog('✗ Flash failed: ' + error)
      
      // Cleanup bei Fehler
      try {
        await disconnect()
      } catch (e) {
        // Ignoriere Disconnect-Fehler
      }
      
      throw error
    } finally {
      isFlashing.value = false
    }
  }

  /**
   * Füge Log-Eintrag hinzu
   */
  const addLog = (message: string) => {
    flashLog.value.push(message)
    console.log('[WebSerial]', message)
  }

  /**
   * Lösche Log
   */
  const clearLog = () => {
    flashLog.value = []
  }

  // Check support on mount
  if (process.client) {
    checkSupport()
  }

  return {
    isSupported,
    isConnected,
    isFlashing,
    flashProgress,
    flashLog,
    isFramoluxFirmware,
    firmwareVersion,
    connect,
    disconnect,
    flashFirmware,
    clearLog,
  }
}
