import React, { useState, useEffect, Suspense } from 'react';
import { Toaster } from '@/components/ui/toaster';
import InboxPage from '@/pages/InboxPage';
import QuestionBankPage from '@/pages/QuestionBankPage';

const ADMIN_VIEW_PARAM = 'dev-admin';
const QUESTION_BANK_PATH = '/banco-de-questoes';

function App() {
  const [currentView, setCurrentView] = useState('inbox');

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const path = window.location.pathname;

    if (searchParams.get('view') === ADMIN_VIEW_PARAM) {
      setCurrentView('admin');
    } else if (path === QUESTION_BANK_PATH) {
      setCurrentView('questionBank');
    } else {
      setCurrentView('inbox');
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
      case 'inbox':
      default:
        return <InboxPage />;
    }
  };

  return (
    <>
      {renderContent()}
      <Toaster />
    </>
  );
}

export default App;