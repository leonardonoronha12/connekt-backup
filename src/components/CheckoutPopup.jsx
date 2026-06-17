import React, { useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function CheckoutPopup({ open, url, title, onClose, footerText }) {
  const iframeRef = useRef(null)
  const [copied, setCopied] = useState(false)

  const resolvedTitle = String(title || 'Checkout').trim() || 'Checkout'
  const resolvedUrl = String(url || '').trim()

  const canCopy = useMemo(() => {
    return !!resolvedUrl && typeof navigator !== 'undefined' && !!navigator.clipboard?.writeText
  }, [resolvedUrl])

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
    setCopied(false)
  }, [open, resolvedUrl])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[220]">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Fechar" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="absolute left-1/2 top-1/2 w-[calc(100%-18px)] max-w-[1100px] -translate-x-1/2 -translate-y-1/2 rounded-[14px] bg-white border border-[#E3E4E5] shadow-2xl overflow-hidden"
      >
        <div className="px-4 py-3 border-b border-[#E3E4E5] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[14px] font-bold text-[#1E1B39] truncate">{resolvedTitle}</div>
            {footerText ? (
              <div className="text-[12px] text-[#737780] truncate">{String(footerText)}</div>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {canCopy ? (
              <Button
                type="button"
                variant="outline"
                className="h-9"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(resolvedUrl)
                    setCopied(true)
                    try { window.setTimeout(() => setCopied(false), 2500) } catch (_) {}
                  } catch (_) {}
                }}
              >
                {copied ? 'Link copiado' : 'Copiar link'}
              </Button>
            ) : null}
            <button
              type="button"
              className="h-10 w-10 rounded-full bg-[#F1F5F9] text-[#0F172A] flex items-center justify-center"
              aria-label="Fechar"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="w-full bg-[#F8FAFC]">
          {resolvedUrl ? (
            <iframe
              ref={iframeRef}
              title={resolvedTitle}
              src={resolvedUrl}
              className="w-full h-[78vh] bg-white"
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

