import React from 'react'

export default function AppLoadingScreen({ title = 'Carregando…', subtitle = 'Preparando sua área' }) {
  return (
    <div className="min-h-[70vh] w-full flex items-center justify-center bg-[#F5F6FA] px-6">
      <div className="relative w-full max-w-[520px] overflow-hidden rounded-[16px] border border-[#E3E4E5] bg-white p-6 shadow-sm connekt-fade-in">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(0,71,187,0.10),_rgba(255,255,255,0)_55%)]" />
        <div className="relative flex flex-col items-center text-center">
          <div className="relative">
            <div className="absolute -inset-6 rounded-full bg-[#0047BB]/10 blur-xl animate-pulse" />
            <img
              src="/logo-expanded.svg"
              alt="Connekt"
              className="relative h-12 w-auto select-none pointer-events-none animate-[connektLogoFloat_1400ms_ease-in-out_infinite]"
            />
          </div>
          <div className="mt-4 text-[14px] font-semibold text-[#1E1B39]">{String(title || '').trim() || 'Carregando…'}</div>
          <div className="mt-1 text-[12px] text-[#64748B]">{String(subtitle || '').trim() || 'Preparando sua área'}</div>

          <div className="mt-6 w-full space-y-3">
            <div className="flex items-center gap-3">
              <div className="connekt-skeleton h-9 w-9 rounded-[12px]" />
              <div className="flex-1 space-y-2">
                <div className="connekt-skeleton h-3 w-[72%] rounded" />
                <div className="connekt-skeleton h-3 w-[54%] rounded" />
              </div>
            </div>
            <div className="connekt-skeleton h-10 w-full rounded-[12px]" />
            <div className="connekt-skeleton h-10 w-full rounded-[12px]" />
          </div>
        </div>
      </div>
    </div>
  )
}
