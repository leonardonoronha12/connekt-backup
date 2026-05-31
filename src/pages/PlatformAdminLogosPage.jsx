import React, { useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { ArrowLeft, Copy, ExternalLink, RefreshCcw, UploadCloud } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/SupabaseAuthContext'
import { toast } from '@/hooks/use-toast.ts'
import { getStaticLogoObjectPath, getStaticLogoPublicUrl } from '@/services/logoAssets'

function navigateTo(path) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

const LOGO_SLOTS = [
  { id: 'providers/vdocipher', title: 'VdoCipher', hint: 'Card de integrações' },
  { id: 'providers/vimeo', title: 'Vimeo', hint: 'Card de integrações' },
  { id: 'brand/connekt', title: 'Connekt', hint: 'Uso geral' },
]

export default function PlatformAdminLogosPage() {
  const { session } = useAuth()
  const [busyId, setBusyId] = useState('')
  const [refreshNonce, setRefreshNonce] = useState(() => Date.now())

  const token = String(session?.access_token || '')
  const hasSession = Boolean(token)

  const rows = useMemo(() => {
    return LOGO_SLOTS.map((slot) => {
      const publicUrl = getStaticLogoPublicUrl(slot.id)
      const previewUrl = publicUrl ? `${publicUrl}?v=${encodeURIComponent(String(refreshNonce))}` : ''
      return { ...slot, publicUrl, previewUrl, objectPath: getStaticLogoObjectPath(slot.id) }
    })
  }, [refreshNonce])

  const uploadLogo = async (slotId, file) => {
    if (!file) return
    if (!hasSession) {
      toast({ title: 'Sessão inválida', description: 'Faça login novamente.', duration: 5000, variant: 'destructive' })
      return
    }
    if (!String(file?.type || '').startsWith('image/')) {
      toast({ title: 'Arquivo inválido', description: 'Selecione uma imagem (JPG/PNG/WebP/SVG).', duration: 5000, variant: 'destructive' })
      return
    }
    if (Number(file?.size || 0) > 2 * 1024 * 1024) {
      toast({ title: 'Arquivo muito grande', description: 'Tamanho máximo: 2MB.', duration: 5000, variant: 'destructive' })
      return
    }

    const objectPath = getStaticLogoObjectPath(slotId)
    if (!objectPath) {
      toast({ title: 'Erro', description: 'Slot inválido.', duration: 5000, variant: 'destructive' })
      return
    }

    setBusyId(slotId)
    try {
      const { error } = await supabase.storage
        .from('images')
        .upload(objectPath, file, { upsert: true, contentType: String(file.type || 'application/octet-stream') })
      if (error) throw error
      setRefreshNonce(Date.now())
      toast({ title: 'Logo enviada', description: 'Upload concluído.', duration: 4000 })
    } catch (e) {
      toast({ title: 'Erro no upload', description: e?.message || 'Falha ao enviar logo.', duration: 6000, variant: 'destructive' })
    } finally {
      setBusyId('')
    }
  }

  return (
    <>
      <Helmet>
        <title>Connekt - Admin - Logos</title>
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
                <div className="text-[14px] font-semibold text-[#1E1B39]">Logos (upload)</div>
                <div className="text-[12px] text-[#737780]">Envia imagens para o bucket público images/logos</div>
              </div>
            </div>
            <button
              type="button"
              className="h-9 px-3 rounded-[10px] border border-[#E3E4E5] bg-white text-[12px] font-semibold text-[#1E1B39] hover:bg-[#F8FAFC] flex items-center gap-2"
              onClick={() => setRefreshNonce(Date.now())}
            >
              <RefreshCcw className="w-4 h-4" /> Atualizar
            </button>
          </div>
        </div>

        <div className="max-w-[980px] mx-auto px-6 py-7 space-y-4">
          <div className="rounded-[12px] border border-[#E3E4E5] bg-white p-5">
            <div className="text-[13px] text-[#1E1B39] font-semibold">Como usar</div>
            <div className="mt-1 text-[12px] text-[#737780]">
              Depois de enviar, copie a URL pública e use no app. A URL é estável (mesmo caminho), o cache é controlado pelo navegador.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rows.map((row) => {
              const disabled = busyId === row.id
              return (
                <div key={row.id} className="rounded-[12px] border border-[#E3E4E5] bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[14px] font-semibold text-[#1E1B39]">{row.title}</div>
                      <div className="text-[12px] text-[#737780]">{row.hint}</div>
                      <div className="mt-2 text-[11px] text-[#9291A5] break-all">{row.objectPath ? `images/${row.objectPath}` : ''}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="h-9 px-3 rounded-[10px] border border-[#E3E4E5] bg-white text-[12px] font-semibold text-[#1E1B39] hover:bg-[#F8FAFC] flex items-center gap-2"
                        disabled={!row.publicUrl}
                        onClick={async () => {
                          if (!row.publicUrl) return
                          try { await navigator.clipboard.writeText(row.publicUrl) } catch (_) {}
                          toast({ title: 'Copiado', description: 'URL copiada.', duration: 2000 })
                        }}
                      >
                        <Copy className="w-4 h-4" /> Copiar URL
                      </button>
                      <a
                        className="h-9 px-3 rounded-[10px] border border-[#E3E4E5] bg-white text-[12px] font-semibold text-[#1E1B39] hover:bg-[#F8FAFC] flex items-center gap-2"
                        href={row.publicUrl || '#'}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => { if (!row.publicUrl) e.preventDefault() }}
                      >
                        <ExternalLink className="w-4 h-4" /> Abrir
                      </a>
                    </div>
                  </div>

                  <div className="mt-4 h-[110px] rounded-[10px] border border-[#E3E4E5] bg-[#F8FAFC] flex items-center justify-center overflow-hidden">
                    {row.previewUrl ? (
                      <img
                        src={row.previewUrl}
                        alt={row.title}
                        className="max-h-[92px] max-w-[92%] object-contain"
                        onError={(e) => { try { e.currentTarget.style.display = 'none' } catch (_) {} }}
                      />
                    ) : null}
                  </div>

                  <div className="mt-4">
                    <label className="w-full border-2 border-dashed border-[#0047BB] rounded-[10px] bg-[#F8FAFC] h-[90px] flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={disabled}
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (f) uploadLogo(row.id, f)
                          try { e.target.value = '' } catch (_) {}
                        }}
                      />
                      <UploadCloud className="text-[#0047BB] mb-2" size={22} />
                      <div className="text-[12px] font-semibold text-[#1E1B39]">{disabled ? 'Enviando...' : 'Clique para enviar'}</div>
                      <div className="text-[11px] text-[#737780]">JPG/PNG/WebP/SVG até 2MB</div>
                    </label>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}

