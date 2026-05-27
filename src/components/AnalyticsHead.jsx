import React, { useEffect, useMemo } from 'react'
import { Helmet } from 'react-helmet-async'
import { getAnalyticsConfig } from '@/services/analytics'

export default function AnalyticsHead() {
  const cfg = useMemo(() => getAnalyticsConfig(), [])

  useEffect(() => {
    if (!cfg?.metaPixelId) return
    if (typeof window === 'undefined') return
    if (typeof window.fbq === 'function') return
    try {
      window.fbq = function () { window.fbq.callMethod ? window.fbq.callMethod.apply(window.fbq, arguments) : window.fbq.queue.push(arguments) }
      window.fbq.push = window.fbq
      window.fbq.loaded = true
      window.fbq.version = '2.0'
      window.fbq.queue = []
      const t = document.createElement('script')
      t.async = true
      t.src = 'https://connect.facebook.net/en_US/fbevents.js'
      const s = document.getElementsByTagName('script')[0]
      if (s && s.parentNode) s.parentNode.insertBefore(t, s)
    } catch (_) {}
  }, [cfg?.metaPixelId])

  if (!cfg?.enabled) return null

  return (
    <>
      <Helmet>
        {cfg.gaMeasurementId ? (
          <script async src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(cfg.gaMeasurementId)}`} />
        ) : null}
        {cfg.gaMeasurementId ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=window.gtag||gtag;gtag('js', new Date());gtag('config', '${String(cfg.gaMeasurementId).replace(/'/g, "\\'")}', { send_page_view: false });`,
            }}
          />
        ) : null}
        {cfg.metaPixelId ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `if(window.fbq){fbq('init','${String(cfg.metaPixelId).replace(/'/g, "\\'")}');fbq('track','PageView');}`,
            }}
          />
        ) : null}
      </Helmet>
      {cfg.metaPixelId ? (
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: 'none' }}
            src={`https://www.facebook.com/tr?id=${encodeURIComponent(cfg.metaPixelId)}&ev=PageView&noscript=1`}
            alt=""
          />
        </noscript>
      ) : null}
    </>
  )
}

