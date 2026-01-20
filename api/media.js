import { Readable } from 'node:stream'
import { json } from './_supabaseAdmin.js'

function isAllowedTargetUrl(u) {
  try {
    const parsed = new URL(u)
    const host = String(parsed.hostname || '').toLowerCase()
    const envUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
    const envHost = (() => {
      try { return new URL(envUrl).hostname.toLowerCase() } catch { return '' }
    })()
    const isSupabaseHost = host.endsWith('.supabase.co') && (!envHost || host === envHost)
    const isStoragePath = String(parsed.pathname || '').startsWith('/storage/v1/object/')
    return isSupabaseHost && isStoragePath
  } catch {
    return false
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'method_not_allowed' })
  try {
    const u = new URL(req.url, `http://${req.headers.host}`)
    const target = u.searchParams.get('u') || ''
    if (!target || !isAllowedTargetUrl(target)) return json(res, 400, { error: 'invalid_target' })

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
