export function captureVideoElementFrameDataUrl(videoEl, maxWidth, quality) {
  const v = videoEl
  if (!v) return ''
  const w = Math.max(0, Number(v.videoWidth || 0))
  const h = Math.max(0, Number(v.videoHeight || 0))
  if (!w || !h) return ''
  const targetMaxWidth = Math.max(120, Number(maxWidth || 420))
  const scale = Math.min(1, targetMaxWidth / w)
  const cw = Math.max(1, Math.round(w * scale))
  const ch = Math.max(1, Math.round(h * scale))
  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.drawImage(v, 0, 0, cw, ch)
  const q = Number.isFinite(Number(quality)) ? Number(quality) : 0.76
  try {
    return canvas.toDataURL('image/jpeg', Math.max(0.1, Math.min(0.95, q))) || ''
  } catch (_) {
    return ''
  }
}

function normalizeVideoUrlForFrameCapture(input) {
  const u = String(input || '').trim()
  if (!u) return ''
  if (u.includes('/api/media?')) {
    try {
      const parsed = new URL(u, window.location.origin)
      if (!parsed.searchParams.get('stream')) parsed.searchParams.set('stream', '1')
      return `${parsed.pathname}?${parsed.searchParams.toString()}`
    } catch (_) {
      return u
    }
  }
  if (u.includes('.supabase.co/storage/v1/object/')) return `/api/media?stream=1&u=${encodeURIComponent(u)}`
  return u
}

export async function captureVideoFrameDataUrl(src, seekSeconds, timeoutMs) {
  const inputUrl = String(src || '').trim()
  if (!inputUrl) return ''
  const seekTo = Number.isFinite(Number(seekSeconds)) ? Number(seekSeconds) : 0.2
  const url = normalizeVideoUrlForFrameCapture(inputUrl)
  if (!url) return ''

  const v = document.createElement('video')
  v.crossOrigin = 'anonymous'
  v.muted = true
  v.playsInline = true
  v.preload = 'auto'

  const cleanup = () => {
    try { v.pause() } catch (_) {}
    try { v.removeAttribute('src') } catch (_) {}
    try { v.load() } catch (_) {}
  }

  const withTimeout = (p, ms) => new Promise((resolve) => {
    let done = false
    const t = setTimeout(() => {
      if (done) return
      done = true
      resolve('')
    }, Math.max(500, Number(ms) || 3500))
    Promise.resolve(p)
      .then((val) => {
        if (done) return
        done = true
        clearTimeout(t)
        resolve(val)
      })
      .catch(() => {
        if (done) return
        done = true
        clearTimeout(t)
        resolve('')
      })
  })

  const waitOne = (names) => new Promise((resolve) => {
    const list = Array.isArray(names) ? names : [names]
    const cleanupListeners = []
    const done = (name) => {
      for (const [ev, fn] of cleanupListeners) {
        try { v.removeEventListener(ev, fn) } catch (_) {}
      }
      resolve(String(name || ''))
    }
    for (const n of list) {
      const ev = String(n || '').trim()
      if (!ev) continue
      const fn = () => done(ev)
      cleanupListeners.push([ev, fn])
      try { v.addEventListener(ev, fn, { once: true }) } catch (_) {}
    }
  })

  return withTimeout((async () => {
    try {
      v.src = url
      v.load()
    } catch (_) {
      cleanup()
      return ''
    }

    const metaEvent = await waitOne(['loadedmetadata', 'error'])
    if (metaEvent === 'error') {
      cleanup()
      return ''
    }

    try {
      const d = Number.isFinite(Number(v.duration)) ? Number(v.duration) : 0
      const target = Math.max(0, Math.min(d > 0 ? d - 0.12 : seekTo, seekTo))
      try { v.currentTime = target } catch (_) {}
    } catch (_) {}

    const frameEvent = await waitOne(['seeked', 'loadeddata', 'timeupdate', 'error'])
    if (frameEvent === 'error') {
      cleanup()
      return ''
    }

    try {
      const w = Math.max(1, v.videoWidth || 0)
      const h = Math.max(1, v.videoHeight || 0)
      if (!w || !h) return ''
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return ''
      ctx.drawImage(v, 0, 0, w, h)
      return canvas.toDataURL('image/jpeg', 0.72) || ''
    } catch (_) {
      return ''
    } finally {
      cleanup()
    }
  })(), Number.isFinite(Number(timeoutMs)) ? Number(timeoutMs) : 6500)
}
