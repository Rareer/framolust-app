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
        
        // Starte Serial Reader
        readSerialOutput()
        
        // Trigger Reset um Boot-Meldungen zu sehen
        addLog('Triggering ESP8266 reset to detect firmware...')
        try {
          const portWithSignals = requestedPort as any
          
          // Methode 1: Standard DTR/RTS Reset
          await portWithSignals.setSignals({ dataTerminalReady: false, requestToSend: true })
          await new Promise(resolve => setTimeout(resolve, 250))
          await portWithSignals.setSignals({ dataTerminalReady: false, requestToSend: false })
          await new Promise(resolve => setTimeout(resolve, 250))
          
          // Methode 2: Alternative Reset-Sequenz
          await portWithSignals.setSignals({ dataTerminalReady: true, requestToSend: false })
          await new Promise(resolve => setTimeout(resolve, 100))
          await portWithSignals.setSignals({ dataTerminalReady: false, requestToSend: false })
          
          addLog('✓ Reset triggered - waiting for boot messages...')
        } catch (e) {
          console.error('Reset error:', e)
          addLog('⚠ Automatic reset failed')
          addLog('Trying to detect firmware from current state...')
        }
        
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
      let noOutputTimeout: NodeJS.Timeout | null = null
      
      // Timeout: Wenn 5 Sekunden keine Framolux-Meldung kommt, als "unbekannt" markieren
      noOutputTimeout = setTimeout(() => {
        if (!isFramoluxFirmware.value) {
          addLog('⚠ No Framolux firmware identifier detected in serial output')
          addLog('This might be a different firmware or the device did not reset')
        }
      }, 5000)
      
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        
        buffer += value
        
        // Prüfe auf Framolux Firmware Identifier
        if (buffer.includes('FRAMOLUX FIRMWARE')) {
          if (noOutputTimeout) clearTimeout(noOutputTimeout)
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
   * Stoppe Serial Reader
   */
  const stopSerialReader = async () => {
    if (reader) {
      try {
        await reader.cancel()
        reader.releaseLock()
        reader = null
        addLog('✓ Serial reader stopped')
      } catch (error) {
        console.error('Error stopping reader:', error)
      }
    }
  }

  /**
   * Trenne Verbindung
   */
  const disconnect = async () => {
    if (port) {
      try {
        // Stoppe Reader zuerst
        await stopSerialReader()
        
        // Warte kurz
        await new Promise(resolve => setTimeout(resolve, 100))
        
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
        isFramoluxFirmware.value = false
      } catch (error: any) {
        console.error('Failed to disconnect:', error)
        // Auch bei Fehler aufräumen
        port = null
        transport = null
        esploader = null
        reader = null
        isConnected.value = false
        isFramoluxFirmware.value = false
        
        // Ignoriere "already closed" Fehler
        if (!error?.message?.includes('already closed') && !error?.message?.includes('locked')) {
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
      
      // Stoppe Serial Reader zuerst (wichtig!)
      addLog('Stopping serial reader...')
      await stopSerialReader()
      await new Promise(resolve => setTimeout(resolve, 200))
      
      // Schließe Port falls offen (Transport wird ihn neu öffnen)
      const portInfo = port as any
      if (portInfo.readable || portInfo.writable) {
        addLog('Closing port for flash process...')
        try {
          await port.close()
          // Warte kurz damit Port wirklich geschlossen ist
          await new Promise(resolve => setTimeout(resolve, 200))
        } catch (e) {
          console.log('Error closing port:', e)
          // Ignoriere Fehler beim Schließen
        }
      }
      
      // Warte nochmal kurz bevor Transport initialisiert wird
      await new Promise(resolve => setTimeout(resolve, 200))
      
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
      
      // Flash erfolgreich - bereite Serial Monitor vor
      addLog('\n=================================')
      addLog('Flash complete! Preparing Serial Monitor...')
      addLog('=================================\n')
      
      // Cleanup: Transport und ESPLoader beenden
      try {
        if (transport) {
          await transport.disconnect()
          transport = null
        }
        esploader = null
      } catch (e) {
        console.log('Transport cleanup:', e)
      }
      
      // Warte bis ESP8266 neu startet
      addLog('Waiting for ESP8266 to restart...')
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      // Öffne Port neu für Serial Monitor
      addLog('Starting Serial Monitor...')
      try {
        // Port sollte noch offen sein, aber nicht gelockt
        const portInfo = port as any
        if (!portInfo.readable || !portInfo.writable) {
          await port.open({ baudRate: 115200 })
        }
        
        isConnected.value = true
        
        // Starte Serial Reader
        readSerialOutput()
        
        addLog('✓ Serial Monitor active - watching boot output...')
        addLog('Look for "AP SSID:" and "IP address:" below\n')
      } catch (error: any) {
        console.error('Serial Monitor error:', error)
        addLog('⚠ Could not start Serial Monitor automatically')
        addLog('Please disconnect and reconnect to see serial output')
      }
      
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

  /**
   * Sende Command über Serial
   */
  const sendCommand = async (command: string) => {
    if (!port || !port.writable) {
      addLog('✗ Port not connected')
      return false
    }

    try {
      const writer = port.writable.getWriter()
      const encoder = new TextEncoder()
      await writer.write(encoder.encode(command + '\n'))
      writer.releaseLock()
      addLog(`→ Sent: ${command}`)
      return true
    } catch (error) {
      console.error('Send command error:', error)
      addLog('✗ Failed to send command')
      return false
    }
  }

  /**
   * Konfiguriere WiFi über Serial
   */
  const configureWiFiViaSerial = async (ssid: string, password: string) => {
    addLog('Configuring WiFi via Serial...')
    const command = `SET_WIFI:${ssid}:${password}:`
    return await sendCommand(command)
  }

  /**
   * Setze Device-Namen über Serial
   */
  const setDeviceNameViaSerial = async (name: string) => {
    addLog('Setting device name via Serial...')
    const command = `SET_NAME:${name}`
    return await sendCommand(command)
  }

  /**
   * Hole Device-Status über Serial
   */
  const getDeviceStatus = async () => {
    addLog('Requesting device status...')
    return await sendCommand('GET_STATUS')
  }

  /**
   * Setze OpenAI API Key über Serial
   */
  const setApiKeyViaSerial = async (apiKey: string) => {
    addLog('Setting OpenAI API Key via Serial...')
    const command = `SET_APIKEY:${apiKey}`
    return await sendCommand(command)
  }

  /**
   * Hole API Key Status über Serial
   */
  const getApiKeyStatus = async () => {
    addLog('Requesting API Key status...')
    return await sendCommand('GET_APIKEY')
  }

  /**
   * Lösche API Key über Serial
   */
  const deleteApiKey = async () => {
    addLog('Deleting API Key...')
    return await sendCommand('DELETE_APIKEY')
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
    sendCommand,
    configureWiFiViaSerial,
    setDeviceNameViaSerial,
    getDeviceStatus,
    setApiKeyViaSerial,
    getApiKeyStatus,
    deleteApiKey,
  }
}
