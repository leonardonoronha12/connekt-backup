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
    const { code, redirect_uri } = await req.json()
    if (!code) {
      return new Response(JSON.stringify({ error: 'Missing code' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    }

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

    // Fetch per-user Vimeo app credentials
    const { data: settings, error: settingsError } = await supabaseAdminClient
      .from('vimeo_settings')
      .select('client_id, client_secret, redirect_uri, scope')
      .eq('user_id', userId)
      .single()

    if (settingsError || !settings) {
      return new Response(JSON.stringify({ error: 'Missing Vimeo settings for user' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    }

    const clientId = settings.client_id
    const clientSecret = settings.client_secret
    const effectiveRedirectUri = redirect_uri || settings.redirect_uri

    const basic = btoa(`${clientId}:${clientSecret}`)
    const tokenRes = await fetch('https://api.vimeo.com/oauth/access_token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: effectiveRedirectUri,
      }),
    })

    if (!tokenRes.ok) {
      const errText = await tokenRes.text()
      return new Response(JSON.stringify({ error: 'Token exchange failed', details: errText }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    }

    const tokenJson = await tokenRes.json()
    const access_token = tokenJson.access_token as string
    const scope = tokenJson.scope as string | undefined
    const token_type = tokenJson.token_type as string | undefined
    const user = tokenJson.user || {}
    const vimeo_user_uri = user.uri || null

    const { error: upsertError } = await supabaseAdminClient
      .from('vimeo_connections')
      .upsert({
        user_id: userId,
        access_token,
        scope: scope || null,
        token_type: token_type || null,
        vimeo_user_uri,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    if (upsertError) {
      return new Response(JSON.stringify({ error: 'Failed to store token', details: upsertError.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
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

