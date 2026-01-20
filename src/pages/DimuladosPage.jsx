import React, { useEffect } from 'react'

export default function DimuladosPage() {
  useEffect(() => {
    window.history.replaceState({}, '', '/cursos')
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, [])

  return null
}

