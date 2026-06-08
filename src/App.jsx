import React, { useState, useEffect, Suspense, useMemo, useRef } from 'react';
import AnalyticsHead from '@/components/AnalyticsHead';
// import { SpeedInsights } from '@vercel/speed-insights/react';
import { AuthProvider, useAuth } from '@/contexts/SupabaseAuthContext';
import { TaxonomyProvider } from '@/contexts/TaxonomyContext';
import MainLayout from '@/components/MainLayout';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Toaster } from '@/components/ui/toaster';
import DeviceAccessRequestModal from '@/components/DeviceAccessRequestModal.jsx'
import { supabase } from '@/lib/supabaseClient'
import { toast } from '@/components/ui/use-toast';
import { isUploadInProgress, subscribeUploadGuard, getActiveUploadCount } from '@/services/uploadGuard';
import { setActiveProducerUserId } from '@/services/producerScope'
import { initAnalytics, trackPageView } from '@/services/analytics'

const InboxPage = React.lazy(() => import('@/pages/InboxPage'))
const CategoriasPage = React.lazy(() => import('@/pages/CategoriasPage'))
const QuestionBankPage = React.lazy(() => import('@/pages/QuestionBankPage'))
const CursosPage = React.lazy(() => import('@/pages/CursosPage'))
const AlunosPage = React.lazy(() => import('@/pages/AlunosPage'))
const SimuladosPage = React.lazy(() => import('@/pages/SimuladosPage'))
const DimuladosPage = React.lazy(() => import('@/pages/DimuladosPage'))
const SimuladosAproveitamentoPage = React.lazy(() => import('@/pages/SimuladosAproveitamentoPage'))
const SimuladoAcessoPage = React.lazy(() => import('@/pages/SimuladoAcessoPage.jsx'))
const SimuladosNovo = React.lazy(() => import('@/pages/SimuladosNovo'))
const ProdutosNovo = React.lazy(() => import('@/pages/ProdutosNovo.tsx'))
const CursoPreviewAlunoPage = React.lazy(() => import('@/pages/CursoPreviewAlunoPage'))
const VendasPage = React.lazy(() => import('@/pages/VendasPage'))
const DashboardPage = React.lazy(() => import('@/pages/DashboardPage'))
const LoginPage = React.lazy(() => import('@/pages/LoginPage'))
const HeroPage = React.lazy(() => import('@/pages/HeroPage'))
const EmailVerificationPage = React.lazy(() => import('@/pages/EmailVerificationPage'))
const ResetPasswordPage = React.lazy(() => import('@/pages/ResetPasswordPage.jsx'))
const TermosPrivacidadePage = React.lazy(() => import('@/pages/TermosPrivacidadePage.jsx'))
const DeviceLockPage = React.lazy(() => import('@/pages/DeviceLockPage.jsx'))
const LoginAlunoPage = React.lazy(() => import('@/pages/LoginAlunoPage.jsx'))
const LoginAlunoWhitelabelPage = React.lazy(() => import('@/pages/LoginAlunoWhitelabelPage.jsx'))
const AlunoDashboardPage = React.lazy(() => import('@/pages/AlunoDashboardPage.jsx'))
const AlunoAulaPage = React.lazy(() => import('@/pages/AlunoAulaPage.jsx'))
const AlunoSimuladoAcessoPage = React.lazy(() => import('@/pages/AlunoSimuladoAcessoPage.jsx'))
const AlunoSimuladosPage = React.lazy(() => import('@/pages/AlunoSimuladosPage.jsx'))
const AlunoConfiguracoesPage = React.lazy(() => import('@/pages/AlunoConfiguracoesPage.jsx'))
const AlunoCursoPage = React.lazy(() => import('@/pages/AlunoCursoPage.jsx'))
const AlunoBancoDeQuestoesPage = React.lazy(() => import('@/pages/AlunoBancoDeQuestoesPage.jsx'))
const AlunoQuestoesPage = React.lazy(() => import('@/pages/AlunoQuestoesPage.jsx'))
const PlatformAdminLoginPage = React.lazy(() => import('@/pages/PlatformAdminLoginPage.jsx'))
const PlatformAdminPanelPage = React.lazy(() => import('@/pages/PlatformAdminPanelPage.jsx'))
const PlatformAdminDeployPage = React.lazy(() => import('@/pages/PlatformAdminDeployPage.jsx'))
const PlatformAdminWithdrawRequestsPage = React.lazy(() => import('@/pages/PlatformAdminWithdrawRequestsPage.jsx'))
const PlatformAdminLogosPage = React.lazy(() => import('@/pages/PlatformAdminLogosPage.jsx'))
const PlatformAdminAnalyticsPage = React.lazy(() => import('@/pages/PlatformAdminAnalyticsPage.jsx'))
const QuestoesPage = React.lazy(() => import('@/pages/QuestoesPage'))
const RepostaCorretaSimuladoPage = React.lazy(() => import('@/pages/RepostaCorretaSimuladoPage'))
const ConfiguracoesPage = React.lazy(() => import('@/pages/ConfiguracoesPage'))
const AdminPage = React.lazy(() => import('@/pages/AdminPage'))
const VimeoCallback = React.lazy(() => import('@/pages/VimeoCallback'))
const AlunoSimuladoResultadoPage = React.lazy(() => import('@/pages/AlunoSimuladoResultadoPage'))
const AlunoBancoQuestoesResultadoPage = React.lazy(() => import('@/pages/AlunoBancoQuestoesResultadoPage'))
const PlanosPage = React.lazy(() => import('@/pages/PlanosPage'))
const PlanosCallback = React.lazy(() => import('@/pages/PlanosCallback'))
const TestMyGateway = React.lazy(() => import('@/pages/TestMyGateway'))

const ADMIN_VIEW_PARAM = 'dev-admin';
const QUESTION_BANK_PATH = '/banco-de-questoes';

