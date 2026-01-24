export default async function handler(req, res) {
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify({
    ok: true,
    vercel: {
      env: process.env.VERCEL_ENV || null,
      gitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
      gitCommitRef: process.env.VERCEL_GIT_COMMIT_REF || null,
      gitRepoSlug: process.env.VERCEL_GIT_REPO_SLUG || null,
    },
    now: new Date().toISOString(),
  }))
}

