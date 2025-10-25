/**
 * API Endpoint für ESP8266 Device Discovery
 * Scannt das lokale Netzwerk nach Framolux-Geräten
 */

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const subnet = query.subnet as string || '192.168.1' // Default subnet
    
    console.log(`Scanning subnet ${subnet}.x for Framolux devices...`)
    
    const devices: any[] = []
    const scanPromises: Promise<void>[] = []
    
    // Scanne IP-Range (z.B. 192.168.1.1 - 192.168.1.254)
    for (let i = 1; i <= 254; i++) {
      const ip = `${subnet}.${i}`
      
      const scanPromise = (async () => {
        try {
          // Versuche HTTP Request zum ESP8266
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 1000) // 1s timeout
          
          const response = await fetch(`http://${ip}/api/info`, {
            signal: controller.signal,
            headers: {
              'Accept': 'application/json',
            },
          })
          
          clearTimeout(timeoutId)
          
          if (response.ok) {
            const data = await response.json()
            
            // Prüfe ob es ein Framolux-Gerät ist
            if (data.firmware === 'framolux' || data.deviceId?.startsWith('FLX')) {
              console.log(`Found Framolux device at ${ip}:`, data)
              devices.push({
                ip,
                deviceId: data.deviceId,
                deviceName: data.deviceName || 'Unnamed',
                firmware: data.firmware,
                version: data.version,
                ssid: data.ssid,
                frameCount: data.frameCount || 0,
              })
            }
          }
        } catch (error) {
          // Ignore - device not found or timeout
        }
      })()
      
      scanPromises.push(scanPromise)
    }
    
    // Warte auf alle Scans (max 1s pro IP)
    await Promise.all(scanPromises)
    
    console.log(`Discovery complete. Found ${devices.length} Framolux devices.`)
    
    return {
      success: true,
      devices,
      subnet,
      message: `Found ${devices.length} Framolux device(s)`,
    }
  } catch (error) {
    console.error('Discovery error:', error)
    return {
      success: false,
      devices: [],
      error: 'Discovery failed',
    }
  }
})
