import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Mail, ListFilter } from 'lucide-react';
import { cn } from '@/lib/utils';

const MainSidebar = () => {
  const location = useLocation();

  const navItems = [
    { to: '/', icon: Mail, label: 'Inbox' },
    { to: '/banco-de-questoes', icon: ListFilter, label: 'Banco de Questões' },
  ];

  return (
    <aside className="w-20 bg-white border-r border-gray-200 flex flex-col items-center py-6 space-y-8">
      <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
        <span className="text-white font-bold text-lg">C</span>
      </div>
      <nav>
        <ul className="space-y-4">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end
                className={({ isActive }) =>
                  cn(
                    'flex items-center justify-center w-12 h-12 rounded-lg transition-colors duration-200',
                    isActive
                      ? 'bg-indigo-100 text-indigo-600'
                      : 'text-gray-500 hover:bg-gray-100'
                  )
                }
              >
                <item.icon className="w-6 h-6" />
                <span className="sr-only">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
};

export default MainSidebar;