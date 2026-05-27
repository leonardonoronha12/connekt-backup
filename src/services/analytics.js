const readEnv = (...keys) => {
  for (const k of keys) {
    try {
      const v = import.meta?.env?.[k]
      const s = String(v || '').trim()
      if (s) return s
    } catch (_) {}
  }
  return ''
}

export function getAnalyticsConfig() {
  const gaMeasurementId = readEnv('VITE_GA_MEASUREMENT_ID', 'VITE_GA4_MEASUREMENT_ID', 'VITE_GOOGLE_ANALYTICS_ID', 'VITE_GTAG_ID')
  const metaPixelId = readEnv('VITE_META_PIXEL_ID', 'VITE_FACEBOOK_PIXEL_ID', 'VITE_FB_PIXEL_ID')
  const enabled = Boolean(gaMeasurementId || metaPixelId)
  return { enabled, gaMeasurementId, metaPixelId }
}

export function initAnalytics() {
  try {
    if (window.__CONNEKT_ANALYTICS_INIT__ === true) return
    window.__CONNEKT_ANALYTICS_INIT__ = true
  } catch (_) {}

  const { gaMeasurementId, metaPixelId } = getAnalyticsConfig()

  if (gaMeasurementId) {
    try {
      window.dataLayer = window.dataLayer || []
      window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments) }
      window.gtag('js', new Date())
      window.gtag('config', gaMeasurementId, { send_page_view: false })
    } catch (_) {}
  }

  if (metaPixelId) {
    try {
      if (typeof window.fbq !== 'function') return
      window.fbq('init', metaPixelId)
    } catch (_) {}
  }
}

export function trackPageView({ path, title } = {}) {
  const { gaMeasurementId, metaPixelId } = getAnalyticsConfig()
  const p = String(path || '').trim() || (() => {
    try { return `${window.location.pathname}${window.location.search}${window.location.hash || ''}` } catch (_) { return '' }
  })()
  const t = String(title || '').trim() || (() => {
    try { return String(document.title || '').trim() } catch (_) { return '' }
  })()

  if (gaMeasurementId) {
    try {
      const loc = `${window.location.origin}${p}`
      const fn = window.gtag
      if (typeof fn === 'function') {
        fn('event', 'page_view', { page_title: t || undefined, page_location: loc, page_path: p })
      }
    } catch (_) {}
  }

  if (metaPixelId) {
    try {
      const fn = window.fbq
      if (typeof fn === 'function') fn('track', 'PageView')
    } catch (_) {}
  }
}

