import { json } from '../src/server/supabaseAdmin.js'

function isAllowedTargetUrl(u) {
  try {
    const parsed = new URL(u)
    const host = String(parsed.hostname || '').toLowerCase()
    const isSupabaseHost = host.endsWith('.supabase.co')
    const pathname = String(parsed.pathname || '')
    const isAllowedBucketObject = /^\/storage\/v1\/object\/(public|sign|authenticated)\/(courses-media|question-images)\//.test(pathname)
    return isSupabaseHost && isAllowedBucketObject
  } catch {
    return false
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'range,content-type')
  res.setHeader('Vary', 'Origin')

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end('')
    return
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'method_not_allowed' })
  try {
    const u = new URL(req.url, `http://${req.headers.host}`)
    const target = u.searchParams.get('u') || ''
    if (!target || !isAllowedTargetUrl(target)) return json(res, 400, { error: 'invalid_target' })

    const streamMode = String(u.searchParams.get('stream') || '').trim() === '1'
    if (!streamMode) {
      res.statusCode = 307
      res.setHeader('Location', target)
      res.setHeader('Cache-Control', 'public, max-age=60')
      res.end()
      return
    }

    const { Readable } = await import('node:stream')
    const headers = {}
    const range = req.headers.range || req.headers.Range
    if (range) headers.Range = range

    const upstream = await fetch(target, { method: req.method, headers })
    res.statusCode = upstream.status

    const passthrough = [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'etag',
      'last-modified',
      'cache-control',
      'content-disposition',
    ]
    for (const h of passthrough) {
      const v = upstream.headers.get(h)
      if (v) res.setHeader(h, v)
    }
    if (!res.getHeader('accept-ranges')) res.setHeader('accept-ranges', 'bytes')

    if (req.method === 'HEAD') {
      res.end()
      return
    }

    if (!upstream.body) {
      res.end()
      return
    }

    const nodeStream = Readable.fromWeb(upstream.body)
    nodeStream.on('error', () => {
      try { res.end() } catch (_) {}
    })
    nodeStream.pipe(res)
  } catch (e) {
    return json(res, 500, { error: e?.message || String(e) })
  }
}
