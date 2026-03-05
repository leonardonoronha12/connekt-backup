import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Mail, 
  BookOpen, 
  Users, 
  FileText, 
  Database, 
  ShoppingCart, 
  Settings,
  Tag,
  ChevronUp
} from 'lucide-react';
import { planService } from '@/services/planService.js';

const SystemSidebar = () => {
  const [isUpgradeHovered, setIsUpgradeHovered] = useState(false);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [currentSearch, setCurrentSearch] = useState(window.location.search);
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

    window.addEventListener('popstate', handleLocationChange);
    const updatePlan = () => setHasActivePlan(computeHasActivePlan());
    const onStorage = (e) => {
      if (e?.key === 'connekt_subscription' || e?.key === 'connekt_active_plan') updatePlan();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', updatePlan);
    updatePlan();

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', updatePlan);
    };
  }, []);

  const handleNavigation = (path) => {
    window.history.pushState({}, '', path);
    setCurrentPath(window.location.pathname);
    setCurrentSearch(window.location.search);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const menuItems = [
    {
      section: 'MENU',
      items: [
        { 
          id: 'dashboard', 
          label: 'Dashboard', 
          icon: LayoutDashboard, 
          path: '/dashboard',
          isActive: (currentPath === '/dashboard' || currentPath === '/') && !currentSearch.includes('dev-admin')
        },
        { 
          id: 'inbox', 
          label: 'Inbox', 
          icon: Mail, 
          path: '/inbox',
          isActive: currentPath === '/inbox' && !currentSearch.includes('dev-admin')
        }
      ]
    },
    {
      section: 'WORKSPACE',
      items: [
        { 
          id: 'cursos', 
          label: 'Meus Cursos', 
          icon: BookOpen, 
          path: '/cursos',
          isActive: currentPath === '/cursos'
        },
        { 
          id: 'alunos', 
          label: 'Alunos', 
          icon: Users, 
          path: '/alunos',
          isActive: currentPath === '/alunos'
        },
        { 
          id: 'simulados', 
          label: 'Simulados', 
          icon: FileText, 
          path: '/simulados',
          isActive: currentPath === '/simulados'
        },
        { 
          id: 'banco-questoes', 
          label: 'Banco de Questões', 
          icon: Database, 
          path: '/banco-de-questoes',
          isActive: currentPath === '/banco-de-questoes'
        }
      ]
    },
    {
      section: 'GERAL',
      items: [
        { 
          id: 'categorias', 
          label: 'Categorias', 
          icon: Tag, 
          path: '/categorias',
          isActive: currentPath === '/categorias'
        },
        { 
          id: 'vendas', 
          label: 'Vendas', 
          icon: ShoppingCart, 
          path: '/vendas',
          isActive: currentPath === '/vendas'
        },
        { 
          id: 'configuracoes', 
          label: 'Configurações', 
          icon: Settings, 
          path: '/configuracoes',
          isActive: currentPath === '/configuracoes' && !currentSearch.includes('tab=plano')
        }
      ]
    }
  ];

  const handleMenuNavigation = (path) => {
    window.history.pushState({}, '', path);
    setCurrentPath(window.location.pathname);
    setCurrentSearch(window.location.search);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <aside className="w-64 bg-gradient-to-b from-[#1a1b3a] to-[#2d2e5f] text-white flex flex-col h-screen">
      {/* Logo */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
            <span className="text-[#1a1b3a] font-bold text-lg">C</span>
          </div>
          <span className="text-xl font-bold text-white">connekt</span>
        </div>
      </div>

      {/* Menu Items */}
      <nav className="flex-1 px-4 py-6 space-y-8 overflow-y-auto">
        {menuItems.map((section) => (
          <div key={section.section}>
            <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-4 px-2">
              {section.section}
            </h3>
            <ul className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => handleMenuNavigation(item.path)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                        item.isActive
                          ? 'bg-[#0047BB] text-white shadow-lg'
                          : 'text-white/80 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {!hasActivePlan && (
        <div className="p-4 border-t border-white/10">
          <div className="bg-white/5 rounded-lg p-4 text-center">
            <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <ChevronUp className="w-6 h-6 text-white" />
            </div>
            <p className="text-sm text-white/80 mb-3 leading-relaxed">
              Faça um upgrade do seu plano para aproveitar ao máximo da Connekt
            </p>
            <button
              onMouseEnter={() => setIsUpgradeHovered(true)}
              onMouseLeave={() => setIsUpgradeHovered(false)}
              onClick={() => handleMenuNavigation('/configuracoes?tab=plano')}
              className={`w-full py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                isUpgradeHovered
                  ? 'bg-white text-[#1a1b3a] shadow-lg transform scale-105'
                  : 'bg-white/90 text-[#1a1b3a] hover:bg-white'
              }`}
            >
              Upgrade de plano
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};

export default SystemSidebar;
