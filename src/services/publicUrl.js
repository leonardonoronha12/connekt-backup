export function getPublicAppOrigin() {
  const readEnvUrl = () => {
    try {
      const v =
        import.meta?.env?.VITE_PUBLIC_APP_URL ||
        import.meta?.env?.VITE_SITE_URL ||
        import.meta?.env?.VITE_APP_BASE_URL
      if (v) return String(v).trim()
    } catch (_) {}
    return ''
  }

  const envUrl = readEnvUrl()
  if (envUrl) {
    try {
      const envOrigin = new URL(envUrl).origin
      const currentOrigin = window.location.origin
      const currentHost = String(window.location.hostname || '').toLowerCase()
      const isLocal = currentHost === 'localhost' || currentHost === '127.0.0.1' || currentHost === '0.0.0.0'
      if (!isLocal && currentOrigin && envOrigin && currentOrigin !== envOrigin) return currentOrigin
      return envOrigin
    } catch (_) {}
  }

  try {
    return window.location.origin
  } catch (_) {
    return ''
  }
}
