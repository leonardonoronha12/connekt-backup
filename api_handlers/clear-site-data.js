export default async function handler(req, res) {
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage", "executionContexts"')
  res.end(JSON.stringify({ ok: true }))
}
