import React, { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export default function CheckoutPopup({ open, url, title, onClose, footerText }) {
  const iframeRef = useRef(null)

  const resolvedTitle = String(title || 'Checkout').trim() || 'Checkout'
  const resolvedUrl = String(url || '').trim()

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        try { onClose && onClose() } catch (_) {}
      }
    }
    document.addEventListener('keydown', onKeyDown)
    const prev = document?.body?.style?.overflow
    if (document?.body?.style) document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (document?.body?.style) document.body.style.overflow = prev || ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[220]">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Fechar" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="absolute left-1/2 top-1/2 w-[calc(100%-18px)] max-w-[1100px] -translate-x-1/2 -translate-y-1/2 rounded-[14px] bg-white border border-[#E3E4E5] shadow-2xl overflow-hidden"
      >
        <button
          type="button"
          className="absolute right-4 top-4 z-10 h-10 w-10 rounded-full bg-white/30 text-[#0F172A] flex items-center justify-center border border-white/40 shadow-lg backdrop-blur-md hover:bg-white/50 transition-colors"
          aria-label="Fechar"
          onClick={onClose}
        >
          <X size={18} />
        </button>

        {footerText ? (
          <div className="absolute left-4 top-4 z-10 max-w-[calc(100%-88px)] rounded-full px-3 py-2 text-[12px] text-white bg-black/35 backdrop-blur-md">
            {String(footerText)}
          </div>
        ) : null}

        <div className="w-full bg-white h-[82vh] overflow-hidden">
          {resolvedUrl ? (
            <iframe
              ref={iframeRef}
              title={resolvedTitle}
              src={resolvedUrl}
              className="w-full h-[82vh] bg-white"
              allow="payment *; clipboard-write; fullscreen"
              sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-top-navigation-by-user-activation"
            />
          ) : (
            <div className="p-6 text-[13px] text-[#475569]">Link de checkout indisponível.</div>
          )}
        </div>
      </div>
    </div>
  )
}
