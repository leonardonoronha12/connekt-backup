import React, { useState, useEffect } from "react"
import { ToastAction } from "@/components/ui/toast"

const TOAST_LIMIT = 1

let count = 0
function generateId() {
  count = (count + 1) % Number.MAX_VALUE
  return count.toString()
}

let lastPlanExpiredEventAt = 0

const toastStore = {
  state: {
    toasts: [],
  },
  listeners: [],
  
  getState: () => toastStore.state,
  
  setState: (nextState) => {
    if (typeof nextState === 'function') {
      toastStore.state = nextState(toastStore.state)
    } else {
      toastStore.state = { ...toastStore.state, ...nextState }
    }
    
    toastStore.listeners.forEach(listener => listener(toastStore.state))
  },
  
  subscribe: (listener) => {
    toastStore.listeners.push(listener)
    return () => {
      toastStore.listeners = toastStore.listeners.filter(l => l !== listener)
    }
  }
}

export const toast = ({ ...props }) => {
  const normalized = (() => {
    const t = props && typeof props === 'object' ? { ...props } : {}
    const titleRaw = String(t.title || '').trim()
    const descRaw = t.description == null ? '' : String(t.description)
    const text = `${titleRaw} ${descRaw}`.trim().toLowerCase()
    const isPlanExpired = text === 'plan_expired' || text.includes('plan_expired')
    if (!isPlanExpired) return t

    const now = Date.now()
    if (typeof window !== 'undefined' && (now - lastPlanExpiredEventAt) > 1200) {
      lastPlanExpiredEventAt = now
      try {
        window.dispatchEvent(new CustomEvent('connekt:plan-expired', { detail: { source: 'toast', ts: now } }))
      } catch (_) {}
    }

    return {
      ...t,
      title: 'Plano expirado',
      description: 'Seu plano expirou. Faça o upgrade para continuar usando as ferramentas do produtor.',
      variant: 'destructive',
      duration: Number.isFinite(Number(t.duration)) ? t.duration : 8000,
      action: t.action || React.createElement(
        ToastAction,
        {
          altText: 'Ver planos',
          onClick: () => {
            try {
              window.history.pushState({}, '', '/configuracoes?tab=plano')
              window.dispatchEvent(new PopStateEvent('popstate'))
            } catch (_) {
              try { window.location.assign('/configuracoes?tab=plano') } catch (_) {}
            }
          },
        },
        'Ver planos',
      ),
    }
  })()

  const id = generateId()

  const update = (props) =>
    toastStore.setState((state) => ({
      ...state,
      toasts: state.toasts.map((t) =>
        t.id === id ? { ...t, ...props } : t
      ),
    }))

  const dismiss = () => toastStore.setState((state) => ({
    ...state,
    toasts: state.toasts.filter((t) => t.id !== id),
  }))

  toastStore.setState((state) => ({
    ...state,
    toasts: [
      { ...normalized, id, dismiss },
      ...state.toasts,
    ].slice(0, TOAST_LIMIT),
  }))

  return {
    id,
    dismiss,
    update,
  }
}

export function useToast() {
  const [state, setState] = useState(toastStore.getState())
  
  useEffect(() => {
    const unsubscribe = toastStore.subscribe((state) => {
      setState(state)
    })
    
    return unsubscribe
  }, [])
  
  useEffect(() => {
    const timeouts = []

    state.toasts.forEach((toast) => {
      if (toast.duration === Infinity) {
        return
      }

      const timeout = setTimeout(() => {
        toast.dismiss()
      }, toast.duration || 5000)

      timeouts.push(timeout)
    })

    return () => {
      timeouts.forEach((timeout) => clearTimeout(timeout))
    }
  }, [state.toasts])

  return {
    toast,
    toasts: state.toasts,
  }
}
