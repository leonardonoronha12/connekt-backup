import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Client for reading auth user (uses anon key + Authorization header)
    const supabaseAuthClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } }
    )
    // Admin client for DB operations (bypass RLS where needed)
    const supabaseAdminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: userData } = await supabaseAuthClient.auth.getUser()
    const userId = userData?.user?.id
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 })
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

    // Validate the secret by calling a lightweight VdoCipher endpoint
    const checkRes = await fetch('https://dev.vdocipher.com/api/videos?page=1&perPage=1', {
      method: 'GET',
      headers: {
        'Authorization': `Apisecret ${apiSecret}`,
        'Accept': 'application/json',
      },
    })

    if (!checkRes.ok) {
      const errText = await checkRes.text()
      return new Response(JSON.stringify({ error: 'VdoCipher validation failed', details: errText }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    }

    let account_info: Record<string, unknown> | null = null
    try {
      const json = await checkRes.json()
      account_info = { sample: json }
    } catch (_) {
      account_info = null
    }

    const { error: upsertError } = await supabaseAdminClient
      .from('vdocipher_connections')
      .upsert({
        user_id: userId,
        connected: true,
        last_verified: new Date().toISOString(),
        account_info,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    if (upsertError) {
      return new Response(JSON.stringify({ error: 'Failed to store VdoCipher connection', details: upsertError.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
    }

    return new Response(JSON.stringify({ ok: true }), {
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

