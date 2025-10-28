import { defineEventHandler, getQuery, readRawBody, setResponseHeaders } from 'h3'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const ip = String(query.ip || '')
  const path = String(query.path || '/api/info')

  if (!ip) {
    return new Response(JSON.stringify({ error: 'Missing ip parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // Build target URL (always http to device)
  const targetUrl = `http://${ip}${path.startsWith('/') ? path : `/${path}`}`

  const method = event.node.req.method || 'GET'

  // Copy selected headers
  const headers: Record<string, string> = {}
  const incoming = event.node.req.headers
  const contentType = incoming['content-type']
  if (contentType) headers['Content-Type'] = Array.isArray(contentType) ? contentType[0] : contentType

  // Read body for non-GET methods (binary safe)
  let body: any = undefined
  if (method !== 'GET' && method !== 'HEAD') {
    const raw = await readRawBody(event)
    if (raw) body = raw as any
  }

  // Perform fetch to device
  const response = await fetch(targetUrl, {
    method,
    headers,
    body: body as any,
  })

  // Forward status and content-type
  const buf = new Uint8Array(await response.arrayBuffer())
  const outHeaders: Record<string, string> = {
    'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream'
  }
  setResponseHeaders(event, outHeaders)

  return new Response(buf, { status: response.status, headers: outHeaders })
})
