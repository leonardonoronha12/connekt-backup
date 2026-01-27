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
    now: new Date().toISOString(),
  }))
}