// Mapeia títulos amigáveis por view para compor "Connekt - (pagina)"
  const PAGE_TITLES = {
  admin: 'Admin',
  questionBank: 'Banco de Questões',
  questoes: 'Questões',
  cursos: 'Meus Cursos',
  gerenciarAlunos: 'Gerenciar alunos',
  simulados: 'Simulados',
  dimulados: 'Produtos',
  simuladosAproveitamento: 'Simulados - Aproveitamento',
  simuladosAcesso: 'Simulados - Acesso',
  simuladosNovo: 'Simulados - Novo',
  produtosNovo: 'Cursos - Novo',
  cursoPreviewAluno: 'Curso',
  vendas: 'Vendas',
  dashboard: 'Dashboard',
  login: 'Login',
  verifyEmail: 'Verificação de Email',
  resetPassword: 'Redefinir Senha',
  termos: 'Termos e Privacidade',
  hero: 'Hero',
  inbox: 'Inbox',
  repostaCorretaSimulado: 'Reposta correta simulado',
  alunoRepostaCorretaSimulado: 'Reposta correta simulado',
  planos: 'Planos',
  configuracoes: 'Configurações',
  testMyGateway: 'Teste Gateway',
  alunoDashboard: 'Painel',
  alunoAula: 'Aula',
  alunoSimuladoAcesso: 'Simulados - Acesso',
  alunoSimulados: 'Simulados',
  alunoSimuladoResultado: 'Simulados - Resultado',
  alunoConfiguracoes: 'Configurações',
  alunoCurso: 'Curso',
  alunoBancoQuestoes: 'Banco de Questões',
  alunoBancoQuestoesResultado: 'Resultado - Banco de Questões',
  alunoQuestoes: 'Questões',
  platformAdminLogin: 'Admin - Login',
  platformAdminPanel: 'Admin - Painel',
  platformAdminDeploy: 'Admin - Publicar',
  platformAdminWithdraws: 'Admin - Saques',
  platformAdminLogos: 'Admin - Logos',
  platformAdminAnalytics: 'Admin - Analytics',
};

try {
  const rawHash = String(window.location.hash || '')
  const hashLower = rawHash.toLowerCase()
  const path = String(window.location.pathname || '')
  if (rawHash && rawHash !== '#' && hashLower.includes('type=recovery') && !path.startsWith('/reset-password')) {
    try { sessionStorage.setItem('connekt_pending_recovery', '1') } catch (_) {}
    window.history.replaceState({}, '', `/reset-password${window.location.search || ''}${window.location.hash || ''}`)
  }
} catch (_) {}

try {
  const params = new URLSearchParams(window.location.search || '')
  const err = String(params.get('error') || '').trim()
  const errCode = String(params.get('error_code') || '').trim()
  const errDesc = String(params.get('error_description') || '').trim()
  if (err || errCode || errDesc) {
    const payload = JSON.stringify({ error: err, error_code: errCode, error_description: errDesc, at: Date.now() })
    try { sessionStorage.setItem('connekt_pending_login_error', payload) } catch (_) { try { localStorage.setItem('connekt_pending_login_error', payload) } catch (_) {} }
  }
} catch (_) {}

// Deriva a view inicial com base na URL para evitar montar o layout global
// desnecessariamente e prevenir logs de requisições abortadas ao trocar de rota.
const getViewFromLocation = () => {
  const searchParams = new URLSearchParams(window.location.search);
  const rawPath = window.location.pathname;
  const path = rawPath !== '/' && rawPath.endsWith('/') ? rawPath.slice(0, -1) : rawPath;

  if (path === '/admin/login') {
    return 'platformAdminLogin'
  } else if (path === '/admin/saques') {
    return 'platformAdminWithdraws'
  } else if (path === '/admin/logos') {
    return 'platformAdminLogos'
  } else if (path === '/admin/analytics') {
    return 'platformAdminAnalytics'
  } else if (path === '/admin/deploy') {
    return 'platformAdminDeploy'
  } else if (path === '/admin' || path.startsWith('/admin/')) {
    return 'platformAdminPanel'
  }
  if (searchParams.get('view') === ADMIN_VIEW_PARAM) {
    return 'admin';
  } else if (path === '/') {
    const errorCode = String(searchParams.get('error_code') || '').trim()
    const error = String(searchParams.get('error') || '').trim()
    if (errorCode || error) return 'login'
    return 'dashboard';
  } else if (path === '/test-mygateway') {
    return 'testMyGateway';
  } else if (path === QUESTION_BANK_PATH) {
    return 'questionBank';
  } else if (path === '/questoes' || path.startsWith('/questoes/')) {
    return 'questoes';
  } else if (path === '/cursos') {
    return 'cursos';
  } else if (path === '/alunos' || path.startsWith('/alunos/')) {
    return 'gerenciarAlunos';
  } else if (path === '/simulados') {
    return 'simulados';
  } else if (path === '/simulados/acesso') {
    return 'simuladosAcesso';
  } else if (path === '/dimulados') {
    return 'dimulados';
  } else if (path === '/produtos') {
    return 'cursos';
  } else if (path === '/simulados/novo') {
    return 'simuladosNovo';
  } else if (path === '/produtos/novo') {
    return 'produtosNovo';
  } else if (path.startsWith('/produtos/editar/')) {
    return 'produtosNovo';
  } else if (path.startsWith('/curso/') || path.startsWith('/curso-preview/') || path.startsWith('/cursos/preview/')) {
    return 'cursoPreviewAluno';
  } else if (path === '/simulados/aproveitamento') {
    return 'simuladosAproveitamento';
  } else if (path === '/simulados-aproveitamento') {
    return 'simuladosAproveitamento';
  } else if (path === '/vendas') {
    return 'vendas';
  } else if (path === '/dashboard') {
    return 'dashboard';
  } else if (path === '/inbox') {
    return 'inbox';
  } else if (path === '/login') {
    try {
      const intentParam = String(searchParams.get('login_intent') || '').trim().toLowerCase()
      const hasProducerUid =
        !!searchParams.get('producer_uid') ||
        !!searchParams.get('producerUserId') ||
        !!searchParams.get('producer_uid'.toUpperCase())
      if (intentParam === 'aluno' || hasProducerUid) return 'loginAluno'
    } catch (_) {}
    return 'login';
  } else if (path === '/login-aluno-wl') {
    return 'loginAlunoWhitelabel';
  } else if (path === '/login-aluno' || path === '/aluno/login') {
    return 'loginAluno';
  } else if (path === '/aluno/banco-de-questoes/resultado') {
    return 'alunoBancoQuestoesResultado';
  } else if (path === '/aluno/banco-de-questoes') {
    return 'alunoBancoQuestoes';
  } else if (path === '/aluno/questoes') {
    return 'alunoQuestoes';
  } else if (path === '/aluno/aula' || path.startsWith('/aluno/aula/')) {
    return 'alunoAula';
  } else if (path.startsWith('/aluno/curso/') || path.startsWith('/aluno/curso-preview/') || path.startsWith('/aluno/cursos/preview/')) {
    return 'alunoCurso';
  } else if (path === '/aluno/reposta-correta-simulado') {
    return 'alunoRepostaCorretaSimulado';
  } else if (path === '/aluno/simulados/acesso') {
    return 'alunoSimuladoAcesso';
  } else if (path === '/aluno/simulados/resultado') {
    return 'alunoSimuladoResultado';
  } else if (path === '/aluno/simulados') {
    return 'alunoSimulados';
  } else if (path === '/aluno/configuracoes') {
    return 'alunoConfiguracoes';
  } else if (path === '/aluno' || path.startsWith('/aluno/')) {
    return 'alunoDashboard';
  } else if (path === '/vimeo/callback') {
    return 'vimeoCallback';
  } else if (path === '/verify-email') {
    return 'verifyEmail';
  } else if (path === '/reset-password' || path.startsWith('/reset-password/')) {
    return 'resetPassword';
  } else if (path === '/termos') {
    return 'termos';
  } else if (path === '/hero') {
    return 'hero';
  } else if (path === '/reposta-correta-simulado') {
    return 'repostaCorretaSimulado';
  } else if (path === '/planos') {
    return 'planos';
  } else if (path === '/planos/callback') {
    return 'planosCallback';
  } else if (path === '/categorias') {
    return 'categorias';
  } else if (path === '/configuracoes') {
    return 'configuracoes';
  }
  return 'dashboard';
};

