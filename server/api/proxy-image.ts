export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const imageUrl = query.url as string

  if (!imageUrl) {
    throw createError({
      statusCode: 400,
      message: 'Image URL is required'
    })
  }

  // Validiere, dass es eine OpenAI URL ist
  if (!imageUrl.includes('oaidalleapiprodscus.blob.core.windows.net')) {
    throw createError({
      statusCode: 400,
      message: 'Invalid image URL'
    })
  }

  try {
    // Lade das Bild von OpenAI
    const response = await fetch(imageUrl)
    
    if (!response.ok) {
      throw createError({
        statusCode: response.status,
        message: 'Failed to fetch image from OpenAI'
      })
    }

    // Hole den Blob
    const blob = await response.blob()
    const arrayBuffer = await blob.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Setze die richtigen Headers
    setResponseHeaders(event, {
      'Content-Type': blob.type || 'image/png',
      'Content-Length': buffer.length.toString(),
      'Cache-Control': 'public, max-age=3600'
    })

    return buffer
  } catch (error) {
    console.error('Error proxying image:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to proxy image'
    })
  }
})
