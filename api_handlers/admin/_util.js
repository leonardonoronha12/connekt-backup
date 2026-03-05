import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { getSupabaseAdmin, getAuthedUser, json, readRawBody } from '../../src/server/supabaseAdmin.js'

export function readEnv(name, fallback = '') {
  const v = process.env[name]
  return v ? String(v).trim() : fallback
}

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())
}

export function normalizeAccountType(v) {
  const t = String(v || '').trim().toLowerCase()
  if (t === 'administrador' || t === 'admin') return 'admin'
  if (t === 'produtor' || t === 'producer') return 'produtor'
  if (t === 'aluno' || t === 'student') return 'aluno'
  return 'aluno'
}

export function deterministicUuid(seed) {
  const hex = crypto.createHash('sha1').update(String(seed || '')).digest('hex').slice(0, 32)
  const a = hex.slice(0, 8)
  const b = hex.slice(8, 12)
  const c = `4${hex.slice(13, 16)}`
  const variantNibble = (parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8
  const d = `${variantNibble.toString(16)}${hex.slice(17, 20)}`
  const e = hex.slice(20, 32)
  return `${a}-${b}-${c}-${d}-${e}`
}

export async function readJsonBody(req) {
  const raw = await readRawBody(req)
  const text = raw ? raw.toString('utf-8') : ''
  if (!text) return {}
  return JSON.parse(text)
}

export function getAdminEmailsAllowList() {
  const raw = readEnv('PLATFORM_ADMIN_EMAILS', readEnv('VITE_PLATFORM_ADMIN_EMAILS', ''))
  const list = raw
    .split(/[,\s;]+/g)
    .map((s) => normalizeEmail(s))
    .filter(Boolean)
  const bootstrap = normalizeEmail(readEnv('BOOTSTRAP_PLATFORM_ADMIN_EMAIL', 'leonardonoronha12@gmail.com'))
  const set = new Set(list)
  if (bootstrap) set.add(bootstrap)
  return set
}

export function isPlatformAdminUser(user) {
  const email = normalizeEmail(user?.email)
  const meta = user?.user_metadata && typeof user.user_metadata === 'object' ? user.user_metadata : {}
  const role = String(meta?.account_type || meta?.role || meta?.platform_role || '').trim().toLowerCase()
  if (role === 'admin' || role === 'administrador') return true
  const allow = getAdminEmailsAllowList()
  return !!email && allow.has(email)
}

export async function requireAdmin(req, res) {
  const admin = getSupabaseAdmin()
  if (!admin) {
    json(res, 500, { error: 'missing_supabase_admin' })
    return { ok: false, admin: null, user: null }
  }
  const auth = await getAuthedUser(admin, req)
  if (!auth?.user) {
    json(res, 401, { error: 'unauthorized' })
    return { ok: false, admin, user: null }
  }
  if (!isPlatformAdminUser(auth.user)) {
    json(res, 403, { error: 'forbidden' })
    return { ok: false, admin, user: auth.user }
  }
  return { ok: true, admin, user: auth.user }
}

export function computeDisabled(user) {
  const bannedUntil = String(user?.banned_until || '').trim()
  if (!bannedUntil) return false
  const t = new Date(bannedUntil).getTime()
  if (!Number.isFinite(t)) return false
  return t > Date.now()
}

export function parseExpiresAt(value) {
  const v = String(value || '').trim()
  if (!v) return null
  const isoDate = v.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoDate) return v
  const t = new Date(v).getTime()
  if (!Number.isFinite(t)) return null
  return new Date(t).toISOString().slice(0, 10)
}

export function isExpired(expiresAtIso) {
  const v = String(expiresAtIso || '').trim()
  if (!v) return false
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return false
  const endMs = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999)
  return Date.now() > endMs
}

export function getVercelToken() {
  return (
    readEnv('CONNEKT_VERCEL_TOKEN', '') ||
    readEnv('VERCEL_TOKEN', '') ||
    readEnv('VERCEL_DEPLOY_TOKEN', '') ||
    ''
  )
}

export function readVercelProjectInfo() {
  const fromEnv = () => {
    const projectId = readEnv('VERCEL_PROJECT_ID', '')
    const teamId = readEnv('VERCEL_TEAM_ID', '')
    if (projectId && teamId) return { projectId, teamId }
    return null
  }
  const env = fromEnv()
  if (env) return env
  try {
    const p = path.join(process.cwd(), '.vercel', 'project.json')
    const raw = fs.readFileSync(p, 'utf8')
    const parsed = JSON.parse(raw || '{}')
    const projectId = String(parsed?.projectId || '').trim()
    const teamId = String(parsed?.orgId || parsed?.teamId || '').trim()
    if (projectId && teamId) return { projectId, teamId }
  } catch (_) {}
  return null
}
