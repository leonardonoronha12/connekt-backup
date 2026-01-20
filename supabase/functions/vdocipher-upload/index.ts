import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 405 })
  }

  try {
    const supabaseAuthClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } }
    )
    const supabaseAdminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: userData } = await supabaseAuthClient.auth.getUser()
    const userId = userData?.user?.id
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 })
    }

    // Body must include title and optional folderId
    let payload: { title?: string; folderId?: string } = {}
    try {
      payload = await req.json()
    } catch (_) {
      // ignore
    }
    const title = (payload.title || '').trim()
    const folderId = (payload.folderId || '').trim()
    if (!title) {
      return new Response(JSON.stringify({ error: 'Missing title' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    }

    // Fetch per-user VdoCipher API secret
    const { data: settings, error: settingsError } = await supabaseAdminClient
      .from('vdocipher_settings')
      .select('api_secret')
      .eq('user_id', userId)
      .single()

    if (settingsError || !settings?.api_secret) {
      return new Response(JSON.stringify({ error: 'Missing VdoCipher settings for user' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    }
    const apiSecret = settings.api_secret as string

    // Step 1: Obtain upload credentials from VdoCipher API
    const qs = new URLSearchParams({ title })
    if (folderId) qs.set('folderId', folderId)
    const url = `https://dev.vdocipher.com/api/videos?${qs.toString()}`

    const vdRes = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Apisecret ${apiSecret}`,
        'Accept': 'application/json',
      },
    })

    if (!vdRes.ok) {
      const errText = await vdRes.text()
      return new Response(JSON.stringify({ error: 'Failed to obtain upload credentials', details: errText }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    }

    const json = await vdRes.json()
    // Expected keys: clientPayload { policy, key, x-amz-signature, x-amz-algorithm, x-amz-date, x-amz-credential, uploadLink }, videoId
    return new Response(JSON.stringify({ ok: true, ...json }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Unhandled error', details: String(error) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})

