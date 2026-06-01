import React, { useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { ArrowLeft, Loader2, Play } from 'lucide-react'
import { useAuth } from '@/contexts/SupabaseAuthContext'
import { toast } from '@/hooks/use-toast.ts'

function navigateTo(path) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export default function PlatformAdminAnalyticsPage() {
  const { session } = useAuth()
  const authHeaders = useMemo(() => {
    const t = String(session?.access_token || '')
    return t ? { Authorization: `Bearer ${t}` } : {}
  }, [session?.access_token])

  const [ga, setGa] = useState(() => {
    try { return String(localStorage.getItem('connekt_ga_measurement_id') || '') } catch (_) { return '' }
  })
  const [pixel, setPixel] = useState(() => {
    try { return String(localStorage.getItem('connekt_meta_pixel_id') || '') } catch (_) { return '' }
  })
  const [saving, setSaving] = useState(false)
  const [deploying, setDeploying] = useState(false)

  const saveOnly = async () => {
    const gaMeasurementId = String(ga || '').trim()
    const metaPixelId = String(pixel || '').trim()
    const vars = []
    if (gaMeasurementId) vars.push({ key: 'VITE_GA_MEASUREMENT_ID', value: gaMeasurementId, type: 'plain' })
    if (metaPixelId) vars.push({ key: 'VITE_META_PIXEL_ID', value: metaPixelId, type: 'plain' })
    if (!vars.length) {
      toast({ title: 'Nada para salvar', description: 'Informe pelo menos um ID.', variant: 'destructive' })
      return false
    }
    if (!authHeaders.Authorization) {
      toast({ title: 'Faça login', description: 'Entre na conta admin para salvar.', variant: 'destructive' })
      return false
    }
    setSaving(true)
    try {
      try { localStorage.setItem('connekt_ga_measurement_id', gaMeasurementId) } catch (_) {}
      try { localStorage.setItem('connekt_meta_pixel_id', metaPixelId) } catch (_) {}
      const r = await fetch('/api/admin/vercel/env-upsert', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ vars }),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body?.error || body?.message || 'Falha ao salvar env vars')
      toast({ title: 'Salvo na Vercel', description: 'Env vars atualizadas.', duration: 3500 })
      return true
    } catch (e) {
      toast({ title: 'Erro', description: e?.message || 'Erro ao salvar', variant: 'destructive' })
      return false
    } finally {
      setSaving(false)
    }
  }

  const saveAndDeploy = async () => {
    const ok = await saveOnly()
    if (!ok) return
    setDeploying(true)
    try {
      const r = await fetch('/api/admin/vercel/deploy', { method: 'POST', headers: { ...authHeaders } })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body?.error || body?.message || 'Falha ao publicar')
      toast({ title: 'Deploy disparado', description: 'Aguarde a Vercel finalizar.', duration: 4500 })
    } catch (e) {
      toast({ title: 'Erro', description: e?.message || 'Erro ao publicar', variant: 'destructive' })
    } finally {
      setDeploying(false)
    }
  }

  const disableAll = async () => {
    setGa('')
    setPixel('')
    setSaving(true)
    try {
      const vars = [
        { key: 'VITE_GA_MEASUREMENT_ID', value: '', type: 'plain' },
        { key: 'VITE_META_PIXEL_ID', value: '', type: 'plain' },
      ]
      const r = await fetch('/api/admin/vercel/env-upsert', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ vars }),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body?.error || body?.message || 'Falha ao limpar env vars')
      toast({ title: 'Removido', description: 'IDs removidos da Vercel.', duration: 3500 })
    } catch (e) {
      toast({ title: 'Erro', description: e?.message || 'Erro ao remover', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const busy = saving || deploying

  return (
    <>
      <Helmet>
        <title>Connekt - Analytics</title>
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
                <div className="text-[14px] font-semibold text-[#1E1B39]">Google Analytics e Pixel</div>
                <div className="text-[12px] text-[#737780]">Salva env vars na Vercel e dispara redeploy</div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-[980px] mx-auto px-6 py-7 space-y-4">
          <div className="rounded-[12px] border border-[#E3E4E5] bg-white p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-[12px] font-medium text-[#1E1B39]">GA4 Measurement ID</div>
                <input
                  value={ga}
                  onChange={(e) => setGa(e.target.value)}
                  placeholder="G-XXXXXXXXXX"
                  className="mt-1 w-full rounded-[10px] border border-[#E3E4E5] px-3 py-2 text-[13px] outline-none focus:border-[#0047BB]"
                />
                <div className="mt-1 text-[11px] text-[#737780]">Env: VITE_GA_MEASUREMENT_ID</div>
              </div>
              <div>
                <div className="text-[12px] font-medium text-[#1E1B39]">Meta Pixel ID</div>
                <input
                  value={pixel}
                  onChange={(e) => setPixel(e.target.value)}
                  placeholder="123456789012345"
                  className="mt-1 w-full rounded-[10px] border border-[#E3E4E5] px-3 py-2 text-[13px] outline-none focus:border-[#0047BB]"
                />
                <div className="mt-1 text-[11px] text-[#737780]">Env: VITE_META_PIXEL_ID</div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                className="h-10 px-4 rounded-[10px] bg-[#0047BB] text-white text-[13px] font-semibold hover:bg-[#003a99] disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                onClick={saveAndDeploy}
                disabled={busy}
              >
                {deploying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Salvar e publicar
              </button>
              <button
                type="button"
                className="h-10 px-4 rounded-[10px] border border-[#E3E4E5] bg-white text-[13px] font-semibold text-[#1E1B39] hover:bg-[#F8FAFC] disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={saveOnly}
                disabled={busy}
              >
                Salvar na Vercel
              </button>
              <button
                type="button"
                className="h-10 px-4 rounded-[10px] border border-[#E3E4E5] bg-white text-[13px] font-semibold text-[#b91c1c] hover:bg-[#FEF2F2] disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={disableAll}
                disabled={busy}
              >
                Remover IDs
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

