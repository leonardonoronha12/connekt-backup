import { json } from '../../src/server/supabaseAdmin.js'
import { readEnv, requireAdmin } from './_util.js'
import crypto from 'node:crypto'

function normalizeGatewayBaseUrl(raw) {
  const v = String(raw || '').trim()
  if (!v) return ''
  try {
    const u = new URL(v)
    const host = String(u.hostname || '').toLowerCase()
    if (!host.endsWith('mygateway.com.br')) return ''
    const p = String(u.pathname || '')
    if (p === '/' || p === '') u.pathname = '/connekt'
    if (!String(u.pathname || '').startsWith('/connekt')) u.pathname = `/connekt${String(u.pathname || '')}`
    u.hash = ''
    return u.toString().replace(/\/+$/, '')
  } catch (_) {
    return ''
  }
}

function expandGatewayBaseVariants(raw) {
  const base = normalizeGatewayBaseUrl(raw)
  if (!base) return []
  const out = [base]
  try {
    const u = new URL(base)
    const host = String(u.hostname || '').toLowerCase()
    if (host === 'api.mygateway.com.br') {
      u.hostname = 'api.whitelabel.mygateway.com.br'
      out.push(u.toString().replace(/\/+$/, ''))
    } else if (host === 'api.whitelabel.mygateway.com.br') {
      u.hostname = 'api.mygateway.com.br'
      out.push(u.toString().replace(/\/+$/, ''))
    }
  } catch (_) {}
  return Array.from(new Set(out)).filter(Boolean)
}

