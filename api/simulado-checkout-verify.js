import { getSupabaseAdmin, getAuthedUser, json, isUuid } from '../src/server/supabaseAdmin.js'
import crypto from 'node:crypto'

const GATEWAY_URL = process.env.VITE_PLANS_GATEWAY_URL || process.env.PLANS_GATEWAY_URL || ''
const GATEWAY_API_KEY = process.env.VITE_PLANS_GATEWAY_API_KEY || process.env.PLANS_GATEWAY_API_KEY || ''
const GATEWAY_AUTH = process.env.VITE_PLANS_GATEWAY_AUTH || process.env.PLANS_GATEWAY_AUTH || ''
const GATEWAY_AUTHDATA = process.env.VITE_PLANS_GATEWAY_AUTHDATA || process.env.PLANS_GATEWAY_AUTHDATA || ''

let cachedAuth = null

function readEnv(name, fallback = '') {
  const v = process.env[name]
  return v ? String(v).trim() : fallback
}

function isValidEmail(value) {
  const v = String(value || '').trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

function normalizeFromEmail(raw) {
  const v = String(raw || '').trim()
  if (isValidEmail(v)) return v
  if (v && !v.includes('@') && v.includes('.')) return 'no-reply@connektco.com'
  return 'no-reply@connektco.com'
}

function collectEmailStrings(input, max = 12) {
  const out = []
  const seen = new Set()
  const push = (v) => {
    if (out.length >= max) return
    const s = String(v || '').trim()
    if (!s) return
    const key = s.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push(s)
  }
  const walk = (node, depth = 0) => {
    if (!node || depth > 2 || out.length >= max) return
    if (typeof node === 'string' || typeof node === 'number') return
    if (Array.isArray(node)) {
      for (let i = 0; i < Math.min(node.length, 12); i += 1) {
        walk(node[i], depth + 1)
        if (out.length >= max) return
      }
      return
    }
    if (typeof node !== 'object') return
    for (const [k, v] of Object.entries(node)) {
      if (out.length >= max) return
      const key = String(k || '').toLowerCase()
      if (key.includes('email')) push(v)
      if (key === 'customer' || key === 'payer' || key === 'buyer' || key === 'billing' || key === 'cardholder' || key === 'user') {
        walk(v, depth + 1)
      }
    }
  }
  walk(input, 0)
  return out.filter((e) => isValidEmail(e))
}

function deterministicUuid(seed) {
  const hex = crypto.createHash('sha1').update(String(seed || '')).digest('hex').slice(0, 32)
  const a = hex.slice(0, 8)
  const b = hex.slice(8, 12)
  const c = `4${hex.slice(13, 16)}`
  const variantNibble = (parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8
  const d = `${variantNibble.toString(16)}${hex.slice(17, 20)}`
  const e = hex.slice(20, 32)
  return `${a}-${b}-${c}-${d}-${e}`
}

function extractAmountCentsFromCharge(charge) {
  const candidates = [
    charge?.value,
    charge?.amount,
    charge?.amount_cents,
    charge?.amountCents,
    charge?.total,
    charge?.total_amount,
    charge?.totalAmount,
    charge?.original_value,
    charge?.originalValue,
    charge?.paid_value,
    charge?.paidValue,
    charge?.net_value,
    charge?.netValue,
  ]
  for (const c of candidates) {
    if (c === null || c === undefined) continue
    const raw = typeof c === 'number' ? String(c) : String(c).trim()
    if (!raw) continue
    const onlyDigits = raw.replace(/[^\d]/g, '')
    const hasDot = raw.includes('.')
    const hasComma = raw.includes(',')
    const dotLooksDecimal = hasDot && !hasComma && /^\d+\.\d{1,2}$/.test(raw)
    const commaLooksDecimal = hasComma && !hasDot && /^\d+,\d{1,2}$/.test(raw)
    const twoDecimals = dotLooksDecimal || commaLooksDecimal

    let normalized = raw
    let decimals = false
    if (hasDot && hasComma) {
      normalized = raw.replace(/\./g, '').replace(',', '.')
      decimals = true
    } else if (commaLooksDecimal) {
      normalized = raw.replace(',', '.')
      decimals = true
    } else if (dotLooksDecimal) {
      normalized = raw
      decimals = true
    } else if (hasDot && !hasComma) {
      normalized = raw.replace(/\./g, '')
      decimals = false
    } else {
      normalized = raw
      decimals = false
    }

    const n = Number(normalized)
    if (!Number.isFinite(n)) continue
    if (twoDecimals) {
      const m = raw.match(/^(\d+)[.,](\d{1,2})$/)
      const integerPart = Number(m?.[1] || 0)
      const decimalPart = String(m?.[2] || '').padStart(2, '0')
      if (Number.isFinite(integerPart) && decimalPart === '00') return Math.round(integerPart)
    }
    if (decimals) return Math.round(n * 100)
    if (typeof c === 'number' && !Number.isInteger(c)) return Math.round(n * 100)
    if (onlyDigits.length >= 6) return Math.round(n)
    return Math.round(n)
  }
  return 0
}

function isPaidCharge(c) {
  const s = String(c?.status || c?.payment_status || c?.state || '').toLowerCase()
  const code = Number(c?.status)
  if (c?.paid === true) return true
  if (c?.paid_at || c?.paidAt || c?.payment_date || c?.paymentDate || c?.approved_at || c?.approvedAt) return true
  if (code === 2) return true
  const ok = [
    'paid',
    'succeeded',
    'captured',
    'aprovado',
    'aprovada',
    'approved',
    'confirmado',
    'confirmada',
    'confirmed',
    'success',
    'successful',
    'completed',
    'concluido',
    'concluida',
  ]
  for (const k of ok) {
    if (s === k || s.includes(k)) return true
  }
  return false
}

function formatMoneyBRLFromCents(amountCents) {
  const n = Number(amountCents)
  if (!Number.isFinite(n)) return ''
  const value = n / 100
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
  } catch (_) {
    return `R$ ${value.toFixed(2)}`
  }
}

function parseJsonMaybe(value) {
  if (!value) return null
  if (typeof value === 'object') return value
  if (typeof value !== 'string') return null
  try { return JSON.parse(value) } catch (_) { return null }
}

function getCourseMeta(row) {
  const fromData = parseJsonMaybe(row?.data) || null
  const parsedModules = parseJsonMaybe(row?.modules) || null
  const fromModulesMeta = parsedModules && typeof parsedModules === 'object' ? (parsedModules.meta || null) : null
  return { ...(fromModulesMeta || {}), ...(fromData || {}) }
}

function getCourseModules(row) {
  const extractModules = (input, depth = 0) => {
    if (depth > 2) return []
    const parsed = parseJsonMaybe(input)
    if (Array.isArray(parsed)) return parsed
    if (!parsed || typeof parsed !== 'object') return []
    const directKeys = ['modules', 'modulos', 'items', 'aulas', 'lessons', 'module_lessons']
    for (const k of directKeys) {
      if (Array.isArray(parsed[k])) return parsed[k]
    }
    const nestedKeys = ['course', 'curso', 'content', 'conteudo', 'payload', 'data']
    for (const k of nestedKeys) {
      const v = parsed[k]
      const out = extractModules(v, depth + 1)
      if (Array.isArray(out) && out.length > 0) return out
    }
    return []
  }

  const fromModules = extractModules(row?.modules)
  if (Array.isArray(fromModules) && fromModules.length > 0) return fromModules
  const fromData = extractModules(row?.data)
  if (Array.isArray(fromData) && fromData.length > 0) return fromData
  return []
}

function resolveCoursePriceNumber(courseRow) {
  const meta = getCourseMeta(courseRow)
  const candidates = [
    courseRow?.price,
    courseRow?.course_price,
    meta?.price,
    meta?.preco,
    meta?.valor,
    meta?.value,
    meta?.coursePrice,
    meta?.course_price,
    meta?.productPrice,
    meta?.product_price,
    meta?.checkoutPrice,
    meta?.checkout_price,
    meta?.checkoutValue,
    meta?.checkout_value,
    meta?.paymentValue,
    meta?.payment_value,
  ]
  for (const c of candidates) {
    const n = Number(c)
    if (Number.isFinite(n) && n > 0) return n
  }
  return 0
}

async function getUserEmailById(admin, userId) {
  try {
    const r = await admin.auth.admin.getUserById(userId)
    const email = r?.data?.user?.email || ''
    return String(email || '').trim()
  } catch (_) {
    return ''
  }
}

function normalizeHexColor(value, fallback = '#0047BB') {
  const raw = String(value || '').trim()
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toUpperCase()
  return String(fallback || '#0047BB').trim().toUpperCase()
}

async function getUserWhitelabelConfig(admin, userId) {
  try {
    const r = await admin.auth.admin.getUserById(userId)
    const meta = r?.data?.user?.user_metadata || {}
    const wl = (meta.whitelabel && typeof meta.whitelabel === 'object')
      ? meta.whitelabel
      : ((meta.whiteLabel && typeof meta.whiteLabel === 'object') ? meta.whiteLabel : {})
    const name = String(wl?.name || wl?.brandName || wl?.appName || '').trim()
    const primaryColor = normalizeHexColor(wl?.primaryColor || wl?.primary_color, '#0047BB')
    const welcomeEmailSubject = String(wl?.welcomeEmailSubject || wl?.welcome_email_subject || wl?.welcomeSubject || '').trim()
    const welcomeEmailMessage = String(wl?.welcomeEmailMessage || wl?.welcome_email_message || wl?.welcomeMessage || '').trim()
    return { name, primaryColor, welcomeEmailSubject, welcomeEmailMessage }
  } catch (_) {
    return { name: '', primaryColor: '#0047BB', welcomeEmailSubject: '', welcomeEmailMessage: '' }
  }
}

async function sendEmail({ to, subject, html, text, fromName: fromNameOverride }) {
  const apiKey = readEnv('SENDGRID_API_KEY')
  const fromEmail = normalizeFromEmail(readEnv('SENDGRID_FROM_EMAIL', readEnv('SMTP_FROM_EMAIL')))
  const baseFromName = readEnv('SENDGRID_FROM_NAME', 'Connekt')
  const fromName = String(fromNameOverride || '').trim() || baseFromName
  const replyTo = readEnv('SENDGRID_REPLY_TO', '')
  if (!apiKey) return { ok: false, skipped: true, error: 'missing_sendgrid_key' }
  if (!isValidEmail(fromEmail)) return { ok: false, skipped: true, error: 'invalid_from_email', fromEmail }
  if (!isValidEmail(String(to || ''))) return { ok: false, skipped: false, error: 'invalid_to' }

  const content = []
  if (text) content.push({ type: 'text/plain', value: String(text) })
  if (html) content.push({ type: 'text/html', value: String(html) })
  if (content.length === 0) return { ok: false, skipped: false, error: 'missing_body' }

  const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: String(to).trim() }] }],
      from: { email: fromEmail, name: fromName },
      reply_to: replyTo && isValidEmail(replyTo) ? { email: replyTo } : undefined,
      subject: String(subject || '').trim() || 'Connekt',
      content,
    }),
  })
  if (!r.ok) {
    const raw = await r.text().catch(() => '')
    return { ok: false, skipped: false, error: 'sendgrid_send_failed', status: r.status, details: raw }
  }
  return { ok: true, skipped: false }
}

