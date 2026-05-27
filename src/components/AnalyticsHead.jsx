import React, { useMemo } from 'react'
import { Helmet } from 'react-helmet-async'
import { getAnalyticsConfig } from '@/services/analytics'

export default function AnalyticsHead() {
  const cfg = useMemo(() => getAnalyticsConfig(), [])

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
              __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${String(cfg.metaPixelId).replace(/'/g, "\\'")}');fbq('track','PageView');`,
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
