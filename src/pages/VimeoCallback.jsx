import React, { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/SupabaseAuthContext'
import { useToast } from '@/hooks/use-toast'
import { canConnectVideoProvider, getConnectedVideoProvidersCount, resolvePlanKey } from '@/services/planEntitlements'

export default function VimeoCallback() {
  const { session, user } = useAuth()
  const { toast } = useToast()
  const [status, setStatus] = useState('Processando conexão com Vimeo...')

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      const state = params.get('state')
      const expectedState = localStorage.getItem('vimeo_oauth_state')
      const redirectUri = localStorage.getItem('vimeo_redirect_uri') || import.meta.env.VITE_VIMEO_REDIRECT_URI || `${window.location.origin}/vimeo/callback`
      const nextPath = localStorage.getItem('vimeo_post_connect_next') || '/produtos/novo#aulas'

      if (!code || !state || !expectedState || state !== expectedState) {
        setStatus('Estado inválido ou código ausente.')
        toast({ title: 'Conexão falhou', description: 'Estado inválido ou código ausente.' })
        setTimeout(() => { window.location.href = nextPath }, 1200)
        return
      }

      try {
        if (!session?.access_token) {
          setStatus('Sessão expirada. Faça login novamente.')
          toast({ title: 'Faça login', description: 'Sessão expirada. Faça login.' })
          window.location.href = '/login?next=' + encodeURIComponent(nextPath)
          return
        }

        if (user?.id) {
          const current = await getConnectedVideoProvidersCount(user.id)
          const allow = canConnectVideoProvider({
            planKey: resolvePlanKey(),
            alreadyConnectedCount: current.count,
            isAlreadyConnected: !!current.providers?.vimeo,
          })
          if (!allow.ok) {
            setStatus('Limite de integrações do seu plano atingido.')
            toast({ title: 'Limite do plano', description: 'Seu plano não permite adicionar mais integrações de player de vídeo.' })
            setTimeout(() => { window.location.href = nextPath }, 1200)
            return
          }
        }

        const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vimeo-auth`
        const res = await fetch(fnUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ code, redirect_uri: redirectUri }),
        })

        if (!res.ok) {
          const err = await res.text()
          setStatus('Falha ao concluir a conexão com Vimeo.')
          toast({ title: 'Conexão Vimeo', description: 'Falha ao concluir a conexão.' })
          console.error(err)
        } else {
          localStorage.setItem('connectedProvider.vimeo', 'true')
          localStorage.removeItem('vimeo_oauth_state')
          localStorage.removeItem('vimeo_post_connect_next')
          setStatus('Conectado ao Vimeo com sucesso!')
          toast({ title: 'Vimeo conectado', description: 'Integração concluída com sucesso.' })
        }
      } catch (e) {
        console.error(e)
        setStatus('Erro inesperado ao conectar com Vimeo.')
        toast({ title: 'Conexão Vimeo', description: 'Erro inesperado.' })
      } finally {
        setTimeout(() => { window.location.href = nextPath }, 1000)
      }
    }

    run()
  }, [session, toast])

  return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="rounded-lg border border-gray-200 p-6 text-sm text-gray-700">
        {status}
      </div>
    </div>
  )
}
