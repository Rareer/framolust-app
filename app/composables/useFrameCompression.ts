/**
 * Frame-Kompression für ESP8266
 * Konvertiert Pixel-Arrays zu binärem Format für effiziente Speicherung
 */

export interface PixelFrame {
  pixels: string[][]
  duration: number
}

export interface Animation {
  description: string
  loop: boolean
  frames: PixelFrame[]
}

export const useFrameCompression = () => {
  
  /**
   * Rotiere Pixel-Matrix um 180°
   * Korrigiert die Orientierung für das physische LED-Panel
   */
  const rotateMatrix180 = (matrix: string[][]): string[][] => {
    const height = matrix.length
    const width = matrix[0]?.length || 0
    
    // Erstelle neue Matrix mit gleichen Dimensionen
    const rotated: string[][] = Array(height).fill(null).map(() => Array(width).fill('#000000'))
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // 180° Rotation: (x, y) -> (width - 1 - x, height - 1 - y)
        const pixel = matrix[y]?.[x] || '#000000'
        const targetRow = rotated[height - 1 - y]
        if (targetRow) {
          targetRow[width - 1 - x] = pixel
        }
      }
    }
    
    return rotated
  }
  
  /**
   * Konvertiere Hex-Farbe zu RGB-Bytes
   */
  const hexToRGB = (hex: string): [number, number, number] => {
    const clean = hex.replace('#', '')
    const r = parseInt(clean.substring(0, 2), 16)
    const g = parseInt(clean.substring(2, 4), 16)
    const b = parseInt(clean.substring(4, 6), 16)
    return [r, g, b]
  }
  
  /**
   * Konvertiere einzelnen Frame zu binärem Format
   * 
   * Format:
   * - Header (8 Bytes):
   *   - duration: uint32_t (4 Bytes, Little-Endian)
   *   - width: uint8_t (1 Byte)
   *   - height: uint8_t (1 Byte)
   *   - reserved: uint16_t (2 Bytes)
   * - Pixel-Daten (width × height × 3 Bytes):
   *   - R, G, B (je 1 Byte)
   */
  const compressFrame = (frame: PixelFrame): Uint8Array => {
    // Rotiere die Pixel-Matrix um 180° für korrekte Orientierung
    const rotatedPixels = rotateMatrix180(frame.pixels)
    
    const width = rotatedPixels[0]?.length || 16
    const height = rotatedPixels.length || 16
    
    // Header: 8 Bytes
    const header = new Uint8Array(8)
    const view = new DataView(header.buffer)
    view.setUint32(0, frame.duration, true) // Little-endian
    view.setUint8(4, width)
    view.setUint8(5, height)
    view.setUint16(6, 0, true) // Reserved
    
    // Pixel-Daten: width × height × 3 Bytes
    const pixels = new Uint8Array(width * height * 3)
    let offset = 0
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const hex = rotatedPixels[y]?.[x] || '#000000'
        const [r, g, b] = hexToRGB(hex)
        
        pixels[offset++] = r
        pixels[offset++] = g
        pixels[offset++] = b
      }
    }
    
    // Kombiniere Header + Pixels
    const result = new Uint8Array(header.length + pixels.length)
    result.set(header, 0)
    result.set(pixels, header.length)
    
    return result
  }
  
  /**
   * Konvertiere komplette Animation zu binärem Format
   * 
   * Format:
   * - Animation-Header (16 Bytes):
   *   - magic: "FMLX" (4 Bytes)
   *   - version: uint16_t (2 Bytes)
   *   - frameCount: uint16_t (2 Bytes)
   *   - loop: uint8_t (1 Byte)
   *   - reserved: 7 Bytes
   * - Frames: [Frame1][Frame2][Frame3]...
   */
  const compressAnimation = (animation: Animation): Uint8Array => {
    // Animation-Header: 16 Bytes
    const header = new Uint8Array(16)
    const view = new DataView(header.buffer)
    
    // Magic: "FMLX"
    header[0] = 0x46 // 'F'
    header[1] = 0x4D // 'M'
    header[2] = 0x4C // 'L'
    header[3] = 0x58 // 'X'
    
    view.setUint16(4, 1, true) // Version 1
    view.setUint16(6, animation.frames.length, true)
    view.setUint8(8, animation.loop ? 1 : 0)
    // Bytes 9-15: Reserved (already 0)
    
    // Komprimiere alle Frames
    const compressedFrames = animation.frames.map(compressFrame)
    
    // Berechne Gesamtgröße
    const totalSize = header.length + compressedFrames.reduce(
      (sum, frame) => sum + frame.length, 
      0
    )
    
    // Kombiniere alles
    const result = new Uint8Array(totalSize)
    let offset = 0
    
    result.set(header, offset)
    offset += header.length
    
    for (const frame of compressedFrames) {
      result.set(frame, offset)
      offset += frame.length
    }
    
    return result
  }
  
  /**
   * Berechne Kompressionsrate
   */
  const calculateCompressionStats = (animation: Animation) => {
    // JSON-Größe schätzen
    const jsonStr = JSON.stringify(animation)
    const jsonSize = new TextEncoder().encode(jsonStr).length
    
    // Binär-Größe
    const binary = compressAnimation(animation)
    const binarySize = binary.length
    
    const savings = ((jsonSize - binarySize) / jsonSize * 100).toFixed(1)
    
    return {
      jsonSize,
      binarySize,
      savings: parseFloat(savings),
      ratio: (jsonSize / binarySize).toFixed(2)
    }
  }
  
  /**
   * Dekomprimiere binäres Format zurück zu Animation (für Tests)
   */
  const decompressAnimation = (binary: Uint8Array): Animation | null => {
    try {
      const view = new DataView(binary.buffer)
      
      // Lese Animation-Header
      const magic = String.fromCharCode(
        binary[0] ?? 0, 
        binary[1] ?? 0, 
        binary[2] ?? 0, 
        binary[3] ?? 0
      )
      if (magic !== 'FMLX') {
        console.error('Invalid magic bytes:', magic)
        return null
      }
      
      const version = view.getUint16(4, true)
      const frameCount = view.getUint16(6, true)
      const loop = view.getUint8(8) === 1
      
      if (frameCount === 0 || frameCount > 1000) {
        console.error('Invalid frame count:', frameCount)
        return null
      }
      
      console.log(`Binary format: v${version}, ${frameCount} frames, loop=${loop}`)
      
      // Lese Frames
      let offset = 16 // Nach Animation-Header
      const frames: PixelFrame[] = []
      
      for (let i = 0; i < frameCount; i++) {
        // Lese Frame-Header
        const duration = view.getUint32(offset, true)
        const width = view.getUint8(offset + 4)
        const height = view.getUint8(offset + 5)
        offset += 8
        
        // Lese Pixel-Daten
        const pixels: string[][] = []
        for (let y = 0; y < height; y++) {
          const row: string[] = []
          for (let x = 0; x < width; x++) {
            const r = binary[offset++] ?? 0
            const g = binary[offset++] ?? 0
            const b = binary[offset++] ?? 0
            
            const hex = '#' + 
              r.toString(16).padStart(2, '0') +
              g.toString(16).padStart(2, '0') +
              b.toString(16).padStart(2, '0')
            
            row.push(hex.toUpperCase())
          }
          pixels.push(row)
        }
        
        frames.push({ pixels, duration })
      }
      
      return {
        description: 'Decompressed animation',
        loop,
        frames
      }
    } catch (error) {
      console.error('Decompression error:', error)
      return null
    }
  }
  
  return {
    compressFrame,
    compressAnimation,
    calculateCompressionStats,
    decompressAnimation,
  }
}
