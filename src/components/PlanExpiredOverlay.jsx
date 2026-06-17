import React, { useEffect, useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { planService } from '@/services/planService.js'
import { Button } from '@/components/ui/button'

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

export default function PlanExpiredOverlay() {
  const [visible, setVisible] = useState(false)
  const [hasActivePlan, setHasActivePlan] = useState(true)
  const [locationKey, setLocationKey] = useState(() => {
    try { return `${window.location.pathname}${window.location.search}` } catch (_) { return '' }
  })

  const isAluno = useMemo(() => {
    try { return String(window.location.pathname || '').startsWith('/aluno') } catch (_) { return false }
  }, [locationKey])

  useEffect(() => {
    const sync = () => {
      setHasActivePlan(computeHasActivePlan())
      try { setLocationKey(`${window.location.pathname}${window.location.search}`) } catch (_) { setLocationKey('') }
    }
    const onStorage = (e) => {
      if (e?.key === 'connekt_subscription' || e?.key === 'connekt_active_plan') sync()
    }
    window.addEventListener('focus', sync)
    window.addEventListener('popstate', sync)
    window.addEventListener('storage', onStorage)
    sync()
    return () => {
      window.removeEventListener('focus', sync)
      window.removeEventListener('popstate', sync)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  useEffect(() => {
    const onPlanExpired = () => {
      if (isAluno) return
      setHasActivePlan(computeHasActivePlan())
      setVisible(true)
      try {
        window.setTimeout(() => setVisible(false), 2200)
      } catch (_) {}
    }
    window.addEventListener('connekt:plan-expired', onPlanExpired)
    return () => window.removeEventListener('connekt:plan-expired', onPlanExpired)
  }, [isAluno])

  if (isAluno) return null
  if (hasActivePlan) return null
  if (!visible) return null

  return (
    <div className="fixed inset-0 z-[9998] pointer-events-none">
      <div className="absolute inset-0 bg-black/40 opacity-0 animate-in fade-in-0 duration-200" />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="pointer-events-auto w-full max-w-[520px] rounded-[18px] border border-[#FECACA] bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in-0 duration-200">
          <div className="p-5 flex items-start gap-4">
            <div className="w-11 h-11 rounded-full bg-[#FEF2F2] border border-[#FECACA] flex items-center justify-center text-[#DC2626] flex-shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-bold text-[#991B1B]">Plano expirado</div>
              <div className="mt-1 text-[12px] text-[#7F1D1D] leading-[16px]">
                Para continuar, faça o upgrade do seu plano.
              </div>
              <div className="mt-4 flex items-center justify-end">
                <Button
                  type="button"
                  className="h-9 bg-[#DC2626] hover:bg-[#B91C1C] text-white"
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
                </Button>
              </div>
            </div>
          </div>
          <div className="h-1 w-full bg-[#FEE2E2] overflow-hidden">
            <div className="h-full w-full bg-[#DC2626] origin-left scale-x-0 animate-[connektPlanExpiredBar_2200ms_linear_forwards]" />
          </div>
        </div>
      </div>
    </div>
  )
}

