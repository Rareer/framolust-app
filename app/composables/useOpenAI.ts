export interface LEDFrame {
  pixels: string[][] // 16x16 array of hex color values
  duration: number // duration in milliseconds
}

export interface LEDAnimation {
  frames: LEDFrame[]
  loop: boolean
  description: string
}

export const useOpenAI = () => {
  const apiKey = useState<string>('openai-api-key', () => '')
  const isLoading = useState<boolean>('openai-loading', () => false)
  const error = useState<string | null>('openai-error', () => null)

  const setApiKey = (key: string) => {
    apiKey.value = key
    // Store in localStorage for persistence
    if (process.client) {
      localStorage.setItem('openai-api-key', key)
    }
  }

  const loadApiKey = () => {
    if (process.client) {
      const stored = localStorage.getItem('openai-api-key')
      if (stored) {
        apiKey.value = stored
      }
    }
  }

  const generateAnimation = async (prompt: string, referenceImage?: string[][] | null): Promise<LEDAnimation | null> => {
    if (!apiKey.value) {
      error.value = 'API Key fehlt'
      return null
    }

    isLoading.value = true
    error.value = null

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey.value}`
        },
        body: JSON.stringify({
          model: 'gpt-5',
          messages: [
            {
              role: 'system',
              content: `Du bist ein Experte für LED-Matrix-Animationen. Erstelle Animationen für ein 16x16 LED-Panel.
              
Jedes Frame besteht aus einem 16x16 Pixel-Raster. Jedes Pixel hat eine Farbe im Hex-Format (#RRGGBB).
Erstelle mehrere Frames für eine flüssige Animation. Jedes Frame sollte eine angemessene Dauer haben (in Millisekunden).

Wichtig:
- Verwende lebendige, kontrastreiche Farben
- Erstelle für Animationen mindestens 5-10 Frames; Falls keine Bewegung vorgesehen ist, erstelle nur ein einziges Frame mit dem gewünschten Motiv
- Passe die Frame-Dauer an die gewünschte Geschwindigkeit an (typisch 50-200ms)
- Für schwarze/ausgeschaltete LEDs verwende #000000
- Wenn ein Referenzbild bereitgestellt wird, verwende es als Basis und modifiziere es entsprechend dem Prompt`
            },
            {
              role: 'user',
              content: referenceImage 
                ? `${prompt}\n\nReferenzbild (16x16 Pixel-Matrix):\n${JSON.stringify(referenceImage)}`
                : prompt
            }
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'led_animation',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  description: {
                    type: 'string',
                    description: 'Beschreibung der Animation'
                  },
                  loop: {
                    type: 'boolean',
                    description: 'Ob die Animation wiederholt werden soll'
                  },
                  frames: {
                    type: 'array',
                    description: 'Array von Animations-Frames',
                    items: {
                      type: 'object',
                      properties: {
                        pixels: {
                          type: 'array',
                          description: '16x16 Array von Hex-Farbwerten',
                          items: {
                            type: 'array',
                            items: {
                              type: 'string',
                              description: 'Hex-Farbwert (z.B. #FF0000)'
                            },
                            minItems: 16,
                            maxItems: 16
                          },
                          minItems: 16,
                          maxItems: 16
                        },
                        duration: {
                          type: 'number',
                          description: 'Frame-Dauer in Millisekunden'
                        }
                      },
                      required: ['pixels', 'duration'],
                      additionalProperties: false
                    }
                  }
                },
                required: ['description', 'loop', 'frames'],
                additionalProperties: false
              }
            }
          }
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || `API Fehler: ${response.status}`)
      }

      const data = await response.json()
      const content = data.choices[0]?.message?.content

      if (!content) {
        throw new Error('Keine Antwort von OpenAI erhalten')
      }

      const animation: LEDAnimation = JSON.parse(content)
      
      // Validate animation structure
      if (!animation.frames || animation.frames.length === 0) {
        throw new Error('Keine Frames in der Animation')
      }

      return animation

    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unbekannter Fehler'
      console.error('OpenAI API Error:', err)
      return null
    } finally {
      isLoading.value = false
    }
  }

  const generateImageForRasterization = async (prompt: string): Promise<string | null> => {
    if (!apiKey.value) {
      error.value = 'API Key fehlt'
      return null
    }

    isLoading.value = true
    error.value = null

    try {
      // Optimierter Prompt für LED-Matrix-geeignete Bilder
      const optimizedPrompt = `${prompt}. Style: High contrast illustration with bold colors, minimal details, simple shapes, flat design, suitable for pixel art conversion. Square composition, 1:1 aspect ratio.`

      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey.value}`
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: optimizedPrompt,
          n: 1,
          size: '1024x1024',
          quality: 'standard',
          style: 'vivid'
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || `API Fehler: ${response.status}`)
      }

      const data = await response.json()
      const imageUrl = data.data[0]?.url

      if (!imageUrl) {
        throw new Error('Keine Bild-URL von OpenAI erhalten')
      }

      return imageUrl

    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unbekannter Fehler'
      return null
    } finally {
      isLoading.value = false
    }
  }

  return {
    apiKey: readonly(apiKey),
    isLoading: readonly(isLoading),
    error: readonly(error),
    setApiKey,
    loadApiKey,
    generateAnimation,
    generateImageForRasterization
  }
}
