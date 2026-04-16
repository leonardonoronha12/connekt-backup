import { createClient } from '@supabase/supabase-js'
import { sanitizeStorageObjectPath, sanitizeStorageSegment, isStorageSubpathOf } from '../shared/storagePath.js'

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
}

export async function getAuthedUser(admin, req) {
  const h = req?.headers || {}
  const raw = h.authorization || h.Authorization || ''
  const token = String(raw || '').startsWith('Bearer ') ? String(raw).slice('Bearer '.length).trim() : ''
  if (!token) return { user: null, error: 'missing_token' }
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data?.user) return { user: null, error: 'invalid_token' }
  return { user: data.user, error: null }
}

export function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export function json(res, statusCode, payload) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

export function safeName(name) {
  return String(name || 'file').replace(/[^a-zA-Z0-9_.-]/g, '_')
}

export function isoSafeNow() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

export function isUuid(value) {
  const v = String(value || '')
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

export { sanitizeStorageObjectPath, sanitizeStorageSegment, isStorageSubpathOf }
