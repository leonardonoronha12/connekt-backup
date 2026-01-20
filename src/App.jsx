import React, { useState, useEffect, Suspense, useMemo, useRef } from 'react';
import { HelmetProvider } from 'react-helmet-async';
// import { SpeedInsights } from '@vercel/speed-insights/react';
import { AuthProvider, useAuth } from '@/contexts/SupabaseAuthContext';
import { TaxonomyProvider } from '@/contexts/TaxonomyContext';
import MainLayout from '@/components/MainLayout';
import InboxPage from '@/pages/InboxPage';
import CategoriasPage from '@/pages/CategoriasPage';
import QuestionBankPage from '@/pages/QuestionBankPage';
import CursosPage from '@/pages/CursosPage';
import AlunosPage from '@/pages/AlunosPage';
import SimuladosPage from '@/pages/SimuladosPage';
import DimuladosPage from '@/pages/DimuladosPage';
import SimuladosAproveitamentoPage from '@/pages/SimuladosAproveitamentoPage';
import SimuladoAcessoPage from '@/pages/SimuladoAcessoPage.jsx';
import SimuladosNovo from '@/pages/SimuladosNovo';
import ProdutosNovo from '@/pages/ProdutosNovo.tsx';
import CursoPreviewAlunoPage from '@/pages/CursoPreviewAlunoPage';
import VendasPage from '@/pages/VendasPage';
import DashboardPage from '@/pages/DashboardPage';
import LoginPage from '@/pages/LoginPage';
import HeroPage from '@/pages/HeroPage';
import EmailVerificationPage from '@/pages/EmailVerificationPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage.jsx';
import TermosPrivacidadePage from '@/pages/TermosPrivacidadePage.jsx';
import DeviceLockPage from '@/pages/DeviceLockPage.jsx';
import LoginAlunoPage from '@/pages/LoginAlunoPage.jsx';
import AlunoDashboardPage from '@/pages/AlunoDashboardPage.jsx';
import AlunoAulaPage from '@/pages/AlunoAulaPage.jsx';
import AlunoSimuladoAcessoPage from '@/pages/AlunoSimuladoAcessoPage.jsx';
import AlunoSimuladosPage from '@/pages/AlunoSimuladosPage.jsx';
import AlunoConfiguracoesPage from '@/pages/AlunoConfiguracoesPage.jsx';
import AlunoCursoPage from '@/pages/AlunoCursoPage.jsx';
import QuestoesPage from '@/pages/QuestoesPage';
import RepostaCorretaSimuladoPage from '@/pages/RepostaCorretaSimuladoPage';
import ConfiguracoesPage from '@/pages/ConfiguracoesPage';
import { Toaster } from '@/components/ui/toaster';
import { toast } from '@/components/ui/use-toast';
import { isUploadInProgress, subscribeUploadGuard, getActiveUploadCount } from '@/services/uploadGuard';

const ADMIN_VIEW_PARAM = 'dev-admin';
const QUESTION_BANK_PATH = '/banco-de-questoes';

// Mapeia títulos amigáveis por view para compor "Connekt - (pagina)"
  const PAGE_TITLES = {
  admin: 'Admin',
  questionBank: 'Banco de Questões',
  questoes: 'Questões',
  cursos: 'Meus Cursos',
  alunos: 'Alunos',
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
  alunoConfiguracoes: 'Configurações',
  alunoCurso: 'Curso',
};

