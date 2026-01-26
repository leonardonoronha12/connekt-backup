import { json } from './_supabaseAdmin.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' })

  const sha =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.COMMIT_SHA ||
    ''

  return json(res, 200, {
    ok: true,
    sha: sha ? String(sha).slice(0, 12) : '',
    env: String(process.env.VERCEL_ENV || ''),
    url: String(process.env.VERCEL_URL || ''),
    now: new Date().toISOString(),
  })
}

