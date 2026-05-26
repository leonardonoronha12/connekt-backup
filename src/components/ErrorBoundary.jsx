import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch() {}

  render() {
    if (!this.state.hasError) return this.props.children
    const fallback = this.props.fallback
    if (fallback) return fallback
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#f8fafc', color: '#111827', fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif' }}>
        <div style={{ width: '100%', maxWidth: 520, background: '#ffffff', border: '1px solid #E3E4E5', borderRadius: 16, padding: 20, textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Ocorreu um erro</div>
          <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.4 }}>Recarregue a página (Ctrl+F5). Se persistir, tente sair e entrar novamente.</div>
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

