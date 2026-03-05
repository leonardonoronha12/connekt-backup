import React, { useMemo } from 'react'
import { Monitor, Smartphone, X, ShieldAlert } from 'lucide-react'
import { useAuth } from '@/contexts/SupabaseAuthContext'

export default function DeviceLockPage() {
  const { deviceLock, resolveDeviceLock } = useAuth()

  const device = deviceLock?.activeDevice || null
  const label = device?.label || device?.active_device_label || 'Outro dispositivo'
  const expiresAtRaw = device?.expires_at || device?.active_device_expires_at || null
  const lastSeenAtRaw = device?.last_seen_at || device?.active_device_last_seen_at || null
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null
  const lastSeenAt = lastSeenAtRaw ? new Date(lastSeenAtRaw) : null

  const minutesToExpire = useMemo(() => {
    try {
      if (!expiresAt || !isFinite(expiresAt.getTime())) return null
      const diff = expiresAt.getTime() - Date.now()
      return Math.max(0, Math.ceil(diff / 60000))
    } catch (_) {
      return null
    }
  }, [expiresAtRaw])

  const formatTime = (d) => {
    try {
      if (!d || !isFinite(d.getTime())) return '—'
      return d.toLocaleString('pt-BR')
    } catch (_) {
      return '—'
    }
  }

  const deviceType = String(deviceLock?.deviceType || '').toLowerCase() === 'mobile' ? 'mobile' : 'desktop'
  const isMobile = deviceType === 'mobile' || (() => {
    const ua = String(device?.user_agent || device?.active_device_user_agent || '')
    return /iphone|ipad|ipod|android/i.test(ua)
  })()
  const isAwaiting = String(deviceLock?.reason || '') === 'awaiting_approval'

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4">
      <div className="w-full max-w-[560px] bg-white border border-[#E3E4E5] rounded-[12px] shadow-xl overflow-hidden">
        <div className="p-6 border-b border-[#E3E4E5] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#FEF2F2] border border-[#FECACA] flex items-center justify-center text-[#DC2626]">
              <ShieldAlert size={20} />
            </div>
            <div>
              <div className="text-[16px] font-bold text-[#1E1B39]">Limite de dispositivo atingido</div>
              <div className="text-[12px] text-[#737780]">Sua conta permite apenas 1 desktop e 1 mobile cadastrados.</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => resolveDeviceLock('signout')}
            className="text-[#737780] hover:text-[#1E1B39] transition-colors"
            aria-label="Sair"
            title="Sair"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="border border-[#E3E4E5] rounded-[10px] p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 bg-[#F1F5F9] rounded-full flex items-center justify-center text-[#64748B] flex-shrink-0">
                {isMobile ? <Smartphone size={24} /> : <Monitor size={24} />}
              </div>
              <div className="min-w-0">
                <div className="text-[14px] font-bold text-[#1E1B39] break-words">{label}</div>
                <div className="text-[12px] text-[#737780] mt-1">
                  Última atividade: {formatTime(lastSeenAt)}
                </div>
                <div className="text-[12px] text-[#737780] mt-1">
                  Expira: {formatTime(expiresAt)}{minutesToExpire !== null ? ` (${minutesToExpire} min)` : ''}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#F8FAFC] border border-[#E3E4E5] rounded-[10px] p-4 text-[12px] text-[#404040]">
            {isAwaiting
              ? 'Solicitação enviada. Assim que for aprovada em um dispositivo cadastrado, você poderá entrar automaticamente.'
              : 'Para usar esta conta aqui, envie uma solicitação de entrada. A aprovação deve ser feita em um dos dispositivos cadastrados.'}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              disabled={isAwaiting}
              onClick={() => resolveDeviceLock('request')}
              className={`flex-1 px-4 py-3 rounded-[8px] text-[14px] font-semibold transition-colors ${isAwaiting ? 'bg-[#0047BB] text-white opacity-60 cursor-not-allowed' : 'bg-[#0047BB] text-white hover:bg-[#003da0]'}`}
            >
              {isAwaiting ? 'Aguardando aprovação…' : 'Solicitar entrada deste dispositivo'}
            </button>
            <button
              type="button"
              onClick={() => resolveDeviceLock('signout')}
              className="flex-1 border border-[#E3E4E5] text-[#1E1B39] px-4 py-3 rounded-[8px] text-[14px] font-semibold hover:bg-[#F8FAFC] transition-colors"
            >
              Sair
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

