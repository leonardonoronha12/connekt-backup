import { useEffect, useState } from 'react'
import { getActiveProducerUserId, PRODUCER_SCOPE_EVENT } from '@/services/producerScope'

export function useActiveProducerUserId() {
  const [value, setValue] = useState(() => {
    try { return getActiveProducerUserId() } catch (_) { return '' }
  })

  useEffect(() => {
    const refresh = () => {
      try { setValue(getActiveProducerUserId()) } catch (_) { setValue('') }
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

