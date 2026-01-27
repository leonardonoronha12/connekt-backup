export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'method_not_allowed' }))
    return
  }

  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify({
    ok: true,
    vercel: {
      env: String(process.env.VERCEL_ENV || ''),
      gitCommitSha: String(process.env.VERCEL_GIT_COMMIT_SHA || ''),
      gitCommitRef: String(process.env.VERCEL_GIT_COMMIT_REF || ''),
      gitRepoSlug: String(process.env.VERCEL_GIT_REPO_SLUG || ''),
    },
    config: {
      hasSupabaseUrl: !!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
      hasSupabaseServiceRoleKey: !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE),
      hasMygApiKey: !!process.env.MYG_API_KEY,
      hasMygAuthorization: !!process.env.MYG_AUTHORIZATION,
      hasMygClientId: !!process.env.MYG_CLIENT_ID,
      hasMygClientSecret: !!process.env.MYG_CLIENT_SECRET,
      mygBaseUrl: String(process.env.MYG_BASE_URL || 'https://api.whitelabel.mygateway.com.br/connekt'),
      appBaseUrl: String(process.env.APP_BASE_URL || process.env.VITE_APP_BASE_URL || ''),
    },
    now: new Date().toISOString(),
  }))
}
