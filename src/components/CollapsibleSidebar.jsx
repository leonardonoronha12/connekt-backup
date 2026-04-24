import React, { useState, useEffect } from 'react';
import { CreditCard, ChevronLeft, ChevronRight, Menu } from 'lucide-react';
import { planService } from '@/services/planService.js';

const CollapsibleSidebar = () => {
  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = localStorage.getItem('sidebarOpen');
    return saved !== null ? JSON.parse(saved) : true;
  });
  
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [currentSearch, setCurrentSearch] = useState(window.location.search);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [hasActivePlan, setHasActivePlan] = useState(false);

  const computeHasActivePlan = () => {
    try {
      const sub = typeof planService.getSubscription === 'function' ? planService.getSubscription() : null;
      const status = String(sub?.status || '').toLowerCase();
      const planKey = String(sub?.planKey || '').toLowerCase();
      const expiresAt = sub?.expiresAt ? new Date(sub.expiresAt).getTime() : 0;
      if (planKey) {
        if (expiresAt && isFinite(expiresAt)) return expiresAt > Date.now();
        return status === 'active' || status === 'trial' || status === 'canceled';
      }
      const legacy = typeof planService.getActivePlan === 'function' ? planService.getActivePlan() : null
      return !!legacy
    } catch (_) {
      return false;
    }
  };

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
      setCurrentSearch(window.location.search);
    };

    const handleResize = () => {
      const nextMobile = window.innerWidth < 768
      setIsMobile(nextMobile)
      if (nextMobile) {
        setIsExpanded(false)
      } else {
        try {
          const saved = localStorage.getItem('sidebarOpen')
          setIsExpanded(saved !== null ? JSON.parse(saved) : true)
        } catch (_) {
          setIsExpanded(true)
        }
      }
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('resize', handleResize);
    const updatePlan = () => setHasActivePlan(computeHasActivePlan());
    const onStorage = (e) => {
      if (e?.key === 'connekt_subscription' || e?.key === 'connekt_active_plan') updatePlan();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', updatePlan);
    updatePlan();
    
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', updatePlan);
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
    setCurrentSearch(window.location.search);
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
          id: 'cursos',
          label: 'Cursos',
          icon: '/icons/book-open.svg',
          path: '/cursos',
          isActive: currentPath === '/cursos' || currentPath === '/produtos'
        },
        {
          id: 'alunos',
          label: 'Gerenciar alunos',
          icon: '/icons/alunos.svg?v=2',
          path: '/alunos',
          isActive: currentPath === '/alunos' || currentPath.startsWith('/alunos/')
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
          isActive: currentPath === '/configuracoes' && !currentSearch.includes('tab=plano')
        }
      ]
    }
  ];

  // Ocultar temporariamente algumas abas
  const hiddenLabels = new Set(['KPlay', 'KHub']);

  const sidebarWidth = isMobile ? (isExpanded ? '260px' : '0px') : (isExpanded ? '260px' : '92px');

  return (
    <>
      {isMobile && !isExpanded && (
        <button
          type="button"
          aria-label="Abrir menu"
          onClick={() => setIsExpanded(true)}
          className="fixed left-3 top-3 z-50 w-10 h-10 rounded-[10px] flex items-center justify-center shadow-lg"
          style={{ backgroundColor: 'rgb(0, 71, 187)' }}
        >
          <Menu className="w-5 h-5 text-white" />
        </button>
      )}
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
          background: 'linear-gradient(180deg, rgb(15, 6, 39) 0%, rgb(0, 0, 104) 100%)',
          overflow: isMobile && !isExpanded ? 'hidden' : undefined,
          pointerEvents: isMobile && !isExpanded ? 'none' : undefined
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
              {isExpanded ? (
                <ChevronLeft className="w-3 h-3 text-white" />
              ) : (
                <ChevronRight className="w-3 h-3 text-white" />
              )}
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
                {section.items.filter(item => !hiddenLabels.has(item.label)).map((item) => (
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
                      {item.id === 'planos' ? (
                        <CreditCard size={20} color="#E3E4E5" strokeWidth={1.5} />
                      ) : item.id === 'simulados' ? (
                        // SVG do ícone de Simulados (inline)
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="20"
                          height="20"
                          viewBox="0 0 20 20"
                          fill="none"
                          className="w-5 h-5 flex-shrink-0"
                          style={{ objectFit: 'contain' }}
                          aria-hidden="true"
                        >
                          <path d="M4 5H16V12H4V5Z" fill="#E3E4E5" />
                          <path
                            fillRule="evenodd"
                            clipRule="evenodd"
                            d="M1 3.5C1 2.67157 1.67157 2 2.5 2H17.5C18.3284 2 19 2.67157 19 3.5V13.5C19 14.3284 18.3284 15 17.5 15H12V16.5H15.25C15.6642 16.5 16 16.8358 16 17.25C16 17.6642 15.6642 18 15.25 18H4.75C4.33579 18 4 17.6642 4 17.25C4 16.8358 4.33579 16.5 4.75 16.5H8V15H2.5C1.67157 15 1 14.3284 1 13.5V3.5ZM17.5 3.5L2.5 3.5V13.5H17.5V3.5Z"
                            fill="#E3E4E5"
                          />
                        </svg>
                      ) : item.icon && item.icon.endsWith('/union.svg') ? (
                        // SVG inline para itens que usam union.svg
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="20"
                          height="20"
                          viewBox="0 0 20 20"
                          fill="none"
                          className="w-5 h-5 flex-shrink-0"
                          style={{ objectFit: 'contain' }}
                          aria-hidden="true"
                        >
                          <path
                            d="M6.29995 2.839C5.3011 2.20928 4 2.9271 4 4.10788V15.889C4 17.0698 5.3011 17.7876 6.29995 17.1579L15.6436 11.2673C16.577 10.6789 16.577 9.31801 15.6436 8.72957L6.29995 2.839Z"
                            fill="#E3E4E5"
                          />
                        </svg>
                      ) : (
                        <img
                          src={item.icon}
                          alt={item.label}
                          className="w-5 h-5 flex-shrink-0"
                          style={{ objectFit: 'contain' }}
                        />
                      )}
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
              {section.section === 'GERAL' && isExpanded && !hasActivePlan && (
                <div className="px-4" style={{ marginTop: '35px' }}>
                  <div className="relative rounded p-4 text-center" style={{ background: 'none', border: '1px solid #0047bb', borderRadius: '4px' }}>
                    {/* Badge */}
                    <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center mx-auto mb-3" style={{ marginTop: '-35px' }}>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        className="w-[16px] h-[16px]"
                        aria-hidden="true"
                      >
                        <g clipPath="url(#clip0_853_1869)">
                          <path fillRule="evenodd" clipRule="evenodd" d="M8.00005 0.800781C6.53729 0.800781 5.10188 0.919804 3.70311 1.14881C3.41302 1.19631 3.20005 1.44697 3.20005 1.74093V2.05016C2.53876 2.17562 1.88644 2.32652 1.24416 2.5018C0.990618 2.571 0.811615 2.79715 0.802493 3.05981C0.800867 3.10663 0.800049 3.15362 0.800049 3.20078C0.800049 5.27666 2.38121 6.98305 4.40514 7.18151C5.02063 7.87666 5.83556 8.39263 6.7613 8.63927C6.68436 9.26834 6.49518 9.86221 6.21442 10.4008H6.00005C5.33731 10.4008 4.80005 10.938 4.80005 11.6008V13.6008H4.20005C3.64776 13.6008 3.20005 14.0485 3.20005 14.6008C3.20005 14.9322 3.46868 15.2008 3.80005 15.2008H12.2C12.5314 15.2008 12.8 14.9322 12.8 14.6008C12.8 14.0485 12.3523 13.6008 11.8 13.6008H11.2V11.6008C11.2 10.938 10.6628 10.4008 10 10.4008H9.78567C9.50491 9.86221 9.31573 9.26834 9.2388 8.63928C10.1645 8.39263 10.9795 7.87666 11.595 7.18151C13.6189 6.98305 15.2 5.27666 15.2 3.20078C15.2 3.15361 15.1992 3.10661 15.1976 3.05981C15.1885 2.79715 15.0095 2.571 14.7559 2.5018C14.1137 2.32652 13.4613 2.17562 12.8 2.05016V1.74093C12.8 1.44697 12.5871 1.19631 12.297 1.14881C10.8982 0.919804 9.46281 0.800781 8.00005 0.800781ZM2.02024 3.53873C2.40986 3.44059 2.80321 3.35181 3.20005 3.27265V4.00078C3.20005 4.59237 3.30728 5.15938 3.5033 5.68309C2.70459 5.26495 2.13259 4.47252 2.02024 3.53873ZM13.9799 3.53873C13.8675 4.47252 13.2955 5.26495 12.4968 5.68309C12.6928 5.15938 12.8 4.59237 12.8 4.00078V3.27265C13.1969 3.35181 13.5902 3.44059 13.9799 3.53873Z" fill="#0047BB" />
                        </g>
                        <defs>
                          <clipPath id="clip0_853_1869">
                            <rect width="16" height="16" fill="white" />
                          </clipPath>
                        </defs>
                      </svg>
                    </div>
                    
                    {/* Text */}
                    <p className="text-xs font-normal leading-relaxed text-white/90 mb-4 px-2">
                      Faça um upgrade do seu plano para aproveitar o máximo da Connect
                    </p>
                    
                    {/* Button */}
                    <button className="w-full h-9 bg-white rounded text-sm font-medium transition-all duration-200 hover:opacity-90 text-blue-600" onClick={() => handleNavigation('/planos')}>
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
