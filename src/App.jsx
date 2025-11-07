import React, { useState, useEffect, Suspense } from 'react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { AuthProvider } from '@/contexts/SupabaseAuthContext';
import MainLayout from '@/components/MainLayout';
import InboxPage from '@/pages/InboxPage';
import QuestionBankPage from '@/pages/QuestionBankPage';
import CursosPage from '@/pages/CursosPage';
import AlunosPage from '@/pages/AlunosPage';
import SimuladosPage from '@/pages/SimuladosPage';
import SimuladosAproveitamentoPage from '@/pages/SimuladosAproveitamentoPage';
import VendasPage from '@/pages/VendasPage';
import DashboardPage from '@/pages/DashboardPage';
import LoginPage from '@/pages/LoginPage';
import HeroPage from '@/pages/HeroPage';
import EmailVerificationPage from '@/pages/EmailVerificationPage';
import QuestoesPage from '@/pages/QuestoesPage';

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
  simuladosAproveitamento: 'Simulados - Aproveitamento',
  vendas: 'Vendas',
  dashboard: 'Dashboard',
  login: 'Login',
  verifyEmail: 'Verificação de Email',
  hero: 'Hero',
  inbox: 'Inbox',
};

// Deriva a view inicial com base na URL para evitar montar o layout global
// desnecessariamente e prevenir logs de requisições abortadas ao trocar de rota.
const getViewFromLocation = () => {
  const searchParams = new URLSearchParams(window.location.search);
  const path = window.location.pathname;

  if (searchParams.get('view') === ADMIN_VIEW_PARAM) {
    return 'admin';
  } else if (path === QUESTION_BANK_PATH) {
    return 'questionBank';
  } else if (path === '/questoes') {
    return 'questoes';
  } else if (path === '/cursos') {
    return 'cursos';
  } else if (path === '/alunos') {
    return 'alunos';
  } else if (path === '/simulados') {
    return 'simulados';
  } else if (path === '/simulados-aproveitamento') {
    return 'simuladosAproveitamento';
  } else if (path === '/vendas') {
    return 'vendas';
  } else if (path === '/dashboard') {
    return 'dashboard';
  } else if (path === '/login') {
    return 'login';
  } else if (path === '/verify-email') {
    return 'verifyEmail';
  } else if (path === '/hero') {
    return 'hero';
  }
  return 'inbox';
};

function App() {
  const [currentView, setCurrentView] = useState(getViewFromLocation());
  // Chave de localização para forçar remontagem em mudanças de query (ex.: bankId)
  const [locationKey, setLocationKey] = useState(() => window.location.search);

  useEffect(() => {
    const handleLocationChange = () => {
      const nextView = getViewFromLocation();
      setCurrentView(nextView);
      // Atualiza chave quando a query muda sem alterar o path
      setLocationKey(window.location.search);
      // Atualiza título da página com base na view atual
      const pageName = PAGE_TITLES[nextView] || 'Página';
      document.title = `Connekt - ${pageName}`;
    };

    // Initial load
    handleLocationChange();

    // Listen for navigation changes
    window.addEventListener('popstate', handleLocationChange);
    
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
    };
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
      case 'simuladosAproveitamento':
        return <SimuladosAproveitamentoPage />;
      case 'vendas':
        return <VendasPage />;
      case 'dashboard':
        return <DashboardPage />;
      case 'login':
        return <LoginPage />;
      case 'verifyEmail':
        return <EmailVerificationPage />;
      case 'hero':
        return <HeroPage />;
      case 'inbox':
      default:
        return <InboxPage />;
    }
  };

  return (
    <AuthProvider>
      {(currentView === 'login' || currentView === 'verifyEmail' || currentView === 'questoes') ? (
        currentView === 'login'
          ? <LoginPage />
          : currentView === 'verifyEmail'
            ? <EmailVerificationPage />
            : <QuestoesPage key={locationKey} />
      ) : (
        <MainLayout>
          {renderContent()}
        </MainLayout>
      )}
      {import.meta.env.PROD && <SpeedInsights />}
    </AuthProvider>
  );
}

export default App;