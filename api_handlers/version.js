export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'method_not_allowed' }))
    return
  }

  const readEnv = (name, fallback = '') => {
    const v = process.env[name]
    return v ? String(v).trim() : fallback
  }

  const supabaseUrl =
    readEnv('VITE_SUPABASE_URL', '') ||
    readEnv('VITE_PUBLIC_SUPABASE_URL', '') ||
    readEnv('SUPABASE_URL', '')
  const supabaseAnonKey =
    readEnv('VITE_SUPABASE_ANON_KEY', '') ||
    readEnv('VITE_PUBLIC_SUPABASE_ANON_KEY', '') ||
    readEnv('VITE_SUPABASE_KEY', '') ||
    readEnv('VITE_PUBLIC_SUPABASE_KEY', '') ||
    readEnv('SUPABASE_ANON_KEY', '')

  const version =
    readEnv('APP_VERSION', '') ||
    readEnv('npm_package_version', '') ||
    ''

  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify({
    ok: true,
    name: 'connekt',
    version,
    vercel: {
      env: String(process.env.VERCEL_ENV || ''),
      gitCommitSha: String(process.env.VERCEL_GIT_COMMIT_SHA || ''),
      gitCommitRef: String(process.env.VERCEL_GIT_COMMIT_REF || ''),
      gitRepoSlug: String(process.env.VERCEL_GIT_REPO_SLUG || ''),
    },
    config: {
      hasSupabaseUrl: !!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.VITE_PUBLIC_SUPABASE_URL),
      hasSupabaseAnonKey: !!(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_KEY || process.env.VITE_PUBLIC_SUPABASE_KEY),
      hasViteSupabaseUrl: !!(process.env.VITE_SUPABASE_URL || process.env.VITE_PUBLIC_SUPABASE_URL),
      hasViteSupabaseAnonKey: !!(process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_KEY || process.env.VITE_PUBLIC_SUPABASE_KEY),
      hasSupabaseServiceRoleKey: !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE),
      hasMygApiKey: !!process.env.MYG_API_KEY,
      hasMygAuthToken: !!process.env.MYG_AUTHORIZATION,
      hasMygClientId: !!process.env.MYG_CLIENT_ID,
      hasMygClientSecret: !!process.env.MYG_CLIENT_SECRET,
      hasPlansGatewayUrl: !!(process.env.VITE_PLANS_GATEWAY_URL || process.env.PLANS_GATEWAY_URL),
      hasPlansGatewayApiKey: !!(process.env.VITE_PLANS_GATEWAY_API_KEY || process.env.PLANS_GATEWAY_API_KEY),
      hasPlansGatewayAuth: !!(process.env.VITE_PLANS_GATEWAY_AUTH || process.env.PLANS_GATEWAY_AUTH),
      hasPlansGatewayAuthData: !!(process.env.VITE_PLANS_GATEWAY_AUTHDATA || process.env.PLANS_GATEWAY_AUTHDATA),
      mygBaseUrl: String(process.env.MYG_BASE_URL || 'https://api.whitelabel.mygateway.com.br/connekt'),
      appBaseUrl: String(process.env.APP_BASE_URL || process.env.VITE_APP_BASE_URL || ''),
    },
    public: {
      supabaseUrl,
      supabaseAnonKey,
    },
    now: new Date().toISOString(),
  }))
}
