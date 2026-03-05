import { useEffect, useState } from 'react'
import { getActiveProducerUserId, PRODUCER_SCOPE_EVENT, setActiveProducerUserId } from '@/services/producerScope'

function readProducerUidFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search || '')
    return String(
      params.get('producer_uid') ||
        params.get('producerUserId') ||
        params.get('producer_uid'.toUpperCase()) ||
        '',
    ).trim()
  } catch (_) {
    return ''
  }
}

function readLegacyProducerUid() {
  try {
    return String(sessionStorage.getItem('connekt_producer_uid') || localStorage.getItem('connekt_producer_uid') || '').trim()
  } catch (_) {
    return ''
  }
}

export function useActiveProducerUserId() {
  const [value, setValue] = useState(() => {
    try {
      const fromUrl = readProducerUidFromUrl()
      if (fromUrl) return fromUrl
    } catch (_) {}
    try {
      const stored = getActiveProducerUserId()
      if (stored) return stored
    } catch (_) {}
    return readLegacyProducerUid() || ''
  })

  useEffect(() => {
    const safeSetScope = (next) => {
      const v = String(next || '').trim()
      if (!v) return
      try {
        const current = getActiveProducerUserId()
        if (String(current || '').trim() === v) return
      } catch (_) {}
      try { setActiveProducerUserId(v) } catch (_) {}
    }

    const refresh = () => {
      const fromUrl = readProducerUidFromUrl()
      if (fromUrl) {
        try { sessionStorage.setItem('connekt_producer_uid', fromUrl) } catch (_) { try { localStorage.setItem('connekt_producer_uid', fromUrl) } catch (_) {} }
        try { localStorage.setItem('connekt_producer_uid', fromUrl) } catch (_) {}
        safeSetScope(fromUrl)
        setValue(fromUrl)
        return
      }
      try {
        const stored = getActiveProducerUserId()
        if (stored) {
          setValue(stored)
          return
        }
      } catch (_) {}
      const legacy = readLegacyProducerUid()
      if (legacy) {
        safeSetScope(legacy)
        setValue(legacy)
        return
      }
      setValue('')
    }
    refresh()
    window.addEventListener(PRODUCER_SCOPE_EVENT, refresh)
    window.addEventListener('popstate', refresh)
    return () => {
      window.removeEventListener(PRODUCER_SCOPE_EVENT, refresh)
      window.removeEventListener('popstate', refresh)
    }
  }, [])

  return value
}