// Deriva a view inicial com base na URL para evitar montar o layout global
// desnecessariamente e prevenir logs de requisições abortadas ao trocar de rota.
const getViewFromLocation = () => {
  const searchParams = new URLSearchParams(window.location.search);
  const path = window.location.pathname;

  if (searchParams.get('view') === ADMIN_VIEW_PARAM) {
    return 'admin';
  } else if (path === '/') {
    return 'dashboard';
  } else if (path === '/test-mygateway') {
    return 'testMyGateway';
  } else if (path === QUESTION_BANK_PATH) {
    return 'questionBank';
  } else if (path === '/questoes' || path.startsWith('/questoes/')) {
    return 'questoes';
  } else if (path === '/cursos') {
    return 'cursos';
  } else if (path === '/alunos') {
    return 'alunos';
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
  } else if (path === '/vendas') {
    return 'vendas';
  } else if (path === '/dashboard') {
    return 'dashboard';
  } else if (path === '/inbox') {
    return 'inbox';
  } else if (path === '/login') {
    return 'login';
  } else if (path === '/login-aluno' || path === '/aluno/login') {
    return 'loginAluno';
  } else if (path === '/aluno/aula' || path.startsWith('/aluno/aula/')) {
    return 'alunoAula';
  } else if (path.startsWith('/aluno/curso/') || path.startsWith('/aluno/curso-preview/') || path.startsWith('/aluno/cursos/preview/')) {
    return 'alunoCurso';
  } else if (path === '/aluno/reposta-correta-simulado') {
    return 'alunoRepostaCorretaSimulado';
  } else if (path === '/aluno/simulados/acesso') {
    return 'alunoSimuladoAcesso';
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

  useEffect(() => {
    const handleLocationChange = () => {
      const currentUrl = `${window.location.pathname}${window.location.search}`;
      if (isUploadInProgress() && currentUrl !== lastStableUrlRef.current) {
        toast({ description: 'Upload em andamento. Aguarde concluir para sair desta página.', variant: 'destructive' });
        window.history.replaceState({}, '', lastStableUrlRef.current);
        return;
      }
      const nextView = getViewFromLocation();
      setCurrentView(nextView);
      // Atualiza chave quando a query muda sem alterar o path
      setLocationKey(window.location.search);
      document.title = 'Connekt - Plataforma de Cursos de Medicina';
      lastStableUrlRef.current = `${window.location.pathname}${window.location.search}`;
    };

    // Initial load
    handleLocationChange();

    // Listen for navigation changes
    window.addEventListener('popstate', handleLocationChange);
    
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  useEffect(() => {
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    const guard = (original) => function guardedHistoryState() {
      if (isUploadInProgress()) {
        toast({ description: 'Upload em andamento. Aguarde concluir para sair desta página.', variant: 'destructive' });
        return;
      }
      return original.apply(window.history, arguments);
    };

    window.history.pushState = guard(originalPushState);
    window.history.replaceState = guard(originalReplaceState);

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
    switch (currentView) {
      case 'admin':
        const AdminPage = React.lazy(() => import('@/pages/AdminPage'));
        return (
          <Suspense fallback={<div>Loading Admin...</div>}>
            <AdminPage />
          </Suspense>
        );
      case 'questionBank':
        return <QuestionBankPage />;
      case 'questoes':
        // Remonta a página quando search (ex.: ?bankId=...) muda
        return <QuestoesPage key={locationKey} />;
      case 'cursos':
        return <CursosPage />;
      case 'alunos':
        return <AlunosPage />;
      case 'simulados':
        return <SimuladosPage />;
      case 'simuladosAcesso':
        return <SimuladoAcessoPage />;
      case 'dimulados':
        return <DimuladosPage />;
      case 'simuladosNovo':
        return <SimuladosNovo />;
      case 'produtosNovo':
        return <ProdutosNovo />;
      case 'cursoPreviewAluno':
        return <CursoPreviewAlunoPage />;
      case 'simuladosAproveitamento':
        return <SimuladosAproveitamentoPage />;
      case 'vendas':
        return <VendasPage />;
      case 'dashboard':
        return <DashboardPage />;
      case 'login':
        return <LoginPage />;
      case 'loginAluno':
        return <LoginAlunoPage />;
      case 'alunoDashboard':
        return <AlunoDashboardPage />;
      case 'alunoAula':
        return <AlunoAulaPage />;
      case 'alunoCurso':
        return <AlunoCursoPage />;
      case 'alunoSimuladoAcesso':
        return <AlunoSimuladoAcessoPage />;
      case 'alunoSimulados':
        return <AlunoSimuladosPage />;
      case 'alunoConfiguracoes':
        return <AlunoConfiguracoesPage />;
      case 'verifyEmail':
        return <EmailVerificationPage />;
      case 'resetPassword':
        return <ResetPasswordPage />;
      case 'termos':
        return <TermosPrivacidadePage />;
      case 'vimeoCallback':
        const VimeoCallback = React.lazy(() => import('@/pages/VimeoCallback'));
        return (
          <Suspense fallback={<div>Conectando com Vimeo...</div>}>
            <VimeoCallback />
          </Suspense>
        );
      case 'hero':
        return <HeroPage />;
      case 'repostaCorretaSimulado':
        return <RepostaCorretaSimuladoPage />;
      case 'alunoRepostaCorretaSimulado':
        return <RepostaCorretaSimuladoPage />;
      case 'planos':
        const PlanosPage = React.lazy(() => import('@/pages/PlanosPage'));
        return (
          <Suspense fallback={<div>Loading Planos...</div>}>
            <PlanosPage />
          </Suspense>
        );
      case 'planosCallback':
        const PlanosCallback = React.lazy(() => import('@/pages/PlanosCallback'));
        return (
          <Suspense fallback={<div>Processando plano...</div>}>
            <PlanosCallback />
          </Suspense>
        );
      case 'categorias':
        return <CategoriasPage />;
      case 'configuracoes':
        return <ConfiguracoesPage />;
      case 'testMyGateway':
        const TestMyGateway = React.lazy(() => import('@/pages/TestMyGateway'));
        return (
          <Suspense fallback={<div>Carregando teste...</div>}>
            <TestMyGateway />
          </Suspense>
        );
      case 'inbox':
      default:
        return <InboxPage />;
    }
  };

  const isPublicView = useMemo(() => currentView === 'login' || currentView === 'loginAluno' || currentView === 'verifyEmail' || currentView === 'resetPassword' || currentView === 'termos', [currentView]);
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

  useEffect(() => {
    if (loading) return;
    if (user) return;
    if (isPublicView) return;
    const isAlunoPath = window.location.pathname === '/aluno' || window.location.pathname.startsWith('/aluno/')
    if ((isAlunoPath || currentView === 'cursoPreviewAluno') && isDemoStudent) return
    const target = isAlunoPath ? '/login-aluno' : '/login'
    if (window.location.pathname !== target) {
      window.history.replaceState({}, '', target);
      window.dispatchEvent(new PopStateEvent('popstate'));
    } else {
      setCurrentView(isAlunoPath ? 'loginAluno' : 'login');
    }
  }, [user, loading, isPublicView, isDemoStudent, currentView]);

  if (loading) {
    return null;
  }

  if (!user && !isPublicView && !(isDemoStudent && (currentView === 'alunoDashboard' || currentView === 'alunoAula' || currentView === 'alunoCurso' || currentView === 'alunoSimulados' || currentView === 'alunoSimuladoAcesso' || currentView === 'alunoConfiguracoes' || currentView === 'alunoRepostaCorretaSimulado' || currentView === 'cursoPreviewAluno'))) {
    return <LoginPage />;
  }

  if (user && deviceLock) {
    return <DeviceLockPage />
  }

  return (
    <TaxonomyProvider>
      {(currentView === 'login' || currentView === 'loginAluno' || currentView === 'verifyEmail') ? (
        currentView === 'login'
          ? <LoginPage />
          : currentView === 'loginAluno'
            ? <LoginAlunoPage />
            : <EmailVerificationPage />
      ) : currentView === 'resetPassword' ? (
        <ResetPasswordPage />
      ) : currentView === 'termos' ? (
        <TermosPrivacidadePage />
      ) : (currentView === 'produtosNovo' || currentView === 'cursoPreviewAluno' || currentView === 'questoes' || currentView === 'alunoDashboard' || currentView === 'alunoAula' || currentView === 'alunoCurso' || currentView === 'alunoSimulados' || currentView === 'alunoSimuladoAcesso' || currentView === 'alunoConfiguracoes' || currentView === 'alunoRepostaCorretaSimulado') ? (
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


