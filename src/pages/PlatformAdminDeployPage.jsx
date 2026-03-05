import React, { useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { ArrowLeft, CheckCircle2, Copy, ExternalLink, Loader2, Play, XCircle } from 'lucide-react'
import { useAuth } from '@/contexts/SupabaseAuthContext'
import { toast } from '@/hooks/use-toast.ts'

function navigateTo(path) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export default function PlatformAdminDeployPage() {
  const { session } = useAuth()
  const authHeaders = useMemo(() => {
    const t = String(session?.access_token || '')
    return t ? { Authorization: `Bearer ${t}` } : {}
  }, [session?.access_token])

  const [status, setStatus] = useState({ loading: true, hasToken: false, projectId: '', teamId: '' })
  const [deploying, setDeploying] = useState(false)
  const [lastUrl, setLastUrl] = useState('')
  const [deployHookUrl, setDeployHookUrl] = useState(() => {
    try { return String(localStorage.getItem('connekt_vercel_deploy_hook_url') || '') } catch (_) { return '' }
  })
  const [hookDeploying, setHookDeploying] = useState(false)

  useEffect(() => {
    let active = true
    const run = async () => {
      try {
        const r = await fetch('/api/admin/vercel/status', { headers: authHeaders })
        const body = await r.json().catch(() => ({}))
        if (!active) return
        if (!r.ok) throw new Error(body?.error || 'Falha ao carregar status')
        setStatus({
          loading: false,
          hasToken: Boolean(body?.vercel?.hasToken),
          projectId: String(body?.vercel?.projectId || ''),
          teamId: String(body?.vercel?.teamId || ''),
        })
      } catch (e) {
        if (!active) return
        setStatus({ loading: false, hasToken: false, projectId: '', teamId: '' })
        toast({ title: 'Erro', description: e?.message || 'Erro ao carregar status', variant: 'destructive' })
      }
    }
    run()
    return () => { active = false }
  }, [authHeaders])

  const runDeploy = async () => {
    setDeploying(true)
    try {
      const r = await fetch('/api/admin/vercel/deploy', { method: 'POST', headers: { ...authHeaders } })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body?.error || body?.message || 'Falha ao publicar')
      const url = String(body?.created?.url || '').trim()
      setLastUrl(url)
      toast({ title: 'Publicação iniciada', description: url ? 'Link copiado.' : 'Deploy disparado.' })
      if (url) {
        try { await navigator.clipboard.writeText(url) } catch (_) {}
      }
    } catch (e) {
      toast({ title: 'Erro', description: e?.message || 'Erro ao publicar', variant: 'destructive' })
    } finally {
      setDeploying(false)
    }
  }

  const runDeployHook = async () => {
    const url = String(deployHookUrl || '').trim()
    if (!url) return
    let parsed = null
    try { parsed = new URL(url) } catch (_) { parsed = null }
    if (!parsed || !String(parsed.protocol || '').startsWith('http')) {
      toast({ title: 'URL inválida', description: 'Cole a URL completa do Deploy Hook.', variant: 'destructive' })
      return
    }
    setHookDeploying(true)
    try {
      try { localStorage.setItem('connekt_vercel_deploy_hook_url', url) } catch (_) {}
      const r = await fetch(url, { method: 'POST' })
      if (!r.ok) {
        const text = await r.text().catch(() => '')
        throw new Error(text || 'Falha ao disparar hook')
      }
      toast({ title: 'Publicação iniciada', description: 'Deploy Hook disparado.' })
    } catch (e) {
      toast({ title: 'Erro', description: e?.message || 'Erro ao disparar hook', variant: 'destructive' })
    } finally {
      setHookDeploying(false)
    }
  }

  return (
    <>
      <Helmet>
        <title>Connekt - Publicar na Vercel</title>
      </Helmet>
      <div className="min-h-screen bg-[#F5F6FA]">
        <div className="border-b border-[#E3E4E5] bg-white">
          <div className="max-w-[980px] mx-auto px-6 py-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="w-10 h-10 rounded-[12px] border border-[#E3E4E5] bg-white flex items-center justify-center hover:bg-[#F8FAFC]"
                onClick={() => navigateTo('/admin')}
              >
                <ArrowLeft className="w-5 h-5 text-[#1E1B39]" />
              </button>
              <div>
                <div className="text-[14px] font-semibold text-[#1E1B39]">Publicar na Vercel</div>
                <div className="text-[12px] text-[#737780]">Dispara um redeploy em produção</div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-[980px] mx-auto px-6 py-7 space-y-4">
          <div className="rounded-[12px] border border-[#E3E4E5] bg-white p-5">
            {status.loading ? (
              <div className="text-[13px] text-[#737780] flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Carregando status...
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-[12px] border border-[#E3E4E5] bg-[#F8FAFC] p-4">
                  <div className="text-[12px] font-semibold text-[#1E1B39]">Token configurado</div>
                  <div className="mt-2 flex items-center gap-2 text-[13px]">
                    {status.hasToken ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                        <span className="text-[#166534] font-semibold">Sim</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-[#DC2626]" />
                        <span className="text-[#991B1B] font-semibold">Não</span>
                      </>
                    )}
                  </div>
                  {!status.hasToken ? (
                    <div className="mt-3 text-[12px] text-[#737780] leading-[18px]">
                      Configure a env var <span className="font-mono">CONNEKT_VERCEL_TOKEN</span> no projeto da Vercel (Production).
                    </div>
                  ) : null}
                </div>

                <div className="rounded-[12px] border border-[#E3E4E5] bg-[#F8FAFC] p-4">
                  <div className="text-[12px] font-semibold text-[#1E1B39]">Projeto</div>
                  <div className="mt-2 text-[12px] text-[#737780]">
                    <div className="truncate">Project ID: <span className="font-mono text-[#1E1B39]">{status.projectId || '-'}</span></div>
                    <div className="truncate">Team ID: <span className="font-mono text-[#1E1B39]">{status.teamId || '-'}</span></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-[12px] border border-[#E3E4E5] bg-white p-5">
            <div className="text-[13px] font-semibold text-[#1E1B39]">Como configurar</div>
            <div className="mt-2 text-[12px] text-[#737780] leading-[18px]">
              Opção 1 (recomendado): Vercel → Project Settings → Environment Variables → Add:
              <div className="mt-2 font-mono text-[12px] text-[#1E1B39]">
                CONNEKT_VERCEL_TOKEN=&lt;seu token&gt;
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                disabled={!status.hasToken || deploying}
                className="h-9 px-3 rounded-[10px] bg-[#0047BB] text-white text-[12px] font-semibold hover:bg-[#003da0] disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={runDeploy}
              >
                {deploying ? <Loader2 className="w-4 h-4 inline-block mr-2 animate-spin" /> : <Play className="w-4 h-4 inline-block mr-2" />}
                Publicar agora
              </button>
              {lastUrl ? (
                <>
                  <button
                    type="button"
                    className="h-9 px-3 rounded-[10px] border border-[#E3E4E5] bg-white text-[12px] font-semibold text-[#1E1B39] hover:bg-[#F8FAFC]"
                    onClick={async () => {
                      try { await navigator.clipboard.writeText(lastUrl) } catch (_) {}
                      toast({ title: 'Copiado', description: 'Link copiado.' })
                    }}
                  >
                    <Copy className="w-4 h-4 inline-block mr-2" />
                    Copiar link
                  </button>
                  <button
                    type="button"
                    className="h-9 px-3 rounded-[10px] border border-[#E3E4E5] bg-white text-[12px] font-semibold text-[#1E1B39] hover:bg-[#F8FAFC]"
                    onClick={() => window.open(lastUrl, '_blank', 'noopener,noreferrer')}
                  >
                    <ExternalLink className="w-4 h-4 inline-block mr-2" />
                    Abrir
                  </button>
                </>
              ) : null}
            </div>
          </div>

          <div className="rounded-[12px] border border-[#E3E4E5] bg-white p-5">
            <div className="text-[13px] font-semibold text-[#1E1B39]">Opção 2: Deploy Hook (colar a URL)</div>
            <div className="mt-2 text-[12px] text-[#737780] leading-[18px]">
              Vercel → Project Settings → Git → Deploy Hooks → Create Hook (Production). Cole a URL abaixo.
            </div>
            <div className="mt-3">
              <input
                value={deployHookUrl}
                onChange={(e) => setDeployHookUrl(e.target.value)}
                placeholder="https://api.vercel.com/v1/integrations/deploy/..."
                className="w-full h-[40px] rounded-[10px] border border-[#E3E4E5] px-3 text-[13px] outline-none focus:border-[#0047BB]"
              />
            </div>
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                disabled={hookDeploying || !String(deployHookUrl || '').trim()}
                className="h-9 px-3 rounded-[10px] bg-[#0047BB] text-white text-[12px] font-semibold hover:bg-[#003da0] disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={runDeployHook}
              >
                {hookDeploying ? <Loader2 className="w-4 h-4 inline-block mr-2 animate-spin" /> : <Play className="w-4 h-4 inline-block mr-2" />}
                Disparar hook
              </button>
              <button
                type="button"
                disabled={!String(deployHookUrl || '').trim()}
                className="h-9 px-3 rounded-[10px] border border-[#E3E4E5] bg-white text-[12px] font-semibold text-[#1E1B39] hover:bg-[#F8FAFC] disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={async () => {
                  try { await navigator.clipboard.writeText(String(deployHookUrl || '').trim()) } catch (_) {}
                  toast({ title: 'Copiado', description: 'URL copiada.' })
                }}
              >
                <Copy className="w-4 h-4 inline-block mr-2" />
                Copiar URL
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
