export function sanitizeStorageSegment(input, fallback = '') {
  const raw = String(input ?? '').trim()
  if (!raw) return String(fallback ?? '').trim()
  const noNull = raw.replace(/\0/g, '')
  const replaced = noNull.replace(/[^a-zA-Z0-9_.-]/g, '_')
  const cleaned = replaced.replace(/^_+|_+$/g, '')
  if (!cleaned || cleaned === '.' || cleaned === '..') return String(fallback ?? '').trim()
  return cleaned
}

export function sanitizeStorageObjectPath(input) {
  const raw = String(input ?? '').trim()
  if (!raw) return null
  if (raw.includes('%')) return null
  const noNull = raw.replace(/\0/g, '')
  const normalizedSlash = noNull.replace(/\\/g, '/')
  const withoutLeading = normalizedSlash.replace(/^\/+/, '')
  const parts = withoutLeading.split('/').filter(Boolean)
  if (parts.length === 0) return null
  const out = []
  for (const p of parts) {
    const segRaw = String(p || '')
    if (!segRaw || segRaw === '.' || segRaw === '..') return null
    const seg = sanitizeStorageSegment(segRaw, '')
    if (!seg) return null
    out.push(seg)
  }
  return out.join('/')
}

export function isStorageSubpathOf(path, prefix) {
  const p = sanitizeStorageObjectPath(path)
  const pre = sanitizeStorageObjectPath(prefix)
  if (!p || !pre) return false
  if (p === pre) return true
  return p.startsWith(`${pre}/`)
}
