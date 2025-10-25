import { ref, computed } from 'vue'

// Web Serial API Type Definitions
declare global {
  interface SerialPortRequestOptions {
    filters?: SerialPortFilter[]
  }

  interface SerialPortFilter {
    usbVendorId?: number
    usbProductId?: number
  }

  interface SerialOptions {
    baudRate: number
    dataBits?: 7 | 8
    stopBits?: 1 | 2
    parity?: 'none' | 'even' | 'odd'
    bufferSize?: number
    flowControl?: 'none' | 'hardware'
  }

  interface SerialPort {
    readonly readable: ReadableStream<Uint8Array> | null
    readonly writable: WritableStream<Uint8Array> | null
    
    open(options: SerialOptions): Promise<void>
    close(): Promise<void>
    
    getInfo(): SerialPortInfo
  }

  interface SerialPortInfo {
    usbVendorId?: number
    usbProductId?: number
  }

  interface Serial extends EventTarget {
    getPorts(): Promise<SerialPort[]>
    requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>
  }

  interface Navigator {
    readonly serial: Serial
  }
}

export interface PortInfo {
  connected: boolean
  port: SerialPort | null
  reader: ReadableStreamDefaultReader<Uint8Array> | null
  writer: WritableStreamDefaultWriter<Uint8Array> | null
}

const port = ref<SerialPort | null>(null)
const reader = ref<ReadableStreamDefaultReader<Uint8Array> | null>(null)
const writer = ref<WritableStreamDefaultWriter<Uint8Array> | null>(null)
const isConnected = ref(false)
const isSupported = ref(false)
const error = ref<string | null>(null)

export const useSerialPort = () => {
  // Check if Web Serial API is supported
  const checkSupport = () => {
    if (typeof window !== 'undefined' && 'serial' in navigator) {
      isSupported.value = true
      return true
    }
    isSupported.value = false
    error.value = 'Web Serial API wird von diesem Browser nicht unterstützt'
    return false
  }

  // Request port from user
  const requestPort = async () => {
    if (!checkSupport()) return false

    try {
      error.value = null
      
      // Request a port with optional filters for ESP8266
      const selectedPort = await navigator.serial.requestPort({
        filters: [
          // Common ESP8266 USB-to-Serial chips
          { usbVendorId: 0x10c4, usbProductId: 0xea60 }, // Silicon Labs CP210x
          { usbVendorId: 0x1a86, usbProductId: 0x7523 }, // CH340
          { usbVendorId: 0x0403, usbProductId: 0x6001 }, // FTDI FT232
        ]
      })

      port.value = selectedPort
      return true
    } catch (err: any) {
      if (err.name === 'NotFoundError') {
        error.value = 'Kein Gerät ausgewählt'
      } else {
        error.value = `Fehler beim Auswählen des Ports: ${err.message}`
      }
      return false
    }
  }

  // Connect to the selected port
  const connect = async (baudRate: number = 115200) => {
    if (!port.value) {
      error.value = 'Kein Port ausgewählt. Bitte zuerst ein Gerät auswählen.'
      return false
    }

    try {
      error.value = null

      // Open the port with ESP8266 typical settings
      await port.value.open({
        baudRate,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        flowControl: 'none'
      })

      // Get reader and writer
      if (port.value.readable && port.value.writable) {
        reader.value = port.value.readable.getReader()
        writer.value = port.value.writable.getWriter()
        isConnected.value = true
        return true
      }

      error.value = 'Port konnte nicht geöffnet werden'
      return false
    } catch (err: any) {
      // Provide helpful error messages
      if (err.name === 'InvalidStateError' || err.message.includes('Failed to open')) {
        error.value = 'Port ist bereits in Verwendung. Bitte schließe andere Programme (z.B. Arduino IDE, Serial Monitor) und versuche es erneut.'
      } else if (err.name === 'NetworkError') {
        error.value = 'Gerät wurde getrennt oder ist nicht mehr verfügbar.'
      } else if (err.name === 'NotFoundError') {
        error.value = 'Gerät nicht gefunden. Bitte überprüfe die USB-Verbindung.'
      } else {
        error.value = `Verbindungsfehler: ${err.message}`
      }
      
      isConnected.value = false
      port.value = null
      return false
    }
  }

  // Disconnect from port
  const disconnect = async () => {
    try {
      error.value = null

      // Release reader
      if (reader.value) {
        await reader.value.cancel()
        reader.value.releaseLock()
        reader.value = null
      }

      // Release writer
      if (writer.value) {
        await writer.value.close()
        writer.value = null
      }

      // Close port
      if (port.value) {
        await port.value.close()
        port.value = null
      }

      isConnected.value = false
      return true
    } catch (err: any) {
      error.value = `Fehler beim Trennen: ${err.message}`
      return false
    }
  }

  // Send data to ESP8266
  const sendData = async (data: string | Uint8Array) => {
    if (!writer.value || !isConnected.value) {
      error.value = 'Nicht verbunden'
      return false
    }

    try {
      error.value = null
      const bytes = typeof data === 'string' 
        ? new TextEncoder().encode(data)
        : data

      await writer.value.write(bytes)
      return true
    } catch (err: any) {
      error.value = `Fehler beim Senden: ${err.message}`
      return false
    }
  }

  // Read data from ESP8266
  const readData = async (): Promise<string | null> => {
    if (!reader.value || !isConnected.value) {
      error.value = 'Nicht verbunden'
      return null
    }

    try {
      error.value = null
      const { value, done } = await reader.value.read()
      
      if (done) {
        return null
      }

      return new TextDecoder().decode(value)
    } catch (err: any) {
      error.value = `Fehler beim Lesen: ${err.message}`
      return null
    }
  }

  // Send LED matrix data to ESP8266
  const sendLEDMatrix = async (pixels: string[][]) => {
    if (!isConnected.value) {
      error.value = 'Nicht mit ESP8266 verbunden'
      return false
    }

    try {
      // Convert pixel colors to a format the ESP8266 can understand
      // Format: JSON with RGB values
      const matrixData = {
        type: 'matrix',
        width: pixels[0]?.length || 0,
        height: pixels.length,
        pixels: pixels.flat().map(color => {
          // Convert hex color to RGB
          const hex = color.replace('#', '')
          const r = parseInt(hex.substring(0, 2), 16)
          const g = parseInt(hex.substring(2, 4), 16)
          const b = parseInt(hex.substring(4, 6), 16)
          return [r, g, b]
        })
      }

      const jsonString = JSON.stringify(matrixData) + '\n'
      return await sendData(jsonString)
    } catch (err: any) {
      error.value = `Fehler beim Senden der Matrix: ${err.message}`
      return false
    }
  }

  // Get list of already authorized ports
  const getAuthorizedPorts = async () => {
    if (!checkSupport()) return []

    try {
      const ports = await navigator.serial.getPorts()
      return ports
    } catch (err: any) {
      error.value = `Fehler beim Abrufen der Ports: ${err.message}`
      return []
    }
  }

  // Auto-connect to previously authorized port
  const autoConnect = async (baudRate: number = 115200) => {
    const ports = await getAuthorizedPorts()
    
    if (ports.length > 0 && ports[0]) {
      port.value = ports[0]
      return await connect(baudRate)
    }

    return false
  }

  return {
    // State
    port: computed(() => port.value),
    isConnected: computed(() => isConnected.value),
    isSupported: computed(() => isSupported.value),
    error: computed(() => error.value),
    
    // Methods
    checkSupport,
    requestPort,
    connect,
    disconnect,
    sendData,
    readData,
    sendLEDMatrix,
    getAuthorizedPorts,
    autoConnect
  }
}
