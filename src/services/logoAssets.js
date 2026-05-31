import { SUPABASE_URL } from '@/lib/supabaseClient'
import { sanitizeStorageObjectPath } from '@/shared/storagePath.js'

const IMAGES_BUCKET = 'images'

function encodePath(path) {
  return String(path || '')
    .split('/')
    .filter(Boolean)
    .map((s) => encodeURIComponent(s))
    .join('/')
}

export function getStaticLogoObjectPath(key) {
  const safeKey = sanitizeStorageObjectPath(String(key || '').trim(), '')
  if (!safeKey) return ''
  return `logos/${safeKey}`
}

export function getStaticLogoPublicUrl(key) {
  const base = String(SUPABASE_URL || '').replace(/\/+$/g, '')
  const objectPath = getStaticLogoObjectPath(key)
  if (!base || !objectPath) return ''
  return `${base}/storage/v1/object/public/${IMAGES_BUCKET}/${encodePath(objectPath)}`
}

