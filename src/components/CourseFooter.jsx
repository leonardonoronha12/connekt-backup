import React from 'react'

export default function CourseFooter({ className = '' }) {
  return (
    <div className={`w-full bg-[#E8F0FF] ${className}`}>
      <div className="mx-auto w-full max-w-[1200px] px-6 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <img src="/logo%20connekt.png" alt="Logo" className="h-7 w-auto" />
          <div className="mt-2 text-[11px] text-[#6B7588]">Copyright © 2025 - Todos os direitos reservados</div>
        </div>
        <div className="text-[11px] text-[#6B7588] flex items-center gap-4">
          <a href="#" className="hover:text-[#1E1B39]">
            Suporte
          </a>
          <a
            href="/termos#termos"
            className="hover:text-[#1E1B39]"
            onClick={(e) => {
              e.preventDefault()
              window.history.pushState({}, '', '/termos#termos')
              window.dispatchEvent(new PopStateEvent('popstate'))
            }}
          >
            Termos de uso
          </a>
          <a
            href="/termos#privacidade"
            className="hover:text-[#1E1B39]"
            onClick={(e) => {
              e.preventDefault()
              window.history.pushState({}, '', '/termos#privacidade')
              window.dispatchEvent(new PopStateEvent('popstate'))
            }}
          >
            Política de privacidade
          </a>
        </div>
      </div>
    </div>
  )
}
