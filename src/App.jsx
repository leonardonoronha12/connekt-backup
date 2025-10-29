import React, { useState, useEffect, Suspense } from 'react';
import { Toaster } from '@/components/ui/toaster';
import MainLayout from '@/components/MainLayout';
import InboxPage from '@/pages/InboxPage';
import QuestionBankPage from '@/pages/QuestionBankPage';
import CursosPage from '@/pages/CursosPage';
import AlunosPage from '@/pages/AlunosPage';
import SimuladosPage from '@/pages/SimuladosPage';
import VendasPage from '@/pages/VendasPage';

const ADMIN_VIEW_PARAM = 'dev-admin';
const QUESTION_BANK_PATH = '/banco-de-questoes';

function App() {
  const [currentView, setCurrentView] = useState('inbox');

  useEffect(() => {
    const handleLocationChange = () => {
      const searchParams = new URLSearchParams(window.location.search);
      const path = window.location.pathname;

      if (searchParams.get('view') === ADMIN_VIEW_PARAM) {
        setCurrentView('admin');
      } else if (path === QUESTION_BANK_PATH) {
        setCurrentView('questionBank');
      } else if (path === '/cursos') {
        setCurrentView('cursos');
      } else if (path === '/alunos') {
        setCurrentView('alunos');
      } else if (path === '/simulados') {
        setCurrentView('simulados');
      } else if (path === '/vendas') {
        setCurrentView('vendas');
      } else {
        setCurrentView('inbox');
      }
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
      case 'cursos':
        return <CursosPage />;
      case 'alunos':
        return <AlunosPage />;
      case 'simulados':
        return <SimuladosPage />;
      case 'vendas':
        return <VendasPage />;
      case 'inbox':
      default:
        return <InboxPage />;
    }
  };

  return (
    <MainLayout>
      {renderContent()}
      <Toaster />
    </MainLayout>
  );
}

export default App;