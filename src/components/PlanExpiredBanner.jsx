import React, { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { planService } from '@/services/planService.js'

function computeHasActivePlan() {
  try {
    const sub = typeof planService.getSubscription === 'function' ? planService.getSubscription() : null
    const status = String(sub?.status || '').toLowerCase()
    const planKey = String(sub?.planKey || '').toLowerCase()
    const expiresAt = sub?.expiresAt ? new Date(sub.expiresAt).getTime() : 0
    if (planKey) {
      if (expiresAt && isFinite(expiresAt)) return expiresAt > Date.now()
      return status === 'active' || status === 'trial' || status === 'canceled'
    }
    const legacy = typeof planService.getActivePlan === 'function' ? planService.getActivePlan() : null
    return !!legacy
  } catch (_) {
    return false
  }
}

export default function PlanExpiredBanner() {
  const [hasActivePlan, setHasActivePlan] = useState(true)

  useEffect(() => {
    const sync = () => setHasActivePlan(computeHasActivePlan())
    const onStorage = (e) => {
      if (e?.key === 'connekt_subscription' || e?.key === 'connekt_active_plan') sync()
    }
    window.addEventListener('focus', sync)
    window.addEventListener('storage', onStorage)
    sync()
    return () => {
      window.removeEventListener('focus', sync)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  if (hasActivePlan) return null

  return (
    <div className="w-full px-4 sm:px-6 pt-3">
      <div className="rounded-[14px] border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 flex items-center justify-between gap-3 connekt-fade-in">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-white/70 border border-[#FECACA] text-[#DC2626] flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[12px] font-bold text-[#991B1B]">Plano expirado</div>
            <div className="text-[12px] text-[#7F1D1D] truncate">Faça o upgrade para continuar usando as ferramentas do produtor.</div>
          </div>
        </div>
        <button
          type="button"
          className="h-9 px-4 rounded-[10px] bg-[#DC2626] text-white text-[12px] font-semibold hover:bg-[#B91C1C] transition-colors flex-shrink-0"
          onClick={() => {
            try {
              window.history.pushState({}, '', '/configuracoes?tab=plano')
              window.dispatchEvent(new PopStateEvent('popstate'))
            } catch (_) {
              try { window.location.assign('/configuracoes?tab=plano') } catch (_) {}
            }
          }}
        >
          Ver planos
        </button>
      </div>
    </div>
  )
}

