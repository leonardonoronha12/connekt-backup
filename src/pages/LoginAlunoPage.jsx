import React, { useEffect } from 'react'
import StudentLoginForm from '@/components/StudentLoginForm'

export default function LoginAlunoPage() {
  useEffect(() => {
    try {
      const host = String(window.location.hostname || '').toLowerCase()
      const path = String(window.location.pathname || '')
      if (host !== 'app.connektco.com') return
      if (path !== '/login-aluno') return
      const root = document.documentElement
      root.style.setProperty('--brand-primary', '#0047BB')
      root.style.setProperty('--brand-primary-hover', '#003399')
      root.style.setProperty('--brand-sidebar-from', 'rgb(15, 6, 39)')
      root.style.setProperty('--brand-sidebar-to', 'rgb(0, 0, 104)')
    } catch (_) {}
  }, [])
  return <StudentLoginForm variant="normal" />
}
