async function unregisterAllServiceWorkers() {
  if (!('serviceWorker' in navigator)) return
  const regs = await navigator.serviceWorker.getRegistrations().catch(() => [])
  await Promise.all((regs || []).map((r) => r.unregister().catch(() => false)))
}

async function clearAllCaches() {
  if (!('caches' in window)) return
  const keys = await caches.keys().catch(() => [])
  await Promise.all((keys || []).map((k) => caches.delete(k).catch(() => false)))
}

function clearStorage() {
  try { localStorage.clear() } catch (_) {}
  try { sessionStorage.clear() } catch (_) {}
}

function go() {
  try {
    const u = new URL(window.location.href)
    u.pathname = '/login'
    u.searchParams.set('sw_reset', '1')
    u.hash = ''
    window.location.replace(u.toString())
  } catch (_) {
    window.location.replace('/login?sw_reset=1')
  }
}

;(async () => {
  clearStorage()
  await unregisterAllServiceWorkers()
  await clearAllCaches()
  go()
})().catch(() => {
  go()
})
