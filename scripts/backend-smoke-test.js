const BASE_URL = process.env.BACKEND_BASE_URL || 'http://127.0.0.1:3001'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function request(method, path, { headers, body } = {}) {
  const url = new URL(path, BASE_URL).toString()
  const res = await fetch(url, {
    method,
    headers: headers || {},
    body,
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch (_) {}
  return { url, res, text, json }
}

function assertNoAuthorizationLeak(payload) {
  const s = String(payload || '').toLowerCase()
  assert(!s.includes('authorization'), "Found forbidden substring 'authorization' in response payload")
}

async function run() {
  const results = []
  const runCase = async (name, fn) => {
    try {
      await fn()
      results.push({ name, ok: true })
    } catch (e) {
      results.push({ name, ok: false, error: e?.message || String(e) })
    }
  }

  await runCase('GET /api/version returns ok JSON (no authorization leak)', async () => {
    const { res, json, text } = await request('GET', '/api/version')
    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(json && typeof json === 'object', 'Expected JSON object')
    assert(json.ok === true, 'Expected ok=true')
    assert(Object.prototype.hasOwnProperty.call(json, 'version'), 'Expected version field to exist')
    assertNoAuthorizationLeak(text)
  })

  await runCase('POST /api/version is method_not_allowed', async () => {
    const { res, json, text } = await request('POST', '/api/version')
    assert(res.status === 405, `Expected 405, got ${res.status}`)
    assert(json && json.error === 'method_not_allowed', 'Expected error=method_not_allowed')
    assertNoAuthorizationLeak(text)
  })

  await runCase('GET /api/__does_not_exist is not_found', async () => {
    const { res, json, text } = await request('GET', '/api/__does_not_exist')
    assert(res.status === 404, `Expected 404, got ${res.status}`)
    assert(json && json.error === 'not_found', 'Expected error=not_found')
    assertNoAuthorizationLeak(text)
  })

  await runCase('GET /api/admin/users/list without env/auth fails safely', async () => {
    const { res, json, text } = await request('GET', '/api/admin/users/list')
    assert([401, 403, 500].includes(res.status), `Expected 401/403/500, got ${res.status}`)
    assert(json && typeof json === 'object', 'Expected JSON object')
    assertNoAuthorizationLeak(text)
  })

  await runCase('POST /api/upload-course-media without service role returns proxy_disabled', async () => {
    const { res, json, text } = await request('POST', '/api/upload-course-media?courseId=1&filename=a.txt&kind=media', {
      body: Buffer.from('x'),
    })
    assert(res.status === 501, `Expected 501, got ${res.status}`)
    assert(json && json.error === 'proxy_disabled', 'Expected error=proxy_disabled')
    assertNoAuthorizationLeak(text)
  })

  await runCase('POST /api/upload-question-media without service role returns proxy_disabled', async () => {
    const { res, json, text } = await request('POST', '/api/upload-question-media?type=image&filename=a.png&bankId=local&questionId=local', {
      body: Buffer.from('x'),
    })
    assert(res.status === 501, `Expected 501, got ${res.status}`)
    assert(json && json.error === 'proxy_disabled', 'Expected error=proxy_disabled')
    assertNoAuthorizationLeak(text)
  })

  await runCase('GET /api/oauth/google-start without env is safe', async () => {
    const { res, text } = await request('GET', '/api/oauth/google-start')
    assert(res.status >= 400 && res.status <= 599, `Expected 4xx/5xx, got ${res.status}`)
    assertNoAuthorizationLeak(text)
  })

  const passed = results.filter((r) => r.ok).length
  const failed = results.length - passed
  process.stdout.write(`Backend smoke tests: ${passed} passed, ${failed} failed\n`)
  for (const r of results) {
    process.stdout.write(`${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.ok ? '' : ` — ${r.error}`}\n`)
  }
  if (failed) process.exitCode = 1
}

await run()
