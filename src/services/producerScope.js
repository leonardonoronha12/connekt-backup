export const PRODUCER_SCOPE_KEY = 'connekt_student_producer_uid'

export function getActiveProducerUserId() {
  try {
    const fromSession = sessionStorage.getItem(PRODUCER_SCOPE_KEY)
    if (fromSession && String(fromSession).trim()) return String(fromSession).trim()
  } catch (_) {}
  try {
    const fromLocal = localStorage.getItem(PRODUCER_SCOPE_KEY)
    if (fromLocal && String(fromLocal).trim()) return String(fromLocal).trim()
  } catch (_) {}
  return ''
}

export function setActiveProducerUserId(value) {
  const v = String(value || '').trim()
  if (!v) return
  try { sessionStorage.setItem(PRODUCER_SCOPE_KEY, v) } catch (_) {}
  try { localStorage.setItem(PRODUCER_SCOPE_KEY, v) } catch (_) {}
}

export function clearActiveProducerUserId() {
  try { sessionStorage.removeItem(PRODUCER_SCOPE_KEY) } catch (_) {}
  try { localStorage.removeItem(PRODUCER_SCOPE_KEY) } catch (_) {}
}

