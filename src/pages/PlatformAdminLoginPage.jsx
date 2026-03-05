import React, { useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Eye, EyeOff, Lock } from 'lucide-react'
import { useAuth } from '@/contexts/SupabaseAuthContext'
import { supabase } from '@/lib/supabaseClient'
import { toast } from '@/hooks/use-toast.ts'

function navigateTo(path) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export default function PlatformAdminLoginPage() {
  const { signIn, signOut } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const cleanEmail = useMemo(() => String(email || '').trim(), [email])

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!cleanEmail || !password) return
    setLoading(true)
    try {
      try { sessionStorage.setItem('connekt_login_mode', 'admin') } catch (_) { try { localStorage.setItem('connekt_login_mode', 'admin') } catch (_) {} }
      const { error } = await signIn(cleanEmail, password)
      if (error) {
        toast({ title: 'Falha no login', description: error?.message || 'Credenciais inválidas', variant: 'destructive' })
        return
      }
      const token = (await supabase.auth.getSession().catch(() => ({ data: null })))?.data?.session?.access_token || ''
      const r = await fetch('/api/admin/me', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      if (!r.ok) {
        await signOut()
        toast({ title: 'Acesso negado', description: 'Esta conta não tem permissão de administrador.', variant: 'destructive' })
        return
      }
      navigateTo('/admin')
    } catch (err) {
      try { await signOut() } catch (_) {}
      toast({ title: 'Erro', description: err?.message || 'Erro ao autenticar', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Helmet>
        <title>Connekt - Admin</title>
      </Helmet>
      <div className="min-h-screen bg-[#F5F6FA] flex items-center justify-center p-6">
        <div className="w-full max-w-[440px] rounded-[16px] border border-[#E3E4E5] bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-[#E3E4E5]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[12px] bg-[#EEF2FF] flex items-center justify-center">
                <Lock className="w-5 h-5 text-[#0047BB]" />
              </div>
              <div>
                <div className="text-[14px] font-semibold text-[#1E1B39]">Painel administrativo</div>
                <div className="text-[12px] text-[#737780]">Acesso restrito</div>
              </div>
            </div>
          </div>

          <form className="p-6 space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="text-[12px] text-[#737780]">Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                className="mt-2 w-full h-[40px] rounded-[8px] border border-[#E3E4E5] px-3 text-[13px] outline-none focus:border-[#0047BB]"
                placeholder="admin@connektco.com"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="text-[12px] text-[#737780]">Senha</label>
              <div className="mt-2 relative">
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? 'text' : 'password'}
                  className="w-full h-[40px] rounded-[8px] border border-[#E3E4E5] px-3 pr-10 text-[13px] outline-none focus:border-[#0047BB]"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-[8px] flex items-center justify-center hover:bg-[#F3F4F6]"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4 text-[#737780]" /> : <Eye className="w-4 h-4 text-[#737780]" />}
                </button>
              </div>
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={loading || !cleanEmail || !password}
                className="w-full h-[42px] rounded-[10px] bg-[#0047BB] text-white text-[13px] font-semibold hover:bg-[#003da0] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </div>

            <button
              type="button"
              className="w-full h-[40px] rounded-[10px] border border-[#E3E4E5] bg-white text-[13px] font-semibold text-[#1E1B39] hover:bg-[#F8FAFC]"
              onClick={async () => {
                try {
                  await signOut()
                } catch (_) {}
                try { sessionStorage.removeItem('connekt_login_mode') } catch (_) {}
                try { localStorage.removeItem('connekt_login_mode') } catch (_) {}
                navigateTo('/login')
              }}
            >
              Voltar
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