function AppContent() {
  const { user, loading, deviceLock } = useAuth();
  const [currentView, setCurrentView] = useState(getViewFromLocation());
  // Chave de localização para forçar remontagem em mudanças de query (ex.: bankId)
  const [locationKey, setLocationKey] = useState(() => window.location.search);
  const lastStableUrlRef = useRef(`${window.location.pathname}${window.location.search}`);
  const userIdRef = useRef(null)
  const loadingRef = useRef(true)
  const authGraceUntilRef = useRef(Date.now() + 8000)
  useEffect(() => {
    userIdRef.current = user?.id || null
  }, [user?.id])
  useEffect(() => {
    loadingRef.current = !!loading
  }, [loading])

  const decodeJwtPayload = (token) => {
    const raw = String(token || '').trim()
    if (!raw) return null
    const parts = raw.split('.')
    if (parts.length < 2) return null
    const p = parts[1]
    const pad = p.length % 4 ? '='.repeat(4 - (p.length % 4)) : ''
    const b64 = (p + pad).replace(/-/g, '+').replace(/_/g, '/')
    try {
      const jsonText = atob(b64)
      return JSON.parse(jsonText || '{}')
    } catch (_) {
      return null
    }
  }

  const isJwtExpiredSoon = (token, leewayMs = 15000) => {
    const payload = decodeJwtPayload(token)
    const exp = Number(payload?.exp || 0)
    if (!Number.isFinite(exp) || exp <= 0) return true
    const expMs = exp * 1000
    return Date.now() + Math.max(0, Number(leewayMs) || 0) >= expMs
  }

  const hasLikelyStoredSession = () => {
    const listKeys = (storage) => {
      if (!storage) return []
      const out = new Set()
      try {
        const n = Number(storage.length || 0)
        if (Number.isFinite(n) && n > 0 && typeof storage.key === 'function') {
          for (let i = 0; i < n; i += 1) {
            const k = storage.key(i)
            if (k) out.add(String(k))
          }
        }
      } catch (_) {}
      try {
        Object.keys(storage || {}).forEach((k) => {
          if (k) out.add(String(k))
        })
      } catch (_) {}
      return Array.from(out)
    }
    const readFrom = (storage) => {
      if (!storage) return null
      try {
        const keys = listKeys(storage)
        const candidates = keys.filter((k) => String(k || '').startsWith('sb-') && String(k || '').includes('auth-token'))
        for (const key of candidates) {
          const raw = storage.getItem(key)
          if (!raw) continue
          let parsed = null
          try { parsed = JSON.parse(raw) } catch (_) { parsed = null }
          if (!parsed || typeof parsed !== 'object') continue
          const s = (parsed.currentSession && typeof parsed.currentSession === 'object') ? parsed.currentSession : parsed
          const at = String(s?.access_token || '').trim()
          const u = s?.user
          if (at && u && !isJwtExpiredSoon(at)) return s
        }
      } catch (_) {}
      return null
    }
    return readFrom(sessionStorage) || readFrom(localStorage) || null
  }

  useEffect(() => {
    initAnalytics()
  }, [])

  useEffect(() => {
    try {
      trackPageView({ path: `${window.location.pathname}${window.location.search}${window.location.hash || ''}`, title: document.title })
    } catch (_) {}
  }, [currentView, locationKey])

  useEffect(() => {
    let cancelled = false
    const inFlightRef = { current: false }
    let abortController = null
    const getAccessToken = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        return String(data?.session?.access_token || '').trim()
      } catch (_) {
        return ''
      }
    }
    const safeLsKeys = () => {
      try {
        const out = []
        const ls = localStorage
        const n = Number(ls?.length || 0)
        for (let i = 0; i < n; i += 1) {
          const k = ls.key(i)
          if (k) out.push(k)
        }
        if (out.length > 0) return out
      } catch (_) {}
      try { return Object.keys(localStorage || {}) } catch (_) { return [] }
    }
    const safeLsGet = (k) => {
      try { return String(localStorage.getItem(String(k || '')) || '') } catch (_) { return '' }
    }
    const safeLsSet = (k, v) => {
      try { localStorage.setItem(String(k || ''), String(v || '')) } catch (_) {}
    }
    const safeLsRemove = (k) => {
      try { localStorage.removeItem(String(k || '')) } catch (_) {}
    }

    const verifyLink = async ({ type, courseId, moduleId, lessonId, simId, linkId, signal }) => {
      const token = await getAccessToken()
      if (!token) return false
      const qs = new URLSearchParams()
      qs.set('type', String(type))
      if (courseId) qs.set('courseId', String(courseId))
      if (moduleId) qs.set('moduleId', String(moduleId))
      if (lessonId) qs.set('lessonId', String(lessonId))
      if (simId) qs.set('simId', String(simId))
      qs.set('linkId', String(linkId))
      try {
        const r = await fetch(`/api/simulado-checkout-verify?${qs.toString()}`, { headers: { Authorization: `Bearer ${token}` }, signal })
        const body = await r.json().catch(() => ({}))
        return !!(r.ok && body?.paid === true)
      } catch (e) {
        const name = String(e?.name || '').toLowerCase()
        const msg = String(e?.message || e || '').toLowerCase()
        if (name.includes('abort') || msg.includes('aborted') || msg.includes('aborterror')) return false
        return false
      }
    }

    const run = async () => {
      if (cancelled) return
      if (loadingRef.current) return
      if (inFlightRef.current) return
      const uid = userIdRef.current
      if (!uid) return
      try {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      } catch (_) {}
      inFlightRef.current = true
      try {
        if (abortController) {
          try { abortController.abort() } catch (_) {}
        }
        abortController = typeof AbortController !== 'undefined' ? new AbortController() : null
        const signal = abortController?.signal

        const keys = safeLsKeys()
        const tasks = []

        for (const k of keys) {
          const key = String(k || '')
          if (key.startsWith('connekt_course_pending_link:')) {
            const courseId = key.slice('connekt_course_pending_link:'.length)
            const linkId = safeLsGet(key).trim()
            const ownedKey = `connekt_course_owned:${courseId}`
            if (!courseId || !linkId) continue
            if (safeLsGet(ownedKey) === '1') { safeLsRemove(key); continue }
            tasks.push(async () => {
              const paid = await verifyLink({ type: 'course', courseId, linkId, signal })
              if (paid) {
                safeLsSet(ownedKey, '1')
                safeLsRemove(key)
              }
            })
          }
          if (key.startsWith('connekt_module_pending_link:')) {
            const rest = key.slice('connekt_module_pending_link:'.length)
            const parts = rest.split(':')
            const courseId = String(parts[0] || '')
            const moduleId = String(parts[1] || '')
            const linkId = safeLsGet(key).trim()
            const ownedKey = `connekt_module_owned:${courseId}:${moduleId}`
            if (!courseId || !moduleId || !linkId) continue
            if (safeLsGet(ownedKey) === '1') { safeLsRemove(key); continue }
            tasks.push(async () => {
              const paid = await verifyLink({ type: 'module', courseId, moduleId, linkId, signal })
              if (paid) {
                safeLsSet(ownedKey, '1')
                safeLsRemove(key)
              }
            })
          }
          if (key.startsWith('connekt_simulado_pending_link:')) {
            const simId = key.slice('connekt_simulado_pending_link:'.length)
            const linkId = safeLsGet(key).trim()
            const ownedKey = `connekt_simulado_owned:${simId}`
            if (!simId || !linkId) continue
            if (safeLsGet(ownedKey) === '1') { safeLsRemove(key); continue }
            tasks.push(async () => {
              const paid = await verifyLink({ type: 'simulado', simId, linkId, signal })
              if (paid) {
                safeLsSet(ownedKey, '1')
                safeLsRemove(key)
              }
            })
          }
        }

        for (const fn of tasks) {
          if (cancelled) break
          try { await fn() } catch (_) {}
        }
      } finally {
        inFlightRef.current = false
      }
    }

    const onFocus = () => { run() }
    run()
    try { window.addEventListener('focus', onFocus) } catch (_) {}
    const timer = window.setInterval(() => { run() }, 15_000)
    return () => {
      cancelled = true
      try { abortController?.abort() } catch (_) {}
      try { window.removeEventListener('focus', onFocus) } catch (_) {}
      try { window.clearInterval(timer) } catch (_) {}
    }
  }, [user?.id])
  let forceResetPassword = false
  try {
    forceResetPassword = String(window.location.pathname || '').startsWith('/reset-password')
  } catch (_) {
    forceResetPassword = false
  }

  useEffect(() => {
    const handleLocationChange = () => {
      try {
        const path = String(window.location.pathname || '')
        if (path === '/login' || path === '/login-aluno' || path === '/login-aluno-wl' || path === '/aluno/login') {
          const u = new URL(window.location.href)
          const code = String(u.searchParams.get('code') || '').trim()
          if (code) {
            try { sessionStorage.setItem('connekt_pkce_pending_code', code) } catch (_) {}
            try { u.searchParams.delete('code'); u.searchParams.delete('state') } catch (_) {}
            window.history.replaceState({}, '', `${u.pathname}${u.search}${u.hash}`)
            window.dispatchEvent(new PopStateEvent('popstate'))
            return
          }
        }
      } catch (_) {}

      try {
        const rawHash = String(window.location.hash || '')
        if (rawHash && rawHash !== '#' && rawHash.includes('error=')) {
          const params = new URLSearchParams(rawHash.startsWith('#') ? rawHash.slice(1) : rawHash)
          const err = params.get('error')
          const errCode = params.get('error_code')
          const errDesc = params.get('error_description')
          const path = String(window.location.pathname || '')
          const intent = (() => {
            try { return String(sessionStorage.getItem('connekt_login_intent') || localStorage.getItem('connekt_login_intent') || '') } catch (_) { return '' }
          })()
          const targetPath = (path === '/login-aluno' || path === '/login-aluno-wl' || intent === 'aluno') ? '/login-aluno' : '/login'
          const target = new URL(`${window.location.origin}${targetPath}`)
          if (err) target.searchParams.set('error', err)
          if (errCode) target.searchParams.set('error_code', errCode)
          if (errDesc) target.searchParams.set('error_description', errDesc)
          window.history.replaceState({}, '', `${target.pathname}${target.search}`)
          window.dispatchEvent(new PopStateEvent('popstate'))
          return
        }
      } catch (_) {}

      try {
        const host = String(window.location.hostname || '').toLowerCase()
        const path = String(window.location.pathname || '')
        if (host === 'app.connektco.com' && path === '/login-aluno-wl') {
          const u = new URL(window.location.href)
          const intentParam = String(u.searchParams.get('login_intent') || '').trim().toLowerCase()
          const wlHostParam = String(u.searchParams.get('wl_host') || '').trim().toLowerCase()
          if (!wlHostParam || intentParam === 'aluno') {
            u.pathname = '/login-aluno'
            u.searchParams.delete('wl_host')
            u.searchParams.delete('oauth_provider')
            if (!u.searchParams.get('login_intent')) u.searchParams.set('login_intent', 'aluno')
            window.history.replaceState({}, '', `${u.pathname}${u.search}${u.hash}`)
            window.dispatchEvent(new PopStateEvent('popstate'))
            return
          }
        }
      } catch (_) {}

      try {
        const host = String(window.location.hostname || '').toLowerCase()
        const isCustomProducerHost = host.endsWith('.app.connektco.com') && host !== 'app.connektco.com'
        const path = String(window.location.pathname || '')
        if (isCustomProducerHost && (path === '/' || path === '/login' || path === '/login-aluno')) {
          window.history.replaceState({}, '', `/login-aluno-wl${window.location.search || ''}`)
          window.dispatchEvent(new PopStateEvent('popstate'))
          return
        }
      } catch (_) {}

      try {
        const host = String(window.location.hostname || '').toLowerCase()
        const path = String(window.location.pathname || '')
        if (host === 'app.connektco.com' && (path === '/aluno' || path.startsWith('/aluno/'))) {
          let shouldConsiderRedirect = false
          try {
            shouldConsiderRedirect = !loadingRef.current && !userIdRef.current
          } catch (_) {
            shouldConsiderRedirect = false
          }
          if (shouldConsiderRedirect) {
            const params = new URLSearchParams(window.location.search || '')
            const producerUid =
              params.get('producer_uid') ||
              params.get('producerUserId') ||
              params.get('producer_uid'.toUpperCase()) ||
              ''
            const pid = String(producerUid || '').trim()
            if (pid) {
              try {
                const oauthStarting = (() => {
                  try { return sessionStorage.getItem('connekt_aluno_oauth_starting') === '1' } catch (_) { return false }
                })()
                const hasAuthParams = params.get('code') || params.get('error') || params.get('error_code')
                const hasOauthProvider = !!params.get('oauth_provider')
                const rawHash = String(window.location.hash || '').toLowerCase()
                const hasTokens =
                  rawHash.includes('access_token=') ||
                  rawHash.includes('refresh_token=') ||
                  rawHash.includes('sb_at=') ||
                  rawHash.includes('sb_rt=')
                const wlHostParam = String(params.get('wl_host') || '').trim().toLowerCase()
                const loginIntentParam = String(params.get('login_intent') || '').trim().toLowerCase()
                if (!wlHostParam && loginIntentParam === 'aluno') {
                  try { sessionStorage.removeItem('connekt_wl_host') } catch (_) {}
                  try { localStorage.removeItem('connekt_wl_host') } catch (_) {}
                  try { sessionStorage.removeItem('connekt_wl_handoff_target') } catch (_) {}
                  try { localStorage.removeItem('connekt_wl_handoff_target') } catch (_) {}
                }
                if (wlHostParam && !oauthStarting && !hasOauthProvider && !hasAuthParams && !hasTokens) {
                  const target =
                    `/api/producer?type=aluno_redirect&producer_uid=${encodeURIComponent(pid)}` +
                    `&p=${encodeURIComponent(path)}` +
                    `&q=${encodeURIComponent(window.location.search || '')}`
                  window.location.replace(target)
                  return
                }
              } catch (_) {}
            }
          }
        }
      } catch (_) {}

      try {
        const path = String(window.location.pathname || '')
        const isAlunoPath =
          path === '/login-aluno' ||
          path === '/login-aluno-wl' ||
          path === '/aluno/login' ||
          path === '/aluno' ||
          path.startsWith('/aluno/')
        if (isAlunoPath) {
          const u = new URL(window.location.href)
          const fromQuery = String(
            u.searchParams.get('producer_uid') ||
              u.searchParams.get('producerUserId') ||
              u.searchParams.get('producer_uid'.toUpperCase()) ||
              '',
          ).trim()
          const readKey = (key) => {
            try {
              const s = sessionStorage.getItem(key)
              if (s && String(s).trim()) return String(s).trim()
            } catch (_) {}
            try {
              const l = localStorage.getItem(key)
              if (l && String(l).trim()) return String(l).trim()
            } catch (_) {}
            return ''
          }
          const writeKey = (key, v) => {
            try { sessionStorage.setItem(key, v) } catch (_) { try { localStorage.setItem(key, v) } catch (_) {} }
            try { localStorage.setItem(key, v) } catch (_) {}
          }

          if (fromQuery) {
            writeKey('connekt_student_producer_uid', fromQuery)
            writeKey('connekt_producer_uid', fromQuery)
            try { setActiveProducerUserId(fromQuery) } catch (_) {}
          } else {
            const scoped = readKey('connekt_student_producer_uid') || readKey('connekt_producer_uid')
            if (scoped) {
              u.searchParams.set('producer_uid', scoped)
              window.history.replaceState({}, '', `${u.pathname}${u.search}${u.hash}`)
              try { setActiveProducerUserId(scoped) } catch (_) {}
            }
          }
        }
      } catch (_) {}

      const currentUrl = `${window.location.pathname}${window.location.search}`;
      if (isUploadInProgress() && currentUrl !== lastStableUrlRef.current) {
        toast({ description: 'Upload em andamento. Aguarde concluir para sair desta página.', variant: 'destructive' });
        window.history.replaceState({}, '', lastStableUrlRef.current);
        return;
      }
      const nextView = getViewFromLocation();
      setCurrentView(nextView);
      try {
        const path = String(window.location.pathname || '')
        const isAluno =
          path === '/login-aluno' ||
          path === '/login-aluno-wl' ||
          path === '/aluno/login' ||
          path === '/aluno' ||
          path.startsWith('/aluno/') ||
          String(nextView || '').startsWith('aluno') ||
          nextView === 'loginAluno' ||
          nextView === 'loginAlunoWhitelabel'
        const isProdutor = path === '/login' || nextView === 'login'
        if (isAluno) {
          try { sessionStorage.setItem('connekt_login_intent', 'aluno') } catch (_) {}
          try { sessionStorage.setItem('connekt_login_mode', 'aluno') } catch (_) {}
          try { localStorage.setItem('connekt_login_mode', 'aluno') } catch (_) {}
        } else if (isProdutor) {
          try { sessionStorage.setItem('connekt_login_intent', 'produtor') } catch (_) {}
          try { sessionStorage.setItem('connekt_login_mode', 'produtor') } catch (_) {}
          try { localStorage.setItem('connekt_login_mode', 'produtor') } catch (_) {}
        }
      } catch (_) {}
      // Atualiza chave quando a query muda sem alterar o path
      setLocationKey(window.location.search);
      document.title = 'Connekt - Plataforma de Cursos de Medicina';
      lastStableUrlRef.current = `${window.location.pathname}${window.location.search}`;
    };

    // Initial load
    handleLocationChange();

    // Listen for navigation changes
    window.addEventListener('popstate', handleLocationChange);
    let lastUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`
    const pollId = window.setInterval(() => {
      try {
        const nextUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`
        if (nextUrl === lastUrl) return
        lastUrl = nextUrl
        handleLocationChange()
      } catch (_) {}
    }, 200)
    
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.clearInterval(pollId)
    };
  }, []);

  useEffect(() => {
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    const guardReplaceState = (original) => function guardedReplaceState() {
      if (isUploadInProgress()) {
        toast({ description: 'Upload em andamento. Aguarde concluir para sair desta página.', variant: 'destructive' });
        return;
      }
      return original.apply(window.history, arguments);
    };

    const guardPushState = (original) => function guardedPushState() {
      if (isUploadInProgress()) {
        toast({ description: 'Upload em andamento. Aguarde concluir para sair desta página.', variant: 'destructive' });
        return;
      }
      const r = original.apply(window.history, arguments);
      try {
        window.dispatchEvent(new PopStateEvent('popstate'))
      } catch (_) {}
      return r;
    };

    window.history.pushState = guardPushState(originalPushState);
    window.history.replaceState = guardReplaceState(originalReplaceState);

    const onBeforeUnload = (e) => {
      if (!isUploadInProgress()) return;
      e.preventDefault();
      e.returnValue = '';
    };

    const onClickCapture = (e) => {
      if (!isUploadInProgress()) return;
      const target = e.target;
      if (!target || typeof target.closest !== 'function') return;
      const anchor = target.closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href') || '';
      if (!href) return;
      if (href.startsWith('#') || href.startsWith('javascript:')) return;
      e.preventDefault();
      e.stopPropagation();
      toast({ description: 'Upload em andamento. Aguarde concluir para sair desta página.', variant: 'destructive' });
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClickCapture, true);

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClickCapture, true);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, []);

  useEffect(() => {
    let isLocalhost = false
    try {
      const host = String(window.location.hostname || '').toLowerCase()
      isLocalhost = host === 'localhost' || host === '127.0.0.1'
    } catch (_) {}

    const onResourceError = (e) => {
      const t = e && e.target ? e.target : null
      const tag = t && t.tagName ? String(t.tagName).toLowerCase() : ''
      if (tag !== 'img' && tag !== 'video' && tag !== 'audio' && tag !== 'source') return
      const src = String(t?.currentSrc || t?.src || '').trim()
      if (!src.startsWith('blob:')) return
      e.preventDefault()
      e.stopImmediatePropagation?.()
    }

    const onUnhandledRejection = (e) => {
      const reason = e?.reason
      const name = String(reason?.name || '')
      const msg = String(reason?.message || reason || '').toLowerCase()
      const stack = String(reason?.stack || '')
      const isAbort = name === 'AbortError'
      const isFetchAbort = msg.includes('failed to fetch') || msg.includes('load failed') || msg.includes('networkerror') || msg.includes('quic') || msg.includes('too_many_rtos') || msg.includes('err_quic_protocol_error')
      const isSupabase = stack.includes('@supabase_supabase-js') || stack.includes('supabase.co') || msg.includes('supabase.co')
      if (!isAbort && !(isLocalhost && isFetchAbort && isSupabase)) return
      e.preventDefault?.()
    }

    window.addEventListener('error', onResourceError, true)
    window.addEventListener('unhandledrejection', onUnhandledRejection)
    return () => {
      window.removeEventListener('error', onResourceError, true)
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
    }
  }, []);

  const renderContent = () => {
    let node = null
    switch (currentView) {
      case 'platformAdminLogin':
        node = <PlatformAdminLoginPage />
        break
      case 'platformAdminPanel':
        node = <PlatformAdminPanelPage />
        break
      case 'platformAdminDeploy':
        node = <PlatformAdminDeployPage />
        break
      case 'platformAdminWithdraws':
        node = <PlatformAdminWithdrawRequestsPage />
        break
      case 'platformAdminLogos':
        node = <PlatformAdminLogosPage />
        break
      case 'platformAdminAnalytics':
        node = <PlatformAdminAnalyticsPage />
        break
      case 'admin':
        node = <AdminPage />
        break
      case 'questionBank':
        node = <QuestionBankPage />
        break
      case 'questoes':
        node = <QuestoesPage key={locationKey} />
        break
      case 'cursos':
        node = <CursosPage />
        break
      case 'gerenciarAlunos':
        node = <AlunosPage />
        break
      case 'simulados':
        node = <SimuladosPage />
        break
      case 'simuladosAcesso':
        node = <SimuladoAcessoPage />
        break
      case 'dimulados':
        node = <DimuladosPage />
        break
      case 'simuladosNovo':
        node = <SimuladosNovo />
        break
      case 'produtosNovo':
        node = <ProdutosNovo />
        break
      case 'cursoPreviewAluno':
        node = <CursoPreviewAlunoPage />
        break
      case 'simuladosAproveitamento':
        node = <SimuladosAproveitamentoPage />
        break
      case 'vendas':
        node = <VendasPage />
        break
      case 'dashboard':
        node = <DashboardPage />
        break
      case 'login':
        node = <LoginPage />
        break
      case 'loginAluno':
        node = <LoginAlunoPage />
        break
      case 'loginAlunoWhitelabel':
        node = <LoginAlunoWhitelabelPage />
        break
      case 'alunoDashboard':
        node = <AlunoDashboardPage />
        break
      case 'alunoAula':
        node = <AlunoAulaPage />
        break
      case 'alunoCurso':
        node = <AlunoCursoPage />
        break
      case 'alunoSimuladoAcesso':
        node = <AlunoSimuladoAcessoPage />
        break
      case 'alunoSimulados':
        node = <AlunoSimuladosPage />
        break
      case 'alunoSimuladoResultado':
        node = <AlunoSimuladoResultadoPage />
        break
      case 'alunoConfiguracoes':
        node = <AlunoConfiguracoesPage />
        break
      case 'alunoBancoQuestoes':
        node = <AlunoBancoDeQuestoesPage />
        break
      case 'alunoBancoQuestoesResultado':
        node = <AlunoBancoQuestoesResultadoPage key={locationKey} />
        break
      case 'alunoQuestoes':
        node = <AlunoQuestoesPage key={locationKey} />
        break
      case 'verifyEmail':
        node = <EmailVerificationPage />
        break
      case 'resetPassword':
        node = <ResetPasswordPage />
        break
      case 'termos':
        node = <TermosPrivacidadePage />
        break
      case 'vimeoCallback':
        node = <VimeoCallback />
        break
      case 'hero':
        node = <HeroPage />
        break
      case 'repostaCorretaSimulado':
        node = <RepostaCorretaSimuladoPage />
        break
      case 'alunoRepostaCorretaSimulado':
        node = <RepostaCorretaSimuladoPage />
        break
      case 'planos':
        node = <PlanosPage />
        break
      case 'planosCallback':
        node = <PlanosCallback />
        break
      case 'categorias':
        node = <CategoriasPage />
        break
      case 'configuracoes':
        node = <ConfiguracoesPage />
        break
      case 'testMyGateway':
        node = <TestMyGateway />
        break
      case 'inbox':
      default:
        node = <InboxPage />
        break
    }

    return (
      <Suspense fallback={<div>Carregando...</div>}>
        <ErrorBoundary key={locationKey}>
          {node}
        </ErrorBoundary>
      </Suspense>
    )
  };

  const isPublicView = useMemo(() => (forceResetPassword || currentView === 'login' || currentView === 'loginAluno' || currentView === 'loginAlunoWhitelabel' || currentView === 'verifyEmail' || currentView === 'resetPassword' || currentView === 'termos' || currentView === 'platformAdminLogin' || currentView === 'platformAdminLogos' || currentView === 'platformAdminAnalytics'), [currentView, forceResetPassword]);
  const isDemoStudent = useMemo(() => {
    try {
      const host = String(window.location.hostname || '').toLowerCase()
      const allowed = host === 'localhost' || host === '127.0.0.1'
      if (!allowed) return false
      const params = new URLSearchParams(window.location.search || '')
      if (params.get('demo') === '1') return true
      return String(localStorage.getItem('connekt_demo_student') || '') === '1'
    } catch (_) {
      return false
    }
  }, [currentView, locationKey]);

  const loginMode = useMemo(() => {
    try {
      return String(sessionStorage.getItem('connekt_login_mode') || localStorage.getItem('connekt_login_mode') || '')
    } catch (_) {
      return ''
    }
  }, [currentView, locationKey])

  const metaRole = useMemo(() => {
    const meta = user?.user_metadata && typeof user.user_metadata === 'object' ? user.user_metadata : {}
    const raw = String(meta?.account_type || meta?.role || meta?.platform_role || '').trim().toLowerCase()
    if (raw === 'admin' || raw === 'administrador') return 'admin'
    if (raw === 'produtor' || raw === 'producer') return 'produtor'
    if (raw === 'aluno' || raw === 'student') return 'aluno'
    return ''
  }, [user?.id, user?.user_metadata])

  const [resolvedRole, setResolvedRole] = useState('')
  useEffect(() => {
    let active = true
    const uid = String(user?.id || '').trim()
    if (!uid) {
      setResolvedRole('')
      return () => { active = false }
    }
    if (metaRole) {
      setResolvedRole(metaRole)
      return () => { active = false }
    }
    setResolvedRole('checking')
    const run = async () => {
      try {
        const { data } = await supabase.from('courses').select('id').eq('user_id', uid).limit(1)
        if (!active) return
        if (Array.isArray(data) && data.length > 0) {
          setResolvedRole('produtor')
          return
        }
      } catch (_) {}
      try {
        const { data } = await supabase
          .from('producers')
          .select('id')
          .or(`user_id.eq.${uid},id.eq.${uid},external_id.eq.${uid}`)
          .maybeSingle()
        if (!active) return
        if (data?.id) {
          setResolvedRole('produtor')
          return
        }
      } catch (_) {}
      if (!active) return
      setResolvedRole('aluno')
    }
    run()
    return () => { active = false }
  }, [user?.id, metaRole])

  const isAlunoFlow = useMemo(() => {
    const path = String(window.location.pathname || '')
    return loginMode === 'aluno' || path === '/aluno' || path.startsWith('/aluno/') || path === '/login-aluno' || path === '/login-aluno-wl' || path === '/aluno/login'
  }, [loginMode, currentView, locationKey])

  useEffect(() => {
    if (loading) return
    if (!user) return
    if (deviceLock) return
    if (resolvedRole === '' || resolvedRole === 'checking') return

    const view = String(currentView || '')
    const path = String(window.location.pathname || '')
    const isLoginView =
      view === 'login' ||
      view === 'loginAluno' ||
      view === 'loginAlunoWhitelabel' ||
      path === '/login' ||
      path === '/login-aluno' ||
      path === '/login-aluno-wl' ||
      path === '/aluno/login'
    if (isPublicView && !isLoginView) return
    const isPlatformAdminView = view === 'platformAdminPanel' || view === 'platformAdminDeploy' || view === 'platformAdminWithdraws' || view === 'platformAdminLogin' || path === '/admin' || path.startsWith('/admin/')
    const isAlunoView = view.startsWith('aluno') || path === '/aluno' || path.startsWith('/aluno/')
    const isProducerView =
      !isPlatformAdminView &&
      !isAlunoView &&
      view !== 'cursoPreviewAluno' &&
      view !== 'termos' &&
      view !== 'resetPassword' &&
      view !== 'verifyEmail' &&
      view !== 'hero'

    const go = (target) => {
      const t = String(target || '').trim()
      if (!t) return
      if (path === t) return
      window.history.replaceState({}, '', t)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }

    if (view === 'platformAdminLogos' || path === '/admin/logos') return
    if (view === 'platformAdminAnalytics' || path === '/admin/analytics') return
    if (resolvedRole === 'admin') return

    if (isPlatformAdminView) {
      go(resolvedRole === 'aluno' ? '/aluno' : '/dashboard')
      return
    }
    if (isAlunoView && resolvedRole === 'produtor' && !isAlunoFlow) {
      go('/dashboard')
      return
    }
    if (isProducerView && resolvedRole === 'aluno') {
      go('/aluno')
    }
  }, [loading, user, deviceLock, isPublicView, resolvedRole, currentView, isAlunoFlow])

  useEffect(() => {
    if (loading) return;
    if (user) return;
    if (isPublicView) return;
    const stored = hasLikelyStoredSession()
    if (stored && Date.now() < authGraceUntilRef.current) return
    if (currentView === 'platformAdminPanel' || currentView === 'platformAdminDeploy' || currentView === 'platformAdminWithdraws') {
      const target = '/admin/login'
      if (window.location.pathname !== target) {
        window.history.replaceState({}, '', target);
        window.dispatchEvent(new PopStateEvent('popstate'));
      } else {
        setCurrentView('platformAdminLogin')
      }
      return
    }
    const isAlunoPath = isAlunoFlow
    if ((isAlunoPath || currentView === 'cursoPreviewAluno') && isDemoStudent) return
    const host = String(window.location.hostname || '').toLowerCase()
    const isWhitelabelHost = host.endsWith('.app.connektco.com') && host !== 'app.connektco.com'
    const target = isAlunoPath ? (isWhitelabelHost ? '/login-aluno-wl' : '/login-aluno') : '/login'
    if (window.location.pathname !== target) {
      window.history.replaceState({}, '', target);
      window.dispatchEvent(new PopStateEvent('popstate'));
    } else {
      setCurrentView(isAlunoPath ? (isWhitelabelHost ? 'loginAlunoWhitelabel' : 'loginAluno') : 'login');
    }
  }, [user, loading, isPublicView, isDemoStudent, currentView, isAlunoFlow]);

  const hasQueryError = (() => {
    try {
      const params = new URLSearchParams(window.location.search || '')
      return Boolean(params.get('error') || params.get('error_code') || params.get('error_description'))
    } catch (_) {
      return false
    }
  })()

  if (loading && hasQueryError) {
    const host = String(window.location.hostname || '').toLowerCase()
    const isWhitelabelHost = host.endsWith('.app.connektco.com') && host !== 'app.connektco.com'
    return isAlunoFlow ? (isWhitelabelHost ? <LoginAlunoWhitelabelPage /> : <LoginAlunoPage />) : <LoginPage />
  }

  if (loading && !isPublicView) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-[16px] shadow-sm border border-[#E3E4E5] px-8 py-7 flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full border-4 border-[#E3E4E5] border-t-[#0047BB] animate-spin" />
          <div className="text-[14px] font-semibold text-[#22252B]">Carregando…</div>
          <div className="text-[12px] text-[#6B7280] text-center">Aguarde um instante.</div>
        </div>
      </div>
    );
  }

  if (!user && !isPublicView && !(isDemoStudent && (currentView === 'alunoDashboard' || currentView === 'alunoAula' || currentView === 'alunoCurso' || currentView === 'alunoSimulados' || currentView === 'alunoSimuladoAcesso' || currentView === 'alunoSimuladoResultado' || currentView === 'alunoConfiguracoes' || currentView === 'alunoRepostaCorretaSimulado' || currentView === 'cursoPreviewAluno'))) {
    const stored = hasLikelyStoredSession()
    if (stored && Date.now() < authGraceUntilRef.current) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-[16px] shadow-sm border border-[#E3E4E5] px-8 py-7 flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full border-4 border-[#E3E4E5] border-t-[#0047BB] animate-spin" />
            <div className="text-[14px] font-semibold text-[#22252B]">Restaurando sessão…</div>
            <div className="text-[12px] text-[#6B7280] text-center">Aguarde um instante.</div>
          </div>
        </div>
      )
    }
    if (currentView === 'platformAdminPanel' || currentView === 'platformAdminDeploy' || currentView === 'platformAdminWithdraws' || currentView === 'platformAdminLogos' || currentView === 'platformAdminAnalytics') {
      return <PlatformAdminLoginPage />
    }
    const host = String(window.location.hostname || '').toLowerCase()
    const isWhitelabelHost = host.endsWith('.app.connektco.com') && host !== 'app.connektco.com'
    return isAlunoFlow ? (isWhitelabelHost ? <LoginAlunoWhitelabelPage /> : <LoginAlunoPage />) : <LoginPage />;
  }

  if (user && deviceLock) {
    return <DeviceLockPage />
  }

  return (
    <TaxonomyProvider>
      <AnalyticsHead />
      <DeviceAccessRequestModal />
      {(currentView === 'login' || currentView === 'loginAluno' || currentView === 'loginAlunoWhitelabel' || currentView === 'verifyEmail' || currentView === 'platformAdminLogin') ? (
        currentView === 'login'
          ? <LoginPage />
          : currentView === 'loginAluno'
            ? <LoginAlunoPage />
            : currentView === 'loginAlunoWhitelabel'
              ? <LoginAlunoWhitelabelPage />
              : currentView === 'platformAdminLogin'
                ? <PlatformAdminLoginPage />
                : <EmailVerificationPage />
      ) : (forceResetPassword || currentView === 'resetPassword') ? (
        <ResetPasswordPage />
      ) : currentView === 'termos' ? (
        <TermosPrivacidadePage />
      ) : (currentView === 'platformAdminPanel' || currentView === 'platformAdminDeploy' || currentView === 'platformAdminWithdraws' || currentView === 'platformAdminLogos' || currentView === 'platformAdminAnalytics' || currentView === 'produtosNovo' || currentView === 'cursoPreviewAluno' || currentView === 'questoes' || currentView === 'alunoDashboard' || currentView === 'alunoAula' || currentView === 'alunoCurso' || currentView === 'alunoSimulados' || currentView === 'alunoSimuladoAcesso' || currentView === 'alunoSimuladoResultado' || currentView === 'alunoConfiguracoes' || currentView === 'alunoRepostaCorretaSimulado' || currentView === 'alunoBancoQuestoes' || currentView === 'alunoBancoQuestoesResultado' || currentView === 'alunoQuestoes') ? (
        renderContent()
      ) : (
        <MainLayout>
          {renderContent()}
        </MainLayout>
      )}
    </TaxonomyProvider>
  );
}

