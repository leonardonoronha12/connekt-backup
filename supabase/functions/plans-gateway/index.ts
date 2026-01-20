// Supabase Edge Function: plans-gateway
// Endpoints:
// - POST /checkout -> { checkout_url }
// - POST /sessions/verify -> { valid: boolean }

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

type Session = {
  plan: 'start' | 'pro' | 'premium'
  billing: 'mensal' | 'anual'
  user_id?: string
  paid: boolean
}

const sessions = new Map<string, Session>()

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    ...init,
  })
}

function badRequest(message: string) {
  return json({ error: message }, { status: 400 })
}

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url)

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }

  if (req.method === 'POST' && url.pathname.endsWith('/checkout')) {
    let body: any
    try { body = await req.json() } catch (_) { return badRequest('invalid json') }
    const { plan, billing, user_id, success_url, cancel_url } = body || {}
    if (!plan || !billing || !success_url) return badRequest('missing fields: plan, billing, success_url')
    const session_id = crypto.randomUUID()
    sessions.set(session_id, { plan, billing, user_id, paid: true })
    const checkout_url = `${success_url}${success_url.includes('?') ? '&' : '?'}session_id=${session_id}`
    return json({ checkout_url })
  }

  if (req.method === 'POST' && url.pathname.endsWith('/sessions/verify')) {
    let body: any
    try { body = await req.json() } catch (_) { return badRequest('invalid json') }
    const { session_id, user_id } = body || {}
    if (!session_id) return badRequest('missing field: session_id')
    const s = sessions.get(session_id)
    const valid = !!s && s.paid === true && (user_id ? s.user_id === user_id : true)
    return json({ valid })
  }

  return new Response('Not found', { status: 404 })
}

serve(handler)

