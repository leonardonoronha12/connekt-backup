import React, { useState, useEffect } from 'react';
import CollapsibleSidebar from './CollapsibleSidebar';
import Header from './Header';

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

  return (
    <div className="flex bg-gray-50" style={{ height: '100dvh', minHeight: '100vh' }}>
      {/* Sidebar - largura fixa, não rola */}
      <CollapsibleSidebar />
      
      {/* Container principal - flex column */}
      <div className="flex-1 flex flex-col" style={{ height: '100%' }}>
        {/* Header - altura fixa, não rola */}
        <Header className="flex-shrink-0" />
        
        {/* Main content - área rolável */}
        <main 
          className={`flex-1 scroll-area ${isMobile ? 'main-content-mobile' : ''}`}
          style={{ minHeight: 0, overflow: 'auto', backgroundColor: isAproveitamento ? '#FFFFFF' : undefined }}
        >
          <div className="w-full flex justify-center">
            <div className="w-full" style={{ maxWidth: '1348px', maxHeight: '900px' }}>
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