async function getGatewayAuthToken() {
  try {
    if (cachedAuth && cachedAuth.ts > Date.now() - 55 * 60_000) return cachedAuth.token
  } catch (_) {}

  if (!GATEWAY_URL || !GATEWAY_API_KEY || !GATEWAY_AUTHDATA) return null
  try {
    const url = `${String(GATEWAY_URL).replace(/\/$/, '')}/authentication/v2/auth`
    const headers = { 'x-api-key': GATEWAY_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' }
    const body = { authData: GATEWAY_AUTHDATA }
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
    if (!res.ok) return null
    const data = await res.json().catch(() => ({}))
    const token = data?.auth_token || data?.token || data?.access_token || null
    if (token) cachedAuth = { token, ts: Date.now() }
    return token
  } catch (_) {
    return null
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' })

  const admin = getSupabaseAdmin()
  if (!admin) return json(res, 501, { error: 'proxy_disabled' })

  const auth = await getAuthedUser(admin, req)
  if (!auth.user) return json(res, 401, { error: auth.error || 'unauthorized' })

  if (!GATEWAY_URL || !GATEWAY_API_KEY) return json(res, 501, { error: 'gateway_not_configured' })

  try {
    const u = new URL(req.url, 'http://localhost')
    const rawType = String(u.searchParams.get('type') || u.searchParams.get('itemType') || '').trim().toLowerCase()
    const courseId = String(u.searchParams.get('courseId') || '').trim()
    const moduleId = String(u.searchParams.get('moduleId') || '').trim()
    const lessonId = String(u.searchParams.get('lessonId') || '').trim()
    const simId = String(u.searchParams.get('simId') || '').trim()
    const linkId = String(u.searchParams.get('linkId') || '').trim()
    const resendStudentEmail = String(u.searchParams.get('resendStudentEmail') || u.searchParams.get('resendStudent') || '').trim() === '1'
    const type = rawType || (courseId ? 'course' : 'simulado')
    if (type !== 'course' && type !== 'simulado' && type !== 'module' && type !== 'lesson') return json(res, 400, { error: 'invalid_type' })
    if (type === 'course') {
      if (!courseId || !isUuid(courseId)) return json(res, 400, { error: 'invalid_courseId' })
    } else if (type === 'module') {
      if (!courseId || !isUuid(courseId)) return json(res, 400, { error: 'invalid_courseId' })
      if (!moduleId) return json(res, 400, { error: 'invalid_moduleId' })
    } else if (type === 'lesson') {
      if (!courseId || !isUuid(courseId)) return json(res, 400, { error: 'invalid_courseId' })
      if (!moduleId) return json(res, 400, { error: 'invalid_moduleId' })
      if (!lessonId) return json(res, 400, { error: 'invalid_lessonId' })
    } else {
      if (!simId || !isUuid(simId)) return json(res, 400, { error: 'invalid_simId' })
    }
    if (!linkId) return json(res, 400, { error: 'missing_linkId' })

    const token = await getGatewayAuthToken()
    const basicFromEnv = (GATEWAY_AUTH && GATEWAY_AUTH.startsWith('Basic ')) ? GATEWAY_AUTH : (GATEWAY_AUTHDATA ? `Basic ${GATEWAY_AUTHDATA}` : null)
    const envAuthFallback = (!token && !basicFromEnv && GATEWAY_AUTH) ? GATEWAY_AUTH : null
    const authModes = []
    if (token) authModes.push({ value: String(token) })
    if (basicFromEnv) authModes.push({ value: basicFromEnv })
    if (envAuthFallback) authModes.push({ value: envAuthFallback })

    const url = `${String(GATEWAY_URL).replace(/\/$/, '')}/payments/v1/paymentlink/charges/${encodeURIComponent(linkId)}`
    let r = null
    let payload = null
    for (let i = 0; i < Math.max(1, authModes.length); i++) {
      const selected = authModes[i] || { value: undefined }
      const headers = {
        Accept: 'application/json',
        'x-api-key': GATEWAY_API_KEY,
        ...(selected.value ? { Authorization: selected.value } : {}),
      }
      r = await fetch(url, { method: 'GET', headers })
      payload = await r.json().catch(() => ({}))
      if (r.ok) break
    }

    if (!r || !r.ok) return json(res, 502, { error: 'verify_failed', status: r?.status || 0, payload })

    const charges = Array.isArray(payload) ? payload : (payload?.charges || payload?.data || [])
    const paidCharge = Array.isArray(charges) ? charges.find((c) => isPaidCharge(c)) : null
    const paid = !!paidCharge

    if (paid) {
      try {
        let producerId = ''
        let itemTitle = ''
        let itemEntityType = ''
        let itemEntityId = ''
        let studentHref = ''
        let producerHref = '/vendas'
        let fallbackAmountCents = 0

        if (type === 'course' || type === 'module' || type === 'lesson') {
          const loadCourse = async () => {
            const selects = [
              'id,user_id,title,modules,data',
              'id,user_id,title,modules',
              'id,user_id,title,data',
              'id,user_id,title',
              '*',
            ]
            let last = null
            for (const sel of selects) {
              try {
                const { data, error } = await admin.from('courses').select(sel).eq('id', courseId).maybeSingle()
                if (!error && data) return { course: data, error: null }
                last = error || last
              } catch (e) {
                last = e
              }
            }
            return { course: null, error: last }
          }

          const { course } = await loadCourse()
          producerId = String(course?.user_id || '').trim()
          const courseTitle = String(course?.title || 'Curso').trim()
          const modules = getCourseModules(course)
          if (type === 'course') {
            itemTitle = courseTitle
            itemEntityType = 'course'
            itemEntityId = String(courseId || '').trim()
            studentHref = courseId ? `/aluno/curso/${encodeURIComponent(String(courseId))}` : ''
            const price = resolveCoursePriceNumber(course)
            if (price > 0) fallbackAmountCents = Math.round(price * 100)
          } else if (type === 'module') {
            const mid = String(moduleId || '').trim()
            const mod = modules.find((m) => String(m?.id || m?.module_id || m?.moduleId || '').trim() === mid) || null
            const moduleTitle = String(mod?.title || mod?.name || 'Módulo').trim()
            itemTitle = `${courseTitle} • ${moduleTitle}`
            itemEntityType = 'module'
            itemEntityId = mid
            studentHref = courseId ? `/aluno/curso/${encodeURIComponent(String(courseId))}?moduleId=${encodeURIComponent(mid)}` : ''
            const cents = Number(mod?.priceCents || mod?.price_cents || 0)
            if (Number.isFinite(cents) && cents > 0) fallbackAmountCents = Math.round(cents)
          } else {
            const mid = String(moduleId || '').trim()
            const lid = String(lessonId || '').trim()
            const mod = modules.find((m) => String(m?.id || m?.module_id || m?.moduleId || '').trim() === mid) || null
            const moduleTitle = String(mod?.title || mod?.name || 'Módulo').trim()
            const lessons = Array.isArray(mod?.lessons) ? mod.lessons : (Array.isArray(mod?.aulas) ? mod.aulas : [])
            const lesson = lessons.find((l) => String(l?.id || l?.lesson_id || l?.lessonId || '').trim() === lid) || null
            const lessonTitle = String(lesson?.title || lesson?.name || 'Aula').trim()
            itemTitle = `${courseTitle} • ${moduleTitle} • ${lessonTitle}`
            itemEntityType = 'lesson'
            itemEntityId = lid
            studentHref = courseId ? `/aluno/curso/${encodeURIComponent(String(courseId))}?moduleId=${encodeURIComponent(mid)}&lessonId=${encodeURIComponent(lid)}` : ''
            const cents = Number(lesson?.priceCents || lesson?.price_cents || 0)
            if (Number.isFinite(cents) && cents > 0) fallbackAmountCents = Math.round(cents)
          }
        } else if (type === 'simulado') {
          const { data: sim } = await admin.from('simulados').select('id,user_id,created_by,title,price').eq('id', simId).maybeSingle()
          producerId = String(sim?.user_id || sim?.created_by || '').trim()
          itemTitle = String(sim?.title || 'Simulado').trim()
          itemEntityType = 'simulado'
          itemEntityId = String(simId || '').trim()
          studentHref = '/aluno/simulados'
          const priceNumber = Number(sim?.price || 0)
          if (Number.isFinite(priceNumber) && priceNumber > 0) fallbackAmountCents = Math.round(priceNumber * 100)
        }

        const extractedCents = extractAmountCentsFromCharge(paidCharge) || 0
        const isScaleMismatch = (a, b) => {
          const x = Number(a || 0)
          const y = Number(b || 0)
          if (!(x > 0) || !(y > 0)) return false
          if (x === y) return false
          if (x === y * 100 || x === y * 10000) return true
          if (x >= y * 10 || y >= x * 10) return true
          return false
        }
        const amountCents = (() => {
          if (fallbackAmountCents > 0 && extractedCents > 0 && isScaleMismatch(extractedCents, fallbackAmountCents)) {
            return fallbackAmountCents
          }
          if (extractedCents > 0) return extractedCents
          if (fallbackAmountCents > 0) return fallbackAmountCents
          return 0
        })()
        if (producerId && isUuid(producerId)) {
          const saleId = deterministicUuid(`sale:${type}:${courseId || ''}:${moduleId || ''}:${lessonId || ''}:${simId || ''}:link:${linkId}:buyer:${auth.user.id}`)
          await admin
            .from('sales')
            .upsert(
              { id: saleId, producer_id: producerId, amount_cents: amountCents, status: 'paid' },
              { onConflict: 'id' }
            )

          const studentId = String(auth.user.id || '').trim()
          const authStudentEmail = String(auth.user.email || '').trim()
          const fetchedStudentEmail = await getUserEmailById(admin, studentId)
          const studentEmail = isValidEmail(authStudentEmail)
            ? authStudentEmail
            : (isValidEmail(fetchedStudentEmail) ? fetchedStudentEmail : '')
          const producerEmail = await getUserEmailById(admin, producerId)
          const producerWl = await getUserWhitelabelConfig(admin, producerId)
          const money = formatMoneyBRLFromCents(amountCents)
          const studentActorName = String(auth.user.user_metadata?.name || auth.user.user_metadata?.full_name || authStudentEmail || 'Aluno').trim()

          const producerNotifId = deterministicUuid(`notif:purchase:producer:${producerId}:sale:${saleId}`)
          const studentNotifId = deterministicUuid(`notif:purchase:student:${studentId}:sale:${saleId}`)

          const maybeInsertNotification = async (row) => {
            const id = row?.id
            if (!id) return { inserted: false, tableMissing: false }
            try {
              const existing = await admin.from('notifications').select('id').eq('id', id).maybeSingle()
              if (existing?.data?.id) return { inserted: false, tableMissing: false }
              if (existing?.error) {
                const code = String(existing.error.code || '')
                const msg = String(existing.error.message || '').toLowerCase()
                const tableMissing = code === '42P01' || msg.includes('does not exist') || msg.includes('notifications')
                if (tableMissing) return { inserted: false, tableMissing: true }
              }
            } catch (e) {
              const msg = String(e?.message || e || '').toLowerCase()
              const tableMissing = msg.includes('does not exist') || msg.includes('notifications')
              if (tableMissing) return { inserted: false, tableMissing: true }
            }
            const ins = await admin.from('notifications').insert(row)
            if (ins?.error) {
              const code = String(ins.error.code || '')
              const msg = String(ins.error.message || '').toLowerCase()
              const tableMissing = code === '42P01' || msg.includes('does not exist') || msg.includes('notifications')
              return { inserted: false, tableMissing }
            }
            return { inserted: true, tableMissing: false }
          }

          const producerNotif = await maybeInsertNotification({
            id: producerNotifId,
            recipient_user_id: producerId,
            type: 'purchase_received',
            title: 'Nova compra',
            message: `${studentActorName} comprou: ${itemTitle}${money ? ` (${money})` : ''}`,
            actor_name: studentActorName || null,
            entity_name: itemTitle || null,
            entity_type: itemEntityType || null,
            entity_id: itemEntityId || null,
            data: {
              type: itemEntityType || null,
              sale_id: saleId,
              producer_id: producerId,
              buyer_id: studentId,
              buyer_email: studentEmail || null,
              amount_cents: amountCents,
              status: 'paid',
              payment_link_id: linkId,
              courseId: courseId || null,
              moduleId: moduleId || null,
              lessonId: lessonId || null,
              simId: simId || null,
            },
            href: producerHref,
            read_at: null,
          })

          const studentNotif = await maybeInsertNotification({
            id: studentNotifId,
            recipient_user_id: studentId,
            type: 'purchase_confirmed',
            title: 'Compra confirmada',
            message: `Compra aprovada: ${itemTitle}${money ? ` (${money})` : ''}`,
            actor_name: null,
            entity_name: itemTitle || null,
            entity_type: itemEntityType || null,
            entity_id: itemEntityId || null,
            data: {
              type: itemEntityType || null,
              sale_id: saleId,
              producer_id: producerId,
              buyer_id: studentId,
              buyer_email: studentEmail || null,
              amount_cents: amountCents,
              status: 'paid',
              payment_link_id: linkId,
              courseId: courseId || null,
              moduleId: moduleId || null,
              lessonId: lessonId || null,
              simId: simId || null,
            },
            href: studentHref || null,
            read_at: null,
          })

          const baseUrl = String(process.env.PUBLIC_APP_URL || 'https://app.connektco.com').replace(/\/+$/, '')
          const producerLink = `${baseUrl}${producerHref}`
          const studentLink = studentHref ? `${baseUrl}${studentHref}` : baseUrl
          const supportEmail = readEnv('SUPPORT_EMAIL', 'suporte@appconnekt.com.br')
          const brandName = String(producerWl?.name || '').trim() || 'Connekt'
          const brandPrimary = normalizeHexColor(producerWl?.primaryColor, '#0047BB')
          const brandText = '#1E1B39'
          const brandMuted = '#737780'
          const brandBg = '#F6F8FC'
          const panelBorder = '#E3E4E5'

          const escapeHtml = (value) => String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')

          const renderPlainTextAsHtml = (value) => {
            const raw = String(value || '').trim()
            if (!raw) return ''
            return escapeHtml(raw).replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/\n/g, '<br />')
          }

          const applyWhitelabelMessageTemplate = (template, vars) => {
            const raw = String(template || '')
            if (!raw.trim()) return ''
            const map = vars && typeof vars === 'object' ? vars : {}
            return raw.replace(/\{([^}]+)\}/g, (_, key) => {
              const k = String(key || '').trim()
              if (!k) return ''
              const v = map[k]
              return v == null ? '' : String(v)
            })
          }

          const purchaseEmailHtml = ({ title, subtitle, ctaLabel, ctaHref, introHtml }) => {
            const safeTitle = escapeHtml(title)
            const safeSubtitle = escapeHtml(subtitle)
            const safeCtaHref = String(ctaHref || '').trim()
            const safeCtaLabel = escapeHtml(ctaLabel)
            const safeSupportEmail = escapeHtml(supportEmail)
            const safeBrandName = escapeHtml(brandName)
            const safeBrandPrimary = escapeHtml(brandPrimary)
            const safeBrandText = escapeHtml(brandText)
            const safeBrandMuted = escapeHtml(brandMuted)
            const safeBrandBg = escapeHtml(brandBg)
            const safeBorder = escapeHtml(panelBorder)
            const safeIntro = String(introHtml || '').trim()
            return `
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;padding:0;background:${safeBrandBg};font-family:Arial,Helvetica,sans-serif;color:${safeBrandText};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${safeTitle}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:${safeBrandBg};">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;border-collapse:separate;border-spacing:0;">
            <tr>
              <td style="padding:0 0 16px 0;">
                <div style="font-size:18px;font-weight:800;letter-spacing:-0.3px;color:${safeBrandText};">${safeBrandName}</div>
                <div style="font-size:12px;color:${safeBrandMuted};margin-top:4px;">Plataforma de cursos</div>
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;border:1px solid ${safeBorder};border-radius:16px;padding:24px;">
                <div style="font-size:18px;font-weight:800;line-height:1.3;margin:0 0 8px 0;color:${safeBrandText};">${safeTitle}</div>
                ${safeIntro ? `<div style="font-size:13px;line-height:1.6;margin:0 0 16px 0;color:${safeBrandText};">${safeIntro}</div>` : ''}
                <div style="font-size:13px;line-height:1.5;margin:0 0 18px 0;color:${safeBrandMuted};">${safeSubtitle}</div>
                <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                  <tr>
                    <td style="border-radius:12px;background:${safeBrandPrimary};">
                      <a href="${safeCtaHref}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 16px;font-size:13px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">${safeCtaLabel}</a>
                    </td>
                  </tr>
                </table>
                <div style="margin-top:16px;font-size:12px;line-height:1.5;color:${safeBrandMuted};">
                  Se o botão não funcionar, copie e cole este link no navegador:<br />
                  <span style="word-break:break-all;color:${safeBrandText};">${escapeHtml(safeCtaHref)}</span>
                </div>
                <div style="margin-top:18px;padding-top:18px;border-top:1px solid ${safeBorder};font-size:12px;color:${safeBrandMuted};line-height:1.5;">
                  Precisa de ajuda? Fale com a gente em
                  <a href="mailto:${escapeHtml(supportEmail)}" style="color:${safeBrandPrimary};text-decoration:none;">${safeSupportEmail}</a>.
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 4px 0 4px;font-size:11px;color:${safeBrandMuted};text-align:center;">
                © ${new Date().getFullYear()} ${safeBrandName}. Todos os direitos reservados.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`.trim()
          }

          if ((producerNotif.inserted || producerNotif.tableMissing) && producerEmail) {
            try {
              const producerTitle = 'Nova compra confirmada'
              const producerSubtitle = `${studentActorName} comprou: ${itemTitle}${money ? ` (${money})` : ''}.`
              const producerSubject = producerWl?.welcomeEmailSubject
                ? String(producerWl.welcomeEmailSubject)
                : `Nova compra: ${itemTitle}`
              const producerIntro = applyWhitelabelMessageTemplate(producerWl?.welcomeEmailMessage, { nome: studentActorName }) || ''
              const result = await sendEmail({
                to: producerEmail,
                subject: producerSubject,
                fromName: brandName,
                text: `${studentActorName} comprou: ${itemTitle}${money ? ` (${money})` : ''}\n\nAcesse: ${producerLink}`,
                html: purchaseEmailHtml({
                  title: producerTitle,
                  subtitle: producerSubtitle,
                  ctaLabel: 'Abrir painel',
                  ctaHref: producerLink,
                  introHtml: renderPlainTextAsHtml(producerIntro),
                }),
              })
              if (!result?.ok && !result?.skipped) {
                try { console.error('purchase_email_send_failed', JSON.stringify({ to: producerEmail, error: result?.error || null, status: result?.status || null })) } catch (_) {}
              }
            } catch (_) {}
          }

          if ((studentNotif.inserted || studentNotif.tableMissing || resendStudentEmail) && studentEmail) {
            try {
              const studentTitle = 'Compra confirmada'
              const studentSubtitle = `Sua compra foi aprovada: ${itemTitle}${money ? ` (${money})` : ''}.`
              const studentSubject = producerWl?.welcomeEmailSubject
                ? String(producerWl.welcomeEmailSubject)
                : `Compra confirmada: ${itemTitle}`
              const studentIntro = applyWhitelabelMessageTemplate(producerWl?.welcomeEmailMessage, { nome: studentActorName }) || ''
              const result = await sendEmail({
                to: studentEmail,
                subject: studentSubject,
                fromName: brandName,
                text: `Sua compra foi aprovada: ${itemTitle}${money ? ` (${money})` : ''}\n\nAcesse: ${studentLink}`,
                html: purchaseEmailHtml({
                  title: studentTitle,
                  subtitle: studentSubtitle,
                  ctaLabel: 'Acessar conteúdo',
                  ctaHref: studentLink,
                  introHtml: renderPlainTextAsHtml(studentIntro),
                }),
              })
              if (!result?.ok && !result?.skipped) {
                try { console.error('purchase_email_send_failed', JSON.stringify({ to: studentEmail, error: result?.error || null, status: result?.status || null })) } catch (_) {}
              }
            } catch (_) {}
          }
        }
      } catch (_) {}
    }
    return json(res, 200, { ok: true, paid: !!paid, simId: simId || null, courseId: courseId || null, moduleId: moduleId || null, lessonId: lessonId || null, linkId, type })
  } catch (e) {
    return json(res, 500, { error: 'internal_error', message: e?.message || String(e) })
  }
}

