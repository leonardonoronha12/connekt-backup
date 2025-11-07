import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const handleSession = useCallback(async (currentSession) => {
    setSession(currentSession);
    setUser(currentSession?.user ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    const getSession = async () => {
      if (!isSupabaseConfigured || !supabase) {
        console.warn('[Auth] Supabase não configurado. Pular autenticação até configurar env.')
        handleSession(null)
        return
      }
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        handleSession(currentSession);
      } catch (e) {
        console.error("Error getting session:", e);
        handleSession(null);
      }
    };

    getSession();

    if (!isSupabaseConfigured || !supabase) {
      return () => {}
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        // Detectar confirmação de email e redirecionar para dashboard
        if (event === 'SIGNED_IN' && currentSession?.user?.email_confirmed_at) {
          const urlParams = new URLSearchParams(window.location.search);
          if (!urlParams.has('email_confirmed')) {
            window.history.replaceState({}, '', '/dashboard?email_confirmed=true');
            window.dispatchEvent(new PopStateEvent('popstate'));
          }
        }
        handleSession(currentSession);
      }
    );

    return () => subscription.unsubscribe();
  }, [handleSession]);

  const signUp = useCallback(async (email, password, options) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options,
    });

    return { error };
  }, []);

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return { error };
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();

    return { error };
  }, []);

  const resetPassword = useCallback(async (email) => {
    try {
      // Gera um código de 6 dígitos
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Armazena o código temporariamente (em produção, usar banco de dados)
      localStorage.setItem(`reset_code_${email}`, JSON.stringify({
        code: verificationCode,
        timestamp: Date.now(),
        email: email
      }));
      
      // Simula envio de email (em produção, usar serviço de email)
      console.log(`Código de recuperação para ${email}: ${verificationCode}`);
      
      return { error: null };
    } catch (error) {
      console.error('Erro ao gerar código de recuperação:', error);
      return { error: error.message };
    }
  }, []);

  const verifyEmailCode = useCallback(async (email, code, isPasswordReset = false) => {
    try {
      const storageKey = isPasswordReset ? `reset_code_${email}` : `verification_code_${email}`;
      const storedData = localStorage.getItem(storageKey);
      
      if (!storedData) {
        return { success: false, error: 'Código não encontrado ou expirado' };
      }
      
      const { code: storedCode, timestamp } = JSON.parse(storedData);
      
      // Verifica se o código expirou (10 minutos)
      if (Date.now() - timestamp > 10 * 60 * 1000) {
        localStorage.removeItem(storageKey);
        return { success: false, error: 'Código expirado' };
      }
      
      // Verifica se o código está correto
      if (code !== storedCode) {
        return { success: false, error: 'Código inválido' };
      }
      
      // Remove o código usado
      localStorage.removeItem(storageKey);
      
      if (isPasswordReset) {
        // Gera um token temporário para redefinição de senha
        const resetToken = Math.random().toString(36).substring(2, 15);
        localStorage.setItem(`reset_token_${email}`, JSON.stringify({
          token: resetToken,
          timestamp: Date.now(),
          email: email
        }));
        
        return { success: true, token: resetToken };
      }
      
      return { success: true };
    } catch (error) {
      console.error('Erro ao verificar código:', error);
      return { success: false, error: 'Erro interno' };
    }
  }, []);

  const resendVerificationCode = useCallback(async (email, isPasswordReset = false) => {
    try {
      // Gera um novo código de 6 dígitos
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      const storageKey = isPasswordReset ? `reset_code_${email}` : `verification_code_${email}`;
      
      // Armazena o novo código
      localStorage.setItem(storageKey, JSON.stringify({
        code: verificationCode,
        timestamp: Date.now(),
        email: email
      }));
      
      // Simula reenvio de email
      console.log(`Novo código para ${email}: ${verificationCode}`);
      
      return { success: true };
    } catch (error) {
      console.error('Erro ao reenviar código:', error);
      return { success: false, error: 'Erro ao reenviar código' };
    }
  }, []);

  const value = useMemo(() => ({
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
    verifyEmailCode,
    resendVerificationCode,
  }), [user, session, loading, signUp, signIn, signOut, resetPassword, verifyEmailCode, resendVerificationCode]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};