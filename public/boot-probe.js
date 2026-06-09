;(function () {
  function safeNow() {
    try { return Date.now() } catch (_) { return 0 }
  }

  function el(tag) {
    return document.createElement(tag)
  }

  function safeText(v) {
    return String(v == null ? '' : v).slice(0, 1400)
  }

  function getRoot() {
    try { return document.getElementById('root') } catch (_) { return null }
  }

  function hasVisibleRootContent() {
    const root = getRoot()
    if (!root) return false
    try {
      if ((root.childNodes?.length || 0) === 0) return false
      const t = safeText(root.textContent || '')
      return t.trim().length > 0
    } catch (_) {
      return (root.childNodes?.length || 0) > 0
    }
  }

  function ensureLoader() {
    const root = getRoot()
    if (!root) return
    if (hasVisibleRootContent()) return
    const outer = el('div')
    outer.style.minHeight = '100vh'
    outer.style.display = 'flex'
    outer.style.alignItems = 'center'
    outer.style.justifyContent = 'center'
    outer.style.padding = '24px'
    outer.style.background = '#f8fafc'
    outer.style.color = '#111827'
    outer.style.fontFamily = 'Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif'

    const card = el('div')
    card.style.width = '100%'
    card.style.maxWidth = '520px'
    card.style.background = '#ffffff'
    card.style.border = '1px solid #E3E4E5'
    card.style.borderRadius = '16px'
    card.style.padding = '20px'
    card.style.display = 'flex'
    card.style.alignItems = 'center'
    card.style.gap = '12px'

    const spinner = el('div')
    spinner.style.width = '18px'
    spinner.style.height = '18px'
    spinner.style.borderRadius = '999px'
    spinner.style.border = '3px solid #E3E4E5'
    spinner.style.borderTopColor = '#0047BB'
    spinner.style.animation = 'connektSpin 1s linear infinite'

    const msg = el('div')
    msg.style.fontSize = '13px'
    msg.style.fontWeight = '700'
    msg.style.color = '#1E1B39'
    msg.textContent = 'Carregando…'

    const style = el('style')
    style.textContent = '@keyframes connektSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}'

    card.appendChild(spinner)
    card.appendChild(msg)
    outer.appendChild(style)
    outer.appendChild(card)

    try {
      while (root.firstChild) root.removeChild(root.firstChild)
      root.appendChild(outer)
    } catch (_) {
      try { root.appendChild(outer) } catch (_) {}
    }
  }

  function shouldShowOverlay() {
    try {
      const u = new URL(window.location.href)
      if (u.searchParams.get('boot_debug') === '1') return true
    } catch (_) {}
    return !hasVisibleRootContent()
  }

  function createOverlay() {
    const box = el('div')
    box.id = 'connekt-boot-overlay'
    box.style.position = 'fixed'
    box.style.left = '12px'
    box.style.bottom = '12px'
    box.style.zIndex = '2147483647'
    box.style.maxWidth = 'calc(100vw - 24px)'
    box.style.background = 'rgba(17,24,39,0.92)'
    box.style.color = '#fff'
    box.style.border = '1px solid rgba(255,255,255,0.12)'
    box.style.borderRadius = '12px'
    box.style.padding = '10px 12px'
    box.style.fontFamily = 'ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace'
    box.style.fontSize = '11px'
    box.style.lineHeight = '1.35'
    box.style.whiteSpace = 'pre-wrap'
    box.style.wordBreak = 'break-word'
    box.style.display = 'none'
    return box
  }

  function formatLine(k, v) {
    return `${k}: ${safeText(v)}`
  }

  function readBootStep() {
    try { return window.__CONNEKT_BOOT__?.step || '' } catch (_) { return '' }
  }

  async function probeVersion() {
    try {
      const r = await fetch('/api/version', { cache: 'no-store' })
      const t = await r.text()
      let j = null
      try { j = JSON.parse(t || '{}') } catch (_) { j = null }
      const sha = j?.vercel?.gitCommitSha || ''
      return { ok: r.ok, status: r.status || 0, sha, head: safeText(t).slice(0, 220) }
    } catch (e) {
      return { ok: false, status: 0, sha: '', head: safeText(e?.message || e) }
    }
  }

  function scheduleSelfHeal() {
    const key = 'connekt_boot_selfheal_ts'
    const now = safeNow()
    const last = Number(sessionStorage.getItem(key) || 0)
    if (Number.isFinite(last) && last > 0 && (now - last) < 60_000) return
    sessionStorage.setItem(key, String(now))
    try { window.location.replace('/sw-reset') } catch (_) { window.location.href = '/sw-reset' }
  }

  const startedAt = safeNow()
  ensureLoader()

  const overlay = createOverlay()
  try { document.documentElement.appendChild(overlay) } catch (_) { try { document.body.appendChild(overlay) } catch (_) {} }

  let lastErr = ''
  const onError = (e) => {
    try { lastErr = safeText(e?.message || e?.error?.message || '') } catch (_) { lastErr = 'error' }
  }
  const onRej = (e) => {
    try { lastErr = safeText(e?.reason?.message || e?.reason || '') } catch (_) { lastErr = 'rejection' }
  }
  try { window.addEventListener('error', onError) } catch (_) {}
  try { window.addEventListener('unhandledrejection', onRej) } catch (_) {}

  const tick = async () => {
    const step = readBootStep()
    const age = safeNow() - startedAt
    const root = getRoot()
    const rootChildren = root ? (root.childNodes?.length || 0) : 0
    const visible = hasVisibleRootContent()
    const show = shouldShowOverlay() && age > 2500
    if (overlay) overlay.style.display = show ? 'block' : 'none'
    if (overlay && show) {
      const v = await probeVersion()
      const lines = [
        formatLine('url', window.location.href),
        formatLine('boot_step', step || '(none)'),
        formatLine('age_ms', String(age)),
        formatLine('root_children', String(rootChildren)),
        formatLine('root_visible', String(visible)),
        formatLine('api_version', v.ok ? `ok (${v.status})` : `fail (${v.status || 'err'})`),
        v.sha ? formatLine('git', v.sha) : '',
        lastErr ? formatLine('last_error', lastErr) : '',
        'Se continuar em branco, abrindo /sw-reset…',
      ].filter(Boolean)
      overlay.textContent = lines.join('\n')
    }
    if (!visible && age > 7000) scheduleSelfHeal()
  }

  const loop = () => {
    tick().finally(() => {
      try { window.setTimeout(loop, 1200) } catch (_) {}
    })
  }
  loop()
})()
