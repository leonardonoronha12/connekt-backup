import React, { useState, useEffect } from 'react';
import CollapsibleSidebar from './CollapsibleSidebar';
import Header from './Header';
import PlanExpiredBanner from '@/components/PlanExpiredBanner.jsx'

const MainLayout = ({ children }) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    const saved = localStorage.getItem('sidebarOpen');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    const handleStorageChange = () => {
      const saved = localStorage.getItem('sidebarOpen');
      setSidebarExpanded(saved !== null ? JSON.parse(saved) : true);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('storage', handleStorageChange);
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handleLocationChange);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  const isAproveitamento = currentPath === '/simulados-aproveitamento';
  const isSimuladoResposta = currentPath === '/reposta-correta-simulado';
  const isSimuladosNovo = currentPath === '/simulados/novo' || currentPath === '/produtos/novo';
  const isFullWidthPage = currentPath === '/dashboard' || currentPath === '/banco-de-questoes' || currentPath === '/vendas';
  const isAlunoPath = String(currentPath || '').startsWith('/aluno')

  return (
    <div className="flex bg-[#F5F6FA]" style={{ height: '100dvh', minHeight: '100vh' }}>
      {/* Sidebar - largura fixa, não rola */}
      {!isSimuladoResposta && !isSimuladosNovo && <CollapsibleSidebar />}
      
      {/* Container principal - flex column */}
      <div className="flex-1 flex flex-col" style={{ height: '100%' }}>
        {/* Header - altura fixa, não rola */}
        {!isSimuladosNovo && <Header className="flex-shrink-0" />}
        {!isSimuladosNovo && !isAlunoPath ? <PlanExpiredBanner /> : null}
        
        {/* Main content - área rolável */}
        {isSimuladosNovo ? (
          // Renderiza a página diretamente (header interno fica fora do main)
          <>{children}</>
        ) : (
          <main 
            className={`flex-1 scroll-area ${isMobile ? 'main-content-mobile' : ''}`}
            style={{ 
              // Main como área rolável geral
              minHeight: 0,
              overflow: 'auto',
              backgroundColor: isAproveitamento ? '#FFFFFF' : undefined
            }}
          >
            <div className="w-full flex justify-center">
              <div 
                style={{ 
                  // Dimensões solicitadas para o div interno
                  width: '100%',
                  maxWidth: isFullWidthPage ? '100%' : '1180px',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: isFullWidthPage ? '0' : '22px',
                  paddingTop: isFullWidthPage ? '0' : '32px',
                  paddingRight: isFullWidthPage ? '0' : (isMobile ? '20px' : '52px'),
                  paddingLeft: isFullWidthPage ? '0' : (isMobile ? '20px' : '52px'),
                  opacity: 1,
                  boxSizing: 'border-box',
                  margin: '0 auto'
                }}
              >
                {children}
              </div>
            </div>
          </main>
        )}
      </div>
    </div>
  );
};

export default MainLayout;
