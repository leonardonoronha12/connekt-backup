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
  root.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#f8fafc;color:#111827;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif">
      <div style="width:100%;max-width:560px;background:#ffffff;border:1px solid #E3E4E5;border-radius:16px;padding:20px">
        <div style="font-weight:800;font-size:16px;margin-bottom:8px">Connekt</div>
        <div style="font-weight:700;font-size:14px;margin-bottom:6px">Não foi possível carregar a página</div>
        <div style="font-size:12px;color:#6B7280;line-height:1.5;margin-bottom:12px">${safeMessage}</div>
        ${safeDetail ? `<pre style="white-space:pre-wrap;word-break:break-word;background:#F9FAFB;border:1px solid #E3E4E5;border-radius:12px;padding:12px;font-size:12px;color:#111827;margin:0">${safeDetail}</pre>` : ''}
        <div style="margin-top:14px;font-size:12px;color:#6B7280">Tente recarregar (Ctrl+F5). Se persistir, limpe o cache do site e tente novamente.</div>
      </div>
    </div>
  `
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
