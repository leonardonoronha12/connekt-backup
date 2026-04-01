import React from 'react';
import ReactDOM from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import App from '@/App';
import { BrandingProvider } from '@/contexts/BrandingContext'
import '@/index.css';

// Logs de diagnóstico removidos após validação de ambiente

function renderFatal(message, detail) {
  const root = document.getElementById('root')
  if (!root) return
  const safeMessage = String(message || 'Erro ao carregar').slice(0, 5000)
  const safeDetail = String(detail || '').slice(0, 12000)

  while (root.firstChild) root.removeChild(root.firstChild)

  const outer = document.createElement('div')
  outer.style.minHeight = '100vh'
  outer.style.display = 'flex'
  outer.style.alignItems = 'center'
  outer.style.justifyContent = 'center'
  outer.style.padding = '24px'
  outer.style.background = '#f8fafc'
  outer.style.color = '#111827'
  outer.style.fontFamily = 'Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif'

  const card = document.createElement('div')
  card.style.width = '100%'
  card.style.maxWidth = '560px'
  card.style.background = '#ffffff'
  card.style.border = '1px solid #E3E4E5'
  card.style.borderRadius = '16px'
  card.style.padding = '20px'

  const title = document.createElement('div')
  title.style.fontWeight = '800'
  title.style.fontSize = '16px'
  title.style.marginBottom = '8px'
  title.textContent = 'Connekt'

  const subtitle = document.createElement('div')
  subtitle.style.fontWeight = '700'
  subtitle.style.fontSize = '14px'
  subtitle.style.marginBottom = '6px'
  subtitle.textContent = 'Não foi possível carregar a página'

  const messageEl = document.createElement('div')
  messageEl.style.fontSize = '12px'
  messageEl.style.color = '#6B7280'
  messageEl.style.lineHeight = '1.5'
  messageEl.style.marginBottom = '12px'
  messageEl.textContent = safeMessage

  card.appendChild(title)
  card.appendChild(subtitle)
  card.appendChild(messageEl)

  if (safeDetail) {
    const pre = document.createElement('pre')
    pre.style.whiteSpace = 'pre-wrap'
    pre.style.wordBreak = 'break-word'
    pre.style.background = '#F9FAFB'
    pre.style.border = '1px solid #E3E4E5'
    pre.style.borderRadius = '12px'
    pre.style.padding = '12px'
    pre.style.fontSize = '12px'
    pre.style.color = '#111827'
    pre.style.margin = '0'
    pre.textContent = safeDetail
    card.appendChild(pre)
  }

  const hint = document.createElement('div')
  hint.style.marginTop = '14px'
  hint.style.fontSize = '12px'
  hint.style.color = '#6B7280'
  hint.textContent = 'Tente recarregar (Ctrl+F5). Se persistir, limpe o cache do site e tente novamente.'
  card.appendChild(hint)

  outer.appendChild(card)
  root.appendChild(outer)
}

try {
  const shouldReloadForChunkError = (err) => {
    const name = String(err?.name || '').toLowerCase()
    const msg = String(err?.message || err?.error_description || err || '').toLowerCase()
    return (
      name.includes('chunkloaderror') ||
      msg.includes('chunkloaderror') ||
      msg.includes('failed to fetch dynamically imported module') ||
      msg.includes('importing a module script failed') ||
      msg.includes('dynamically imported module') ||
      msg.includes('load failed') ||
      msg.includes('net::err_failed') ||
      msg.includes('net::err') ||
      msg.includes('unexpected token') && msg.includes('html') ||
      msg.includes('mime type') && msg.includes('text/html')
    )
  }
  const tryReloadOnce = () => {
    try {
      const key = 'connekt_chunk_reload_ts'
      const last = Number(sessionStorage.getItem(key) || 0)
      const now = Date.now()
      if (Number.isFinite(last) && last > 0 && (now - last) < 20_000) return false
      sessionStorage.setItem(key, String(now))
      const url = new URL(window.location.href)
      url.searchParams.set('__reload', String(now))
      window.location.replace(url.toString())
      return true
    } catch (_) {
      try {
        window.location.reload()
        return true
      } catch (_) {}
      return false
    }
  }
  window.addEventListener('error', (e) => {
    const err = e?.error || e
    if (shouldReloadForChunkError(err)) {
      const did = tryReloadOnce()
      if (did) return
    }
    try {
      const msg = e?.message || 'Erro inesperado'
      const file = e?.filename ? ` (${e.filename}:${e.lineno || 0}:${e.colno || 0})` : ''
      console.error(String(msg) + String(file), e?.error || e)
    } catch (_) {}
  })
  window.addEventListener('unhandledrejection', (e) => {
    const r = e?.reason
    if (shouldReloadForChunkError(r)) {
      const did = tryReloadOnce()
      if (did) {
        try { e.preventDefault() } catch (_) {}
        return
      }
    }
    const name = String(r?.name || '').toLowerCase()
    const msgLower = String(r?.message || r?.error_description || r || '').toLowerCase()
    const isAbort =
      name.includes('abort') ||
      msgLower.includes('abort') ||
      msgLower.includes('err_aborted') ||
      msgLower.includes('err_abort') ||
      msgLower.includes('canceled') ||
      msgLower.includes('cancelled')
    if (isAbort) {
      try { e.preventDefault() } catch (_) {}
      return
    }
    try {
      const msg = r?.message || r?.error_description || String(r || 'Promise rejeitada')
      console.error(String(msg), r)
    } catch (_) {}
  })
} catch (_) {}

try {
  const el = document.getElementById('root')
  if (!el) throw new Error('root_not_found')
  ReactDOM.createRoot(el).render(
    <HelmetProvider>
      <BrandingProvider>
        <App />
      </BrandingProvider>
    </HelmetProvider>
  );
} catch (e) {
  renderFatal('Falha ao inicializar o app.', e?.message || String(e))
}
