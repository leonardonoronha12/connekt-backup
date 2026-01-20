import React, { useEffect, useState } from 'react'
import { X, AlertTriangle } from 'lucide-react'

export default function CancelSubscriptionModal({ open, onClose, onConfirm, loading = false }) {
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (!open) {
      setReason('')
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-[9999] flex items-start justify-center p-4 pt-16 overflow-y-auto">
      <div className="bg-white w-full max-w-[500px] rounded-[12px] shadow-xl animate-in fade-in zoom-in duration-200 max-h-[calc(100vh-4rem)] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-[#E3E4E5]">
          <h2 className="text-[18px] font-bold text-[#1E1B39]">Cancelar assinatura</h2>
          <button
            onClick={onClose}
            className="text-[#737780] hover:text-[#1E1B39] transition-colors"
            type="button"
            disabled={loading}
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1 min-h-0">
          <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-[8px] p-4 mb-8 flex gap-3">
            <AlertTriangle size={20} className="text-[#DC2626] flex-shrink-0" />
            <p className="text-[12px] text-[#DC2626] leading-relaxed font-medium">
              Ao confirmar esta ação, os pagamentos do seu plano serão encerrados e o acesso à plataforma será imediatamente suspenso.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-[14px] font-medium text-[#1E1B39]">
              Motivo do Cancelamento<span className="text-[#DC2626] ml-1">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Descreva o motivo..."
              className="w-full h-32 px-3 py-2 border border-[#E3E4E5] rounded-[6px] text-[14px] focus:outline-none focus:border-[#DC2626] resize-none bg-[#F8FAFC]"
              disabled={loading}
            />
          </div>
        </div>

        <div className="p-6 border-t border-[#E3E4E5] flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-[#0047BB] text-[#0047BB] rounded-[6px] text-[14px] font-medium hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            type="button"
            disabled={loading}
          >
            Manter assinatura
          </button>
          <button
            disabled={loading || !reason.trim()}
            onClick={() => onConfirm?.(reason.trim())}
            className="px-4 py-2 bg-[#DC2626] text-white rounded-[6px] text-[14px] font-medium hover:bg-[#b91c1c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            type="button"
          >
            {loading ? 'Cancelando…' : 'Cancelar assinatura'}
          </button>
        </div>
      </div>
    </div>
  )
}
