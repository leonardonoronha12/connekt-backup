import React, { useState } from 'react';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';

const AuthContainer = () => {
  const [currentView, setCurrentView] = useState('login'); // 'login' ou 'register'

  const showRegister = () => {
    setCurrentView('register');
  };

  const showLogin = () => {
    setCurrentView('login');
  };

  return (
    <div>
      {currentView === 'login' && (
        <LoginForm onShowRegister={showRegister} />
      )}
      {currentView === 'register' && (
        <RegisterForm onBackToLogin={showLogin} />
      )}
    </div>
  );
};

export default AuthContainer;