import { getSupabaseAdmin, getAuthedUser, json, isUuid } from '../src/server/supabaseAdmin.js'
import crypto from 'node:crypto'
import sgMail from '@sendgrid/mail'

const GATEWAY_URL = process.env.VITE_PLANS_GATEWAY_URL || process.env.PLANS_GATEWAY_URL || ''
const GATEWAY_API_KEY = process.env.VITE_PLANS_GATEWAY_API_KEY || process.env.PLANS_GATEWAY_API_KEY || ''
const GATEWAY_AUTH = process.env.VITE_PLANS_GATEWAY_AUTH || process.env.PLANS_GATEWAY_AUTH || ''
const GATEWAY_AUTHDATA = process.env.VITE_PLANS_GATEWAY_AUTHDATA || process.env.PLANS_GATEWAY_AUTHDATA || ''

let cachedAuth = null

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
    const hasDecimal = raw.includes('.') || raw.includes(',')
    const normalized = raw.replace(/\./g, '').replace(',', '.')
    const n = Number(normalized)
    if (!Number.isFinite(n)) continue
    if (hasDecimal && Math.abs(n) < 100000) return Math.round(n * 100)
    return Math.round(n)
  }
  return 0
}

function isPaidCharge(c) {
  const s = String(c?.status || '').toLowerCase()
  const code = Number(c?.status)
  return s === 'paid' || s === 'succeeded' || s === 'captured' || s === 'aprovado' || c?.paid === true || code === 2
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

async function getUserEmailById(admin, userId) {
  try {
    const r = await admin.auth.admin.getUserById(userId)
    const email = r?.data?.user?.email || ''
    return String(email || '').trim()
  } catch (_) {
    return ''
  }
}

async function sendEmail({ to, subject, html, text }) {
  const apiKey = String(process.env.SENDGRID_API_KEY || '').trim()
  if (!apiKey) return { ok: false, skipped: true }
  const fromEmail = String(process.env.SENDGRID_FROM_EMAIL || 'notificacoes@connektco.com').trim()
  sgMail.setApiKey(apiKey)
  await sgMail.send({
    to,
    from: fromEmail,
    subject,
    text,
    html,
  })
  return { ok: true }
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

        if (type === 'course' || type === 'module' || type === 'lesson') {
          const { data: course } = await admin.from('courses').select('id,user_id,title,modules').eq('id', courseId).maybeSingle()
          producerId = String(course?.user_id || '').trim()
          const courseTitle = String(course?.title || 'Curso').trim()
          if (type === 'course') {
            itemTitle = courseTitle
            itemEntityType = 'course'
            itemEntityId = String(courseId || '').trim()
            studentHref = courseId ? `/curso-preview/${encodeURIComponent(String(courseId))}` : ''
          } else if (type === 'module') {
            const modules = Array.isArray(course?.modules) ? course.modules : []
            const mid = String(moduleId || '').trim()
            const mod = modules.find((m) => String(m?.id || m?.module_id || m?.moduleId || '').trim() === mid) || null
            const moduleTitle = String(mod?.title || mod?.name || 'Módulo').trim()
            itemTitle = `${courseTitle} • ${moduleTitle}`
            itemEntityType = 'module'
            itemEntityId = mid
            studentHref = courseId ? `/curso-preview/${encodeURIComponent(String(courseId))}?moduleId=${encodeURIComponent(mid)}` : ''
          } else {
            const modules = Array.isArray(course?.modules) ? course.modules : []
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
            studentHref = courseId ? `/curso-preview/${encodeURIComponent(String(courseId))}?moduleId=${encodeURIComponent(mid)}&lessonId=${encodeURIComponent(lid)}` : ''
          }
        } else if (type === 'simulado') {
          const { data: sim } = await admin.from('simulados').select('id,user_id,created_by,title').eq('id', simId).maybeSingle()
          producerId = String(sim?.user_id || sim?.created_by || '').trim()
          itemTitle = String(sim?.title || 'Simulado').trim()
          itemEntityType = 'simulado'
          itemEntityId = String(simId || '').trim()
          studentHref = '/aluno/simulados'
        }

        const amountCents = extractAmountCentsFromCharge(paidCharge) || 0
        if (producerId && isUuid(producerId) && amountCents > 0) {
          const saleId = deterministicUuid(`sale:${type}:${courseId || ''}:${moduleId || ''}:${lessonId || ''}:${simId || ''}:link:${linkId}:buyer:${auth.user.id}`)
          await admin
            .from('sales')
            .upsert(
              { id: saleId, producer_id: producerId, amount_cents: amountCents, status: 'paid' },
              { onConflict: 'id' }
            )

          const studentId = String(auth.user.id || '').trim()
          const studentEmail = String(auth.user.email || '').trim()
          const producerEmail = await getUserEmailById(admin, producerId)
          const money = formatMoneyBRLFromCents(amountCents)
          const studentActorName = String(auth.user.user_metadata?.name || auth.user.user_metadata?.full_name || studentEmail || 'Aluno').trim()

          const producerNotifId = deterministicUuid(`notif:purchase:producer:${producerId}:sale:${saleId}`)
          const studentNotifId = deterministicUuid(`notif:purchase:student:${studentId}:sale:${saleId}`)

          const maybeInsertNotification = async (row) => {
            const id = row?.id
            if (!id) return false
            const existing = await admin.from('notifications').select('id').eq('id', id).maybeSingle()
            if (existing?.data?.id) return false
            const ins = await admin.from('notifications').insert(row)
            return !ins?.error
          }

          const createdProducerNotif = await maybeInsertNotification({
            id: producerNotifId,
            recipient_user_id: producerId,
            recipient_role: 'producer',
            type: 'purchase_received',
            title: 'Nova compra',
            message: `${studentActorName} comprou: ${itemTitle}${money ? ` (${money})` : ''}`,
            actor_user_id: studentId || null,
            actor_name: studentActorName || null,
            entity_type: itemEntityType || null,
            entity_id: itemEntityId || null,
            entity_name: itemTitle || null,
            href: producerHref,
            read_at: null,
            data: { sale_id: saleId, type, courseId: courseId || null, moduleId: moduleId || null, lessonId: lessonId || null, simId: simId || null, amount_cents: amountCents, buyer_id: studentId || null },
          })

          const createdStudentNotif = await maybeInsertNotification({
            id: studentNotifId,
            recipient_user_id: studentId,
            recipient_role: 'student',
            type: 'purchase_confirmed',
            title: 'Compra confirmada',
            message: `Compra aprovada: ${itemTitle}${money ? ` (${money})` : ''}`,
            actor_user_id: producerId || null,
            actor_name: null,
            entity_type: itemEntityType || null,
            entity_id: itemEntityId || null,
            entity_name: itemTitle || null,
            href: studentHref || null,
            read_at: null,
            data: { sale_id: saleId, type, courseId: courseId || null, moduleId: moduleId || null, lessonId: lessonId || null, simId: simId || null, amount_cents: amountCents, producer_id: producerId || null },
          })

          const baseUrl = String(process.env.PUBLIC_APP_URL || 'https://app.connektco.com').replace(/\/+$/, '')
          const producerLink = `${baseUrl}${producerHref}`
          const studentLink = studentHref ? `${baseUrl}${studentHref}` : baseUrl

          if (createdProducerNotif && producerEmail) {
            try {
              await sendEmail({
                to: producerEmail,
                subject: `Nova compra: ${itemTitle}`,
                text: `${studentActorName} comprou: ${itemTitle}${money ? ` (${money})` : ''}\n\nAcesse: ${producerLink}`,
                html: `<p><strong>${studentActorName}</strong> comprou: <strong>${itemTitle}</strong>${money ? ` (${money})` : ''}.</p><p><a href="${producerLink}">Abrir painel</a></p>`,
              })
            } catch (_) {}
          }

          if (createdStudentNotif && studentEmail) {
            try {
              await sendEmail({
                to: studentEmail,
                subject: `Compra confirmada: ${itemTitle}`,
                text: `Sua compra foi aprovada: ${itemTitle}${money ? ` (${money})` : ''}\n\nAcesse: ${studentLink}`,
                html: `<p>Sua compra foi aprovada: <strong>${itemTitle}</strong>${money ? ` (${money})` : ''}.</p><p><a href="${studentLink}">Acessar conteúdo</a></p>`,
              })
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

