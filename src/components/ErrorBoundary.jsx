import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, message: '', stack: '', componentStack: '' }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    try {
      const msg = error && typeof error === 'object' && 'message' in error ? String(error.message || '') : String(error || '')
      const stack = error && typeof error === 'object' && 'stack' in error ? String(error.stack || '') : ''
      const componentStack = info && typeof info === 'object' && 'componentStack' in info ? String(info.componentStack || '') : ''
      this.setState({ message: msg, stack, componentStack })
      try { console.error('[ErrorBoundary]', error) } catch (_) {}
      try { window.__CONNEKT_LAST_ERROR__ = { message: msg, stack, componentStack } } catch (_) {}
    } catch (_) {}
  }

  render() {
    if (!this.state.hasError) return this.props.children
    const fallback = this.props.fallback
    if (fallback) return fallback
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#f8fafc', color: '#111827', fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif' }}>
        <div style={{ width: '100%', maxWidth: 520, background: '#ffffff', border: '1px solid #E3E4E5', borderRadius: 16, padding: 20, textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Ocorreu um erro</div>
          <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.4 }}>Recarregue a página (Ctrl+F5). Se persistir, tente sair e entrar novamente.</div>
          {this.state.message ? (
            <div style={{ marginTop: 10, fontSize: 12, color: '#111827', lineHeight: 1.4, wordBreak: 'break-word' }}>
              {this.state.message}
            </div>
          ) : null}
          {this.state.stack ? (
            <pre style={{ marginTop: 10, padding: 10, borderRadius: 10, border: '1px solid #E3E4E5', background: '#F8FAFC', fontSize: 11, color: '#111827', textAlign: 'left', overflow: 'auto', maxHeight: 180, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {this.state.stack}
            </pre>
          ) : null}
          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              style={{ height: 36, padding: '0 14px', borderRadius: 10, border: '1px solid #E3E4E5', background: '#ffffff', cursor: 'pointer', fontSize: 13 }}
              onClick={() => window.location.reload()}
            >
              Recarregar
            </button>
            <button
              type="button"
              style={{ height: 36, padding: '0 14px', borderRadius: 10, border: '1px solid #0047BB', background: '#0047BB', color: '#ffffff', cursor: 'pointer', fontSize: 13 }}
              onClick={() => { try { window.location.href = '/login' } catch (_) { window.location.reload() } }}
            >
              Ir para login
            </button>
          </div>
        </div>
      </div>
    )
  }
}
