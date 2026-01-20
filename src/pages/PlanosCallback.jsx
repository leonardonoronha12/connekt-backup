import React, { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/SupabaseAuthContext.jsx'
import { planService } from '@/services/planService.js'

export default function PlanosCallback() {
  const { user } = useAuth()
  const [status, setStatus] = useState('loading')
  const [plan, setPlan] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const statusParam = params.get('status') || 'success'
    const planParam = params.get('plan')
    const billingParam = params.get('billing')
    const sessionId = params.get('session_id')
    const linkId = params.get('linkId') || params.get('paymentLinkId')

    async function run() {
      const result = await planService.handleCheckoutCallback({ status: statusParam, plan: planParam, billing: billingParam, session_id: sessionId, link_id: linkId }, user)
      if (result.ok) {
        setPlan(result.plan)
        setStatus('success')
        // Navega para /planos sem recarregar a página para evitar net::ERR_ABORTED
        setTimeout(() => {
          try {
            window.history.pushState({}, '', '/planos')
            window.dispatchEvent(new PopStateEvent('popstate'))
          } catch (e) {
            // Fallback para navegação tradicional caso pushState falhe
            window.location.replace('/planos')
          }
        }, 800)
      } else {
        setError(result.error || 'Erro ao ativar plano')
        setStatus('error')
      }
    }

    run()
  }, [user])

  return (
    <div style={{ padding: 24 }}>
      {status === 'loading' && <p>Processando sua ativação de plano…</p>}
      {status === 'success' && <p>Plano ativado: {plan}. Redirecionando…</p>}
      {status === 'error' && <p>Falha ao ativar plano: {error}</p>}
    </div>
  )
}