function redactText(input) {
  const s = String(input || '')
  if (!s) return ''
  return s
    .replace(/(authorization:\s*)(bearer|basic)\s+[^\s\r\n]+/gi, '$1$2 [redacted]')
    .replace(/("authorization"\s*:\s*")(bearer|basic)\s+[^"]+(")/gi, '$1$2 [redacted]$3')
    .replace(/(x-api-key:\s*)[^\s\r\n]+/gi, '$1[redacted]')
    .replace(/("x-api-key"\s*:\s*")[^"]+(")/gi, '$1[redacted]$2')
    .replace(/(bearer|basic)\s+[A-Za-z0-9\-._~+/]+=*/gi, '$1 [redacted]')
}

function isAbortError(e) {
  const name = String(e?.name || '').toLowerCase()
  const msg = String(e?.message || e || '').toLowerCase()
  if (name.includes('abort')) return true
  if (msg.includes('aborted')) return true
  if (msg.includes('abort')) return true
  if (msg.includes('timeout')) return true
  if (msg === 'hard_timeout') return true
  return false
}

async function fetchWithTimeout(url, init = {}, timeoutMs = 10_000) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const t = controller ? setTimeout(() => controller.abort(), Math.max(1, Number(timeoutMs || 0))) : null
  try {
    return await fetch(url, { ...(init || {}), signal: controller ? controller.signal : init?.signal })
  } finally {
    if (t) clearTimeout(t)
  }
}

async function safeReadText(res) {
  try {
    return await res.text()
  } catch (_) {
    return ''
  }
}

export default async function handler(req, res) {
  const startedAt = Date.now()
  const traceId = (() => {
    try {
      if (crypto?.randomUUID) return crypto.randomUUID()
      return crypto.randomBytes(16).toString('hex')
    } catch (_) {
      return String(Date.now())
    }
  })()
  let step = ''
  let baseUrl = ''
  let authUrl = ''
  let paymentUrl = ''
  try {
    if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' })
    const auth = await requireAdmin(req, res)
    if (!auth.ok) return

    const rawBase = (
      readEnv('PLANS_GATEWAY_URL', '') ||
      readEnv('MYG_BASE_URL', '') ||
      readEnv('VITE_PLANS_GATEWAY_URL', '') ||
      ''
    )
    const bases = expandGatewayBaseVariants(rawBase)
    baseUrl = bases[0] || ''
    const apiKey = readEnv('PLANS_GATEWAY_API_KEY', readEnv('MYG_API_KEY', readEnv('VITE_PLANS_GATEWAY_API_KEY', '')))
    const authData = readEnv('PLANS_GATEWAY_AUTHDATA', readEnv('MYG_AUTHDATA', readEnv('VITE_PLANS_GATEWAY_AUTHDATA', '')))

    if (!baseUrl) return json(res, 500, { ok: false, error: 'missing_gateway_base', trace_id: traceId })
    if (!apiKey || !authData) return json(res, 500, { ok: false, error: 'missing_gateway_env', trace_id: traceId })

    const envMeta = { has_api_key: !!apiKey, has_authdata: !!authData }
    const attempts = []
    let chosen = null

    const headersBase = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-api-key': apiKey,
    }

    for (const b of (bases.length ? bases : [baseUrl])) {
      const attempt = { base_url: b, endpoints: { auth: '', paymentlink: '' }, steps: {} }
      try {
        authUrl = `${String(b).replace(/\/$/, '')}/authentication/v2/auth`
        paymentUrl = `${String(b).replace(/\/$/, '')}/payments/v1/paymentlink`
        attempt.endpoints = { auth: authUrl, paymentlink: paymentUrl }

        const authStart = Date.now()
        step = 'auth'
        const authRes = await fetchWithTimeout(authUrl, {
          method: 'POST',
          headers: headersBase,
          body: JSON.stringify({ authData }),
        }, 9_000)
        const authText = await safeReadText(authRes)
        const authMs = Date.now() - authStart
        let token = ''
        try {
          const parsed = JSON.parse(authText || '{}')
          token = String(parsed?.auth_token || parsed?.token || parsed?.access_token || '').trim()
        } catch (_) {
          token = ''
        }
        attempt.steps.auth = {
          ok: authRes.ok && !!token,
          status: authRes.status,
          took_ms: authMs,
          token_present: !!token,
          response_snippet: redactText(String(authText || '').slice(0, 600)),
        }

        if (token) {
          const validity = new Date(Date.now() + 60 * 60_000).toISOString().slice(0, 16).replace('T', ' ')
          const requestBody = {
            value: '100',
            title: 'Healthcheck',
            description: 'healthcheck',
            validity,
            minimumNumberOfInstallments: 1,
            maximumQuantityOfInstallments: 1,
            numberOfAllowedSales: 1,
            showFormAddress: 0,
            customerInterest: 0,
            acceptedPaymentsType: ['PIX'],
            external_order_number: `hc:${Date.now()}`,
          }

          const payStart = Date.now()
          step = 'paymentlink'
          const authCandidates = [String(token), `Bearer ${String(token)}`]
          let payRes = null
          let payText = ''
          let payAuthMode = ''
          for (const authHeader of authCandidates) {
            payAuthMode = authHeader.startsWith('Bearer ') ? 'bearer' : 'token_raw'
            payRes = await fetchWithTimeout(paymentUrl, {
              method: 'POST',
              headers: { ...headersBase, Authorization: authHeader },
              body: JSON.stringify(requestBody),
            }, 12_000)
            payText = await safeReadText(payRes)
            if (payRes.ok) break
            if ([401, 403].includes(Number(payRes.status || 0))) break
          }
          const payMs = Date.now() - payStart
          attempt.steps.paymentlink = {
            ok: !!payRes?.ok,
            status: payRes?.status || 0,
            took_ms: payMs,
            auth_mode: payAuthMode,
            content_type: String(payRes?.headers?.get?.('content-type') || ''),
            response_snippet: redactText(String(payText || '').slice(0, 800)),
          }
        }
      } catch (e) {
        attempt.steps.error = { message: redactText(String(e?.message || e || '')).slice(0, 300) }
      }

      attempts.push(attempt)
      if (attempt?.steps?.paymentlink?.ok) {
        chosen = attempt
        break
      }
      if (!chosen) chosen = attempt
    }

    const out = {
      ok: !!chosen?.steps?.paymentlink?.ok,
      now: new Date().toISOString(),
      base_url: String(chosen?.base_url || baseUrl || ''),
      endpoints: chosen?.endpoints || { auth: authUrl, paymentlink: paymentUrl },
      env: envMeta,
      steps: chosen?.steps || {},
      attempted_bases: attempts.map((a) => a?.base_url).filter(Boolean),
      attempts,
      took_ms: Date.now() - startedAt,
      trace_id: traceId,
    }
    return json(res, 200, out)
  } catch (e) {
    const tookMs = Date.now() - startedAt
    if (isAbortError(e)) {
      return json(res, 504, {
        ok: false,
        error: 'gateway_timeout',
        message: 'O servidor tentou falar com o gateway, mas ele não respondeu a tempo.',
        step: step || '',
        base_url: baseUrl || '',
        endpoints: { auth: authUrl || '', paymentlink: paymentUrl || '' },
        took_ms: tookMs,
        trace_id: traceId,
      })
    }
    return json(res, 502, {
      ok: false,
      error: 'gateway_network_error',
      message: 'Falha ao conectar no gateway.',
      details: redactText(String(e?.message || e || '')).slice(0, 300),
      step: step || '',
      base_url: baseUrl || '',
      endpoints: { auth: authUrl || '', paymentlink: paymentUrl || '' },
      took_ms: tookMs,
      trace_id: traceId,
    })
  }
}
