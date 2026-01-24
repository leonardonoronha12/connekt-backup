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
      return new URL(envUrl).origin
    } catch (_) {}
  }

  try {
    return window.location.origin
  } catch (_) {
    return ''
  }
}

