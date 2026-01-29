import React from 'react'
import { useBranding } from '@/contexts/BrandingContext'

export default function BrandLogo({ variant = 'sidebar', className = '', alt = '' }) {
  const { brand } = useBranding()
  const url = variant === 'compact' ? (brand?.logoCompactUrl || '') : (brand?.logoUrl || '')
  const safeAlt = alt || (brand?.name ? String(brand.name) : 'Logo')
  const fallback = variant === 'compact' ? '/logo connekt.png' : '/logo-expanded.svg'
  return (
    <img
      src={url || fallback}
      alt={safeAlt}
      className={className}
      onError={(e) => {
        try {
          if (e?.currentTarget?.src && e.currentTarget.src.endsWith(fallback)) return
          e.currentTarget.src = fallback
        } catch (_) {}
      }}
    />
  )
}

