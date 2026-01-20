import React, { useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/SupabaseAuthContext.jsx'

function navigateTo(path) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export default function SimuladoAcessoPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [simulado, setSimulado] = useState(null)

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
        if (!simId || !user?.id) {
          if (active) setSimulado(null)
          return
        }
        const { data } = await supabase.from('simulados').select('*').eq('id', simId).maybeSingle()
        if (!active) return
        setSimulado(data || null)
      } catch (_) {
        if (active) setSimulado(null)
      } finally {
        if (active) setLoading(false)
      }
    }
    run()
    return () => {
      active = false
    }
  }, [simId, user?.id])

  const title = simulado?.title || 'Simulado'
  const cover = simulado?.cover_image_url || '/resposta correta.png'
  const isPaid = !!simulado?.is_paid

  return (
    <div className="w-full">
      <Helmet>
        <title>{`Connekt - ${title}`}</title>
      </Helmet>

      <div className="w-full max-w-[1076px] mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
          <div className="rounded-[12px] bg-white border border-[#E3E4E5] p-6">
            <div className="text-[28px] font-semibold text-[#0047BB] leading-[34px]">Connekt</div>
            <div className="mt-3 text-[14px] text-[#737780]">
              {loading ? 'Carregando informações do simulado...' : 'Acesse o simulado e acompanhe seu desempenho.'}
            </div>
            <div className="mt-5">
              <button
                type="button"
                className="h-[40px] px-4 bg-[#0047BB] text-white rounded-[4px] text-[14px] font-medium hover:bg-[#003da0] transition-colors"
                onClick={() => {
                  if (!simId) return
                  navigateTo(`/reposta-correta-simulado?simId=${encodeURIComponent(simId)}`)
                }}
              >
                {isPaid ? 'Comprar simulado' : 'Acessar simulado'}
              </button>
            </div>
          </div>

          <div className="rounded-[12px] overflow-hidden border border-[#E3E4E5] bg-white">
            <img src={cover} alt={title} className="w-full h-[320px] object-cover" />
          </div>
        </div>
      </div>
    </div>
  )
}

