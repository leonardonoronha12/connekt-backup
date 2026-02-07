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
  window.addEventListener('error', (e) => {
    const msg = e?.message || 'Erro inesperado'
    const file = e?.filename ? ` (${e.filename}:${e.lineno || 0}:${e.colno || 0})` : ''
    const stack = e?.error?.stack || ''
    renderFatal(String(msg) + String(file), String(stack || ''))
  })
  window.addEventListener('unhandledrejection', (e) => {
    const r = e?.reason
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
    const msg = r?.message || r?.error_description || String(r || 'Promise rejeitada')
    const stack = r?.stack || ''
    renderFatal(String(msg), String(stack))
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
