/**
 * Composable für Matrix-Transformationen
 * Handhabt die Umwandlung zwischen Display-Matrix und physischer LED-Matrix
 */

export const useMatrixTransform = () => {
  /**
   * Transformiert eine Matrix für die physische LED-Anordnung
   * 1. Dreht die Matrix um 90° gegen den Uhrzeigersinn
   * 2. Spiegelt die Matrix horizontal
   * 
   * @param matrix - 16x16 Matrix von Hex-Farbwerten
   * @returns Transformierte 16x16 Matrix
   */
  const transformForPhysicalMatrix = (matrix: string[][]): string[][] => {
    const size = matrix.length
    
    // Schritt 1: 90° gegen den Uhrzeigersinn drehen
    // Bei 90° CCW: neue[y][x] = alte[x][size-1-y]
    const rotated: string[][] = Array(size).fill(null).map(() => Array(size).fill('#000000'))
    
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        rotated[y]![x] = matrix[x]?.[size - 1 - y] ?? '#000000'
      }
    }
    
    // Schritt 2: Horizontal spiegeln
    // Bei horizontaler Spiegelung: neue[y][x] = alte[y][size-1-x]
    const flipped: string[][] = Array(size).fill(null).map(() => Array(size).fill('#000000'))
    
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        flipped[y]![x] = rotated[y]?.[size - 1 - x] ?? '#000000'
      }
    }
    
    return flipped
  }

  /**
   * Inverse Transformation (für Display-Zwecke)
   * Konvertiert von physischer Matrix zurück zu Display-Matrix
   */
  const transformFromPhysicalMatrix = (matrix: string[][]): string[][] => {
    const size = matrix.length
    
    // Inverse: Erst horizontal spiegeln, dann 90° im Uhrzeigersinn drehen
    
    // Schritt 1: Horizontal spiegeln
    const unflipped: string[][] = Array(size).fill(null).map(() => Array(size).fill('#000000'))
    
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        unflipped[y]![x] = matrix[y]?.[size - 1 - x] ?? '#000000'
      }
    }
    
    // Schritt 2: 90° im Uhrzeigersinn drehen
    // Bei 90° CW: neue[y][x] = alte[size-1-x][y]
    const unrotated: string[][] = Array(size).fill(null).map(() => Array(size).fill('#000000'))
    
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        unrotated[y]![x] = unflipped[size - 1 - x]?.[y] ?? '#000000'
      }
    }
    
    return unrotated
  }

  return {
    transformForPhysicalMatrix,
    transformFromPhysicalMatrix
  }
}
