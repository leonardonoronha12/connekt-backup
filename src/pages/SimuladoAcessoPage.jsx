import React, { useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '@/contexts/SupabaseAuthContext.jsx'

function navigateTo(path) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export default function SimuladoAcessoPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)

  const simId = useMemo(() => {
    try {
      const p = new URLSearchParams(window.location.search || '')
      return p.get('simId') || ''
    } catch (_) {
      return ''
    }
  }, [])

  useEffect(() => {
    let active = true
    const run = async () => {
      setLoading(true)
      try {
        if (!simId) return
        if (user?.id) {
          navigateTo(`/reposta-correta-simulado?simId=${encodeURIComponent(simId)}`)
        }
      } catch (_) {
      } finally {
        if (active) setLoading(false)
      }
    }
    run()
    return () => {
      active = false
    }
  }, [simId, user?.id])

  const title = 'Simulado'

  return (
    <div className="w-full">
      <Helmet>
        <title>{`Connekt - ${title}`}</title>
      </Helmet>

      <div className="w-full max-w-[1076px] mx-auto px-6">
        <div className="text-[12px] text-[#737780] py-6">{loading ? 'Redirecionando...' : ''}</div>
      </div>
    </div>
  )
}
