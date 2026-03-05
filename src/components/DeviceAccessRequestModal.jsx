import React, { useMemo, useState } from 'react'
import { Monitor, Smartphone, X, ShieldAlert } from 'lucide-react'
import { useAuth } from '@/contexts/SupabaseAuthContext'

export default function DeviceAccessRequestModal() {
  const { pendingDeviceRequest, approveDeviceRequest, denyDeviceRequest } = useAuth()
  const [busy, setBusy] = useState(false)

  const isOpen = !!pendingDeviceRequest?.device_id

  const deviceLabel = String(pendingDeviceRequest?.label || 'Novo dispositivo').trim()
  const deviceType = String(pendingDeviceRequest?.device_type || '').toLowerCase() === 'mobile' ? 'mobile' : 'desktop'
  const requestedAt = useMemo(() => {
    try {
      const d = pendingDeviceRequest?.requested_at ? new Date(pendingDeviceRequest.requested_at) : null
      if (!d || !isFinite(d.getTime())) return '—'
      return d.toLocaleString('pt-BR')
    } catch (_) {
      return '—'
    }
  }, [pendingDeviceRequest?.requested_at])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[300]">
      <div className="absolute inset-0 bg-black/40" />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-[520px] bg-white border border-[#E3E4E5] rounded-[12px] shadow-xl overflow-hidden">
          <div className="p-5 border-b border-[#E3E4E5] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FEF2F2] border border-[#FECACA] flex items-center justify-center text-[#DC2626]">
                <ShieldAlert size={18} />
              </div>
              <div>
                <div className="text-[15px] font-bold text-[#1E1B39]">Solicitação de acesso</div>
                <div className="text-[12px] text-[#737780]">Um dispositivo quer entrar na sua conta.</div>
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                if (busy) return
                setBusy(true)
                try { await denyDeviceRequest() } finally { setBusy(false) }
              }}
              className="text-[#737780] hover:text-[#1E1B39] transition-colors"
              aria-label="Fechar"
              title="Fechar"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-5 space-y-4">
            <div className="border border-[#E3E4E5] rounded-[10px] p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 bg-[#F1F5F9] rounded-full flex items-center justify-center text-[#64748B] flex-shrink-0">
                  {deviceType === 'mobile' ? <Smartphone size={24} /> : <Monitor size={24} />}
                </div>
                <div className="min-w-0">
                  <div className="text-[14px] font-bold text-[#1E1B39] break-words">{deviceLabel}</div>
                  <div className="text-[12px] text-[#737780] mt-1">Solicitado em: {requestedAt}</div>
                  <div className="text-[12px] text-[#737780] mt-1">
                    Tipo: {deviceType === 'mobile' ? 'Mobile' : 'Desktop'}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#F8FAFC] border border-[#E3E4E5] rounded-[10px] p-4 text-[12px] text-[#404040]">
              Ao aprovar, este {deviceType === 'mobile' ? 'mobile' : 'desktop'} ficará cadastrado e o anterior deste tipo será substituído.
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  if (busy) return
                  setBusy(true)
                  try { await approveDeviceRequest() } finally { setBusy(false) }
                }}
                className={`flex-1 px-4 py-3 rounded-[8px] text-[14px] font-semibold transition-colors ${busy ? 'opacity-60 cursor-not-allowed bg-[#0047BB] text-white' : 'bg-[#0047BB] text-white hover:bg-[#003da0]'}`}
              >
                Aprovar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  if (busy) return
                  setBusy(true)
                  try { await denyDeviceRequest() } finally { setBusy(false) }
                }}
                className={`flex-1 border border-[#E3E4E5] px-4 py-3 rounded-[8px] text-[14px] font-semibold transition-colors ${busy ? 'opacity-60 cursor-not-allowed text-[#1E1B39]' : 'text-[#1E1B39] hover:bg-[#F8FAFC]'}`}
              >
                Recusar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

