import React, { useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'

export default function CheckoutPopup({ open, url, title, onClose, footerText }) {
  const iframeRef = useRef(null)
  const [loaded, setLoaded] = useState(false)

  const resolvedTitle = String(title || 'Checkout').trim() || 'Checkout'
  const resolvedUrl = String(url || '').trim()
  const hasUrl = !!resolvedUrl
  const frameKey = useMemo(() => {
    return `${resolvedTitle}::${resolvedUrl}`
  }, [resolvedTitle, resolvedUrl])

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

  useEffect(() => {
    if (!open) return
    setLoaded(false)
  }, [open, frameKey])

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

        <div className="relative w-full bg-white h-[82vh] overflow-auto [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.75)_transparent] [&::-webkit-scrollbar]:w-[10px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300/70 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-[3px] [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-clip-padding hover:[&::-webkit-scrollbar-thumb]:bg-slate-400/80">
          {hasUrl ? (
            <iframe
              key={frameKey}
              ref={iframeRef}
              title={resolvedTitle}
              src={resolvedUrl}
              className="w-full h-[2400px] bg-white"
              allow="payment *; clipboard-write; fullscreen"
              sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-top-navigation-by-user-activation"
              scrolling="no"
              onLoad={() => {
                try { window.setTimeout(() => setLoaded(true), 250) } catch (_) { setLoaded(true) }
              }}
            />
          ) : (
            <div className="p-6 text-[13px] text-[#475569]">Link de checkout indisponível.</div>
          )}

          {!loaded && hasUrl ? (
            <div className="absolute inset-0 bg-white">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(0,71,187,0.10),_rgba(255,255,255,0)_55%)]" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-11 w-11 rounded-full border-2 border-[#E2E8F0] border-t-[#0047BB] animate-spin" />
                  <div className="text-[12px] text-[#475569] font-medium">Carregando checkout…</div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
