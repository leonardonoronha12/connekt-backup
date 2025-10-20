import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import MainSidebar from '@/components/MainSidebar';

const MainLayout = () => {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-gray-50">
      <MainSidebar activePath={location.pathname} />
      <main className="flex-1 h-screen overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;