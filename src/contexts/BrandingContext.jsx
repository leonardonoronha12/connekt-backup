import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { getActiveProducerUserId, setActiveProducerUserId } from '@/services/producerScope'

const BrandingContext = createContext({ brand: null, loading: false })

function clampHexColor(input, fallback) {
  const v = String(input || '').trim()
  if (!v) return fallback
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toUpperCase()
  return fallback
}

function isAlunoContext() {
  try {
    const path = String(window.location.pathname || '')
    return path === '/login-aluno' || path === '/login-aluno-wl' || path === '/aluno/login' || path === '/aluno' || path.startsWith('/aluno/')
  } catch (_) {
    return false
  }
}

function defaultBrand() {
  return {
    name: 'Connekt',
    logoUrl: '/logo-expanded.svg',
    logoCompactUrl: '/logo connekt.png',
    primaryColor: '#0047BB',
    primaryHoverColor: '#003399',
    sidebarFrom: 'rgb(15, 6, 39)',
    sidebarTo: 'rgb(0, 0, 104)',
  }
}

function normalizeBrand(raw) {
  const base = defaultBrand()
  const obj = raw && typeof raw === 'object' ? raw : {}
  const name = String(obj.name || obj.brandName || obj.appName || base.name).trim() || base.name
  const logoUrl = String(obj.logoUrl || obj.logo_url || obj.logo || base.logoUrl).trim() || base.logoUrl
  const logoCompactUrl = String(obj.logoCompactUrl || obj.logo_compact_url || obj.logoCompact || base.logoCompactUrl).trim() || base.logoCompactUrl
  const primaryColor = clampHexColor(obj.primaryColor || obj.primary_color, base.primaryColor)
  const primaryHoverColor = clampHexColor(obj.primaryHoverColor || obj.primary_hover_color, base.primaryHoverColor)
  const sidebarFrom = String(obj.sidebarFrom || obj.sidebar_from || base.sidebarFrom).trim() || base.sidebarFrom
  const sidebarTo = String(obj.sidebarTo || obj.sidebar_to || base.sidebarTo).trim() || base.sidebarTo
  return { name, logoUrl, logoCompactUrl, primaryColor, primaryHoverColor, sidebarFrom, sidebarTo }
}

async function getAccessToken() {
  try {
    const { data } = await supabase.auth.getSession()
    return data?.session?.access_token || ''
  } catch (_) {
    return ''
  }
}

export function BrandingProvider({ children }) {
  const [brand, setBrand] = useState(() => defaultBrand())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isAlunoContext()) return
    let active = true
    const run = async () => {
      setLoading(true)
      try {
        const host = String(window.location.hostname || '').toLowerCase()
        if (host === 'app.connektco.com') {
          if (active) setBrand(defaultBrand())
          return
        }
        let producerId = ''
        try { producerId = String(getActiveProducerUserId() || '').trim() } catch (_) { producerId = '' }

        const params = new URLSearchParams(window.location.search || '')
        const fromQuery =
          params.get('producer_uid') ||
          params.get('producerUserId') ||
          params.get('producer_uid'.toUpperCase()) ||
          ''
        if (!producerId && fromQuery) producerId = String(fromQuery).trim()

        if (!producerId) {
          const r = await fetch(`/api/producer?type=public_branding&host=${encodeURIComponent(host)}`)
          const body = await r.json().catch(() => ({}))
          if (!active) return
          const pid = String(body?.producerId || '').trim()
          if (pid) {
            try { setActiveProducerUserId(pid) } catch (_) {}
            producerId = pid
          }
          if (body?.brand) setBrand(normalizeBrand(body.brand))
          return
        }

        const token = await getAccessToken()
        if (token) {
          const r = await fetch(`/api/producer?type=branding&producerId=${encodeURIComponent(producerId)}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          const body = await r.json().catch(() => ({}))
          if (!active) return
          if (r.ok && body?.brand) {
            setBrand(normalizeBrand(body.brand))
            return
          }
        }

        const r2 = await fetch(`/api/producer?type=public_branding&producerId=${encodeURIComponent(producerId)}&host=${encodeURIComponent(host)}`)
        const body2 = await r2.json().catch(() => ({}))
        if (!active) return
        if (body2?.brand) setBrand(normalizeBrand(body2.brand))
      } catch (_) {
        if (!active) return
        setBrand((prev) => prev || defaultBrand())
      } finally {
        if (active) setLoading(false)
      }
    }
    run()
    const onPop = () => run()
    window.addEventListener('popstate', onPop)
    return () => {
      active = false
      window.removeEventListener('popstate', onPop)
    }
  }, [])

  useEffect(() => {
    if (!isAlunoContext()) return
    try {
      const root = document.documentElement
      root.style.setProperty('--brand-primary', String(brand?.primaryColor || '#0047BB'))
      root.style.setProperty('--brand-primary-hover', String(brand?.primaryHoverColor || '#003399'))
      root.style.setProperty('--brand-sidebar-from', String(brand?.sidebarFrom || 'rgb(15, 6, 39)'))
      root.style.setProperty('--brand-sidebar-to', String(brand?.sidebarTo || 'rgb(0, 0, 104)'))
    } catch (_) {}
  }, [brand])

  const value = useMemo(() => ({ brand, loading }), [brand, loading])
  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>
}

export function useBranding() {
  return useContext(BrandingContext)
}