function App() {
  // Detecta ambiente local para evitar injeção de SpeedInsights no preview local
  const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const [activeUploadCount, setActiveUploadCount] = useState(() => getActiveUploadCount());

  useEffect(() => {
    return subscribeUploadGuard((count) => {
      setActiveUploadCount(count);
    });
  }, []);

  useEffect(() => {
    const nextOpen = activeUploadCount > 0;
    if (!nextOpen) return;
    const prevOverflow = document?.body?.style?.overflow;
    if (document?.body?.style) document.body.style.overflow = 'hidden';
    return () => {
      if (document?.body?.style) document.body.style.overflow = prevOverflow || '';
    };
  }, [activeUploadCount]);

  return (
    <AuthProvider>
      <AppContent />
      {activeUploadCount > 0 ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-[16px] shadow-xl border border-[#E3E4E5] px-8 py-7 flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full border-4 border-[#E3E4E5] border-t-[#0047BB] animate-spin" />
            <div className="text-[14px] font-semibold text-[#22252B]">Upload em andamento</div>
            <div className="text-[12px] text-[#6B7280] text-center">Aguarde concluir para continuar.</div>
          </div>
        </div>
      ) : null}
      <Toaster />
      {/* {import.meta.env.PROD && !isLocalhost && <SpeedInsights />} */}
    </AuthProvider>
  );
}

export default App;


