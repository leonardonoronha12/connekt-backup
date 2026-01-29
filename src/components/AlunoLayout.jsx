import React, { useEffect, useState } from 'react'
import { Database, GraduationCap, Menu, Monitor, Settings, X } from 'lucide-react'
import Header from '@/components/Header'

function navigateTo(path) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

const navSections = [
  {
    title: 'MENU',
    items: [
      { label: 'Painel', Icon: GraduationCap, path: '/aluno' },
      { label: 'Simulados', Icon: Monitor, path: '/aluno/simulados' },
      { label: 'Banco de Questões', Icon: Database, path: '/aluno/banco-de-questoes' },
    ],
  },
  {
    title: 'GERAL',
    items: [{ label: 'Configurações', Icon: Settings, path: '/aluno/configuracoes' }],
  },
]

export default function AlunoLayout({ children }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [currentPath, setCurrentPath] = useState(() => String(window.location.pathname || ''))

  useEffect(() => {
    const onPop = () => setCurrentPath(String(window.location.pathname || ''))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">
      <aside
        className="hidden lg:flex w-[260px] h-screen flex-col"
        style={{ background: 'linear-gradient(180deg, rgb(15, 6, 39) 0%, rgb(0, 0, 104) 100%)' }}
      >
        <div className="flex justify-center py-5">
          <img src="/logo-expanded.svg" alt="Connekt" className="w-[119px] h-[35px]" />
        </div>
        <div className="h-px mx-10" style={{ backgroundColor: 'rgb(47, 58, 86)' }} />
        <nav className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
          {navSections.map((section, idx) => (
            <div key={`${section.title}-${idx}`}>
              <div className="text-[11px] font-semibold text-white/50 uppercase tracking-wider px-2 mb-3">
                {section.title}
              </div>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const itemPathname = String(item.path || '').split('?')[0] || '/'
                  const isActive = itemPathname === '/aluno'
                    ? (currentPath === '/aluno' || currentPath.startsWith('/aluno/aula') || currentPath.startsWith('/aluno/curso'))
                    : (itemPathname === '/aluno/simulados'
                      ? currentPath.startsWith('/aluno/simulados') || currentPath === '/aluno/reposta-correta-simulado'
                      : currentPath === itemPathname)
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => navigateTo(item.path)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[13px] font-semibold transition-colors ${
                        isActive ? 'bg-[#0047BB] text-white' : 'text-white/80 hover:bg-white/10'
                      }`}
                    >
                      <item.Icon className="w-5 h-5" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {mobileNavOpen ? (
        <div className="lg:hidden fixed inset-0 z-[70]">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileNavOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-[300px] bg-[#0F0627] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <img src="/logo-expanded.svg" alt="Connekt" className="w-[119px] h-[35px]" />
              <button
                type="button"
                className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Fechar menu"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
              {navSections.map((section, idx) => (
                <div key={`${section.title}-m-${idx}`}>
                  <div className="text-[11px] font-semibold text-white/50 uppercase tracking-wider px-2 mb-3">
                    {section.title}
                  </div>
                  <div className="space-y-1">
                    {section.items.map((item) => {
                      const itemPathname = String(item.path || '').split('?')[0] || '/'
                      const isActive = itemPathname === '/aluno'
                        ? (currentPath === '/aluno' || currentPath.startsWith('/aluno/aula') || currentPath.startsWith('/aluno/curso'))
                        : (itemPathname === '/aluno/simulados'
                          ? currentPath.startsWith('/aluno/simulados') || currentPath === '/aluno/reposta-correta-simulado'
                          : currentPath === itemPathname)
                      return (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => {
                            setMobileNavOpen(false)
                            navigateTo(item.path)
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[13px] font-semibold transition-colors ${
                            isActive ? 'bg-[#0047BB] text-white' : 'text-white/80 hover:bg-white/10'
                          }`}
                        >
                          <item.Icon className="w-5 h-5" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </div>
        </div>
      ) : null}

      <div className="flex-1 min-h-screen lg:h-screen flex flex-col overflow-hidden">
        <button
          type="button"
          className="lg:hidden fixed top-3 left-3 z-[60] h-10 w-10 rounded-full bg-white border border-[#E3E4E5] flex items-center justify-center shadow-sm"
          aria-label="Abrir menu"
          onClick={() => setMobileNavOpen(true)}
        >
          <Menu className="w-5 h-5 text-[#22252B]" />
        </button>
        <Header />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

