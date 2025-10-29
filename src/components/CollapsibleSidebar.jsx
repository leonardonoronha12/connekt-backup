import React, { useState, useEffect } from 'react';

const CollapsibleSidebar = () => {
  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = localStorage.getItem('sidebarOpen');
    return saved !== null ? JSON.parse(saved) : true;
  });
  
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };

    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const toggleSidebar = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    localStorage.setItem('sidebarOpen', JSON.stringify(newState));
    
    // Emitir evento personalizado para comunicação
    if (newState) {
      window.dispatchEvent(new CustomEvent('sidebar:expand'));
    } else {
      window.dispatchEvent(new CustomEvent('sidebar:collapse'));
    }
  };

  const handleNavigation = (path) => {
    window.history.pushState({}, '', path);
    setCurrentPath(window.location.pathname);
    window.dispatchEvent(new PopStateEvent('popstate'));
    
    // Fechar sidebar em mobile após navegação
    if (isMobile) {
      setIsExpanded(false);
    }
  };

  const menuItems = [
    {
      section: 'MENU',
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          icon: '/icons/dashboard.svg',
          path: '/dashboard',
          isActive: currentPath === '/dashboard' || currentPath === '/'
        },
        {
          id: 'inbox',
          label: 'Inbox',
          icon: '/icons/inbox.svg',
          path: '/inbox',
          isActive: currentPath === '/inbox'
        }
      ]
    },
    {
      section: 'WORKSPACE',
      items: [
        {
          id: 'produtos',
          label: 'Produtos',
          icon: '/icons/book-open.svg',
          path: '/produtos',
          isActive: currentPath === '/produtos'
        },
        {
          id: 'alunos',
          label: 'Alunos',
          icon: '/icons/alunos.svg',
          path: '/alunos',
          isActive: currentPath === '/alunos'
        },
        {
          id: 'kplay',
          label: 'KPlay',
          icon: '/icons/union.svg',
          path: '/kplay',
          isActive: currentPath === '/kplay'
        },
        {
          id: 'khub',
          label: 'KHub',
          icon: '/icons/book-open.svg',
          path: '/khub',
          isActive: currentPath === '/khub'
        },
        {
          id: 'simulados',
          label: 'Simulados',
          icon: '/icons/union.svg',
          path: '/simulados',
          isActive: currentPath === '/simulados'
        },
        {
          id: 'banco-questoes',
          label: 'Banco de Questões',
          icon: '/icons/circle-stack.svg',
          path: '/banco-de-questoes',
          isActive: currentPath === '/banco-de-questoes'
        }
      ]
    },
    {
      section: 'GERAL',
      items: [
        {
          id: 'vendas',
          label: 'Vendas',
          icon: '/icons/vendas.svg',
          path: '/vendas',
          isActive: currentPath === '/vendas'
        },
        {
          id: 'configuracoes',
          label: 'Configurações',
          icon: '/icons/cog-6-tooth.svg',
          path: '/configuracoes',
          isActive: currentPath === '/configuracoes' || window.location.search.includes('dev-admin')
        }
      ]
    }
  ];

  const sidebarWidth = isExpanded ? '260px' : '92px';

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobile && isExpanded && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsExpanded(false)}
        />
      )}
      
      {/* Sidebar */}
      <aside 
        className={`h-full z-50 transition-all duration-200 ease-in-out flex flex-col ${
          isMobile ? 'fixed left-0 top-0 shadow-2xl h-screen' : ''
        }`}
        style={{
          width: sidebarWidth,
          background: 'linear-gradient(180deg, rgb(15, 6, 39) 0%, rgb(0, 0, 104) 100%)'
        }}
      >
        {/* Header com Logo e Toggle */}
        <div className="flex flex-col">
          {/* Logo */}
          <div className="flex justify-center py-4">
            <img 
              src={isExpanded ? "/logo-expanded.svg" : "/logo-collapsed.svg"}
              alt="Logo"
              className={isExpanded ? "w-[119px] h-[35px]" : "w-[40px] h-[51px]"}
            />
          </div>
          
          {/* Separador e Toggle */}
          <div className="relative">
            <div 
              className="h-px"
              style={{ 
                backgroundColor: 'rgb(47, 58, 86)',
                width: isExpanded ? 'calc(100% - 80px)' : 'calc(100% - 42px)',
                marginLeft: isExpanded ? '40px' : '21px',
                marginRight: isExpanded ? '40px' : '21px'
              }}
            />
            <button
              onClick={toggleSidebar}
              className="absolute right-[22px] top-[-12px] w-6 h-6 rounded flex items-center justify-center cursor-pointer transition-all duration-200 hover:opacity-80"
              style={{ backgroundColor: 'rgb(0, 71, 187)', marginRight: '-35px' }}
              aria-label={isExpanded ? 'Recolher sidebar' : 'Expandir sidebar'}
            >
              <img 
                src={isExpanded 
                  ? "https://f1925bd3031c7289927c33dbfff0ab8f.cdn.bubble.io/f1758650714011x222569527988370800/Voltar%202.svg"
                  : "https://f1925bd3031c7289927c33dbfff0ab8f.cdn.bubble.io/f1758651082346x622943058494926960/Avan%C3%A7ar%202.svg"
                }
                alt="Toggle"
                className="w-3 h-3 transition-transform duration-200"
              />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto scrollbar-hide" style={{ paddingTop: '24px', paddingBottom: '20px' }}>
          {menuItems.map((section, sectionIndex) => (
            <div key={section.section} className={sectionIndex > 0 ? 'mt-6' : ''}>
              {/* Section Divider (apenas para WORKSPACE e GERAL no modo minimizado) */}
              {!isExpanded && sectionIndex > 0 && (
                <div 
                  className="h-px mb-4"
                  style={{ 
                    backgroundColor: 'rgb(47, 58, 86)',
                    width: isExpanded ? 'calc(100% - 80px)' : 'calc(100% - 42px)',
                    marginLeft: isExpanded ? '40px' : '21px',
                    marginRight: isExpanded ? '40px' : '21px'
                  }}
                />
              )}
              
              {/* Section Title (apenas no modo expandido) */}
              {isExpanded && (
                <h3 
                  className="text-[11px] font-medium mb-3 tracking-wide uppercase"
                  style={{ 
                    color: 'rgb(227, 228, 229)',
                    paddingLeft: '56px',
                    paddingRight: '22px',
                    opacity: '0.7'
                  }}
                >
                  {section.section}
                </h3>
              )}
              
              {/* Section Items */}
              <ul className="space-y-1">
                {section.items.map((item) => (
                  <li key={item.id}>
                    <button
                      onClick={() => handleNavigation(item.path)}
                      className={`w-full h-11 flex items-center transition-all duration-200 ${
                        item.isActive 
                          ? 'text-white' 
                          : 'text-white hover:bg-white hover:bg-opacity-10'
                      } ${!isExpanded ? 'justify-center' : 'gap-3'}`}
                      style={{
                        backgroundColor: item.isActive ? 'rgb(0, 71, 187)' : 'transparent',
                        paddingLeft: isExpanded ? '22px' : '0',
                        paddingRight: isExpanded ? '22px' : '0',
                        borderRadius: '4px',
                        marginLeft: isExpanded ? '34px' : '22px',
                        marginRight: isExpanded ? '34px' : '22px',
                        width: isExpanded ? 'calc(100% - 68px)' : 'calc(100% - 44px)'
                      }}
                      aria-label={item.label}
                      aria-current={item.isActive ? 'page' : undefined}
                      title={!isExpanded ? item.label : undefined}
                    >
                      <img 
                        src={item.icon}
                        alt={item.label}
                        className="w-5 h-5 flex-shrink-0"
                        style={{ objectFit: 'contain' }}
                      />
                      {isExpanded && (
                        <span 
                          className="text-[14px] font-medium whitespace-nowrap"
                          style={{ color: 'rgb(227, 228, 229)' }}
                        >
                          {item.label}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
              
              {/* Upgrade Card - aparece apenas após a seção GERAL */}
              {section.section === 'GERAL' && isExpanded && (
                <div className="px-4" style={{ marginTop: '35px' }}>
                  <div className="relative rounded p-4 text-center" style={{ background: 'none', border: '1px solid #0047bb', borderRadius: '4px' }}>
                    {/* Badge */}
                    <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center mx-auto mb-3" style={{ marginTop: '-35px' }}>
                      <img 
                        src="https://f1925bd3031c7289927c33dbfff0ab8f.cdn.bubble.io/f1758655390835x205986542220121920/Union.svg"
                        alt="Upgrade"
                        className="w-[14px] h-[14px]"
                      />
                    </div>
                    
                    {/* Text */}
                    <p className="text-xs font-normal leading-relaxed text-white/90 mb-4 px-2">
                      Faça um upgrade do seu plano para aproveitar o máximo da Connect
                    </p>
                    
                    {/* Button */}
                    <button className="w-full h-9 bg-white rounded text-sm font-medium transition-all duration-200 hover:opacity-90 text-blue-600">
                      Upgrade de plano
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
};

export default CollapsibleSidebar;