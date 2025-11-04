import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/SupabaseAuthContext';

const EmailVerificationPage = () => {
  const { verifyEmailCode, resendVerificationCode } = useAuth();
  
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [emailData, setEmailData] = useState({
    email: 'seu@email.com',
    isPasswordReset: false
  });
  
  const inputRefs = useRef([]);

  useEffect(() => {
    // Escuta evento customizado para receber dados do email
    const handleNavigateToVerify = (event) => {
      setEmailData({
        email: event.detail.email,
        isPasswordReset: event.detail.isPasswordReset
      });
    };

    window.addEventListener('navigate-to-verify', handleNavigateToVerify);

    return () => {
      window.removeEventListener('navigate-to-verify', handleNavigateToVerify);
    };
  }, []);

  useEffect(() => {
    // Foco no primeiro input ao carregar
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleInputChange = (index, value) => {
    if (value.length > 1) return; // Apenas um dígito por input
    
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    
    // Move para o próximo input se um dígito foi inserido
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    // Backspace: limpa o campo atual e move para o anterior
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    
    // Enter: tenta verificar o código
    if (e.key === 'Enter') {
      handleVerifyCode();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    
    if (pastedData.length === 6) {
      const newCode = pastedData.split('');
      setCode(newCode);
      inputRefs.current[5]?.focus();
    }
  };

  const handleVerifyCode = async () => {
    const fullCode = code.join('');
    
    if (fullCode.length !== 6) {
      setError('Por favor, digite o código completo de 6 dígitos');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await verifyEmailCode(emailData.email, fullCode, emailData.isPasswordReset);
      
      if (result.success) {
        setSuccess('Código verificado com sucesso!');
        
        // Redireciona baseado no tipo de verificação
        setTimeout(() => {
          if (emailData.isPasswordReset) {
            window.history.pushState({}, '', '/reset-password');
            window.dispatchEvent(new PopStateEvent('popstate'));
          } else {
            window.history.pushState({}, '', '/dashboard');
            window.dispatchEvent(new PopStateEvent('popstate'));
          }
        }, 1500);
      } else {
        setError(result.error || 'Código inválido. Tente novamente.');
      }
    } catch (error) {
      setError('Erro ao verificar código. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setResendLoading(true);
    setError('');
    
    try {
      const result = await resendVerificationCode(emailData.email, emailData.isPasswordReset);
      
      if (result.success) {
        setSuccess('Novo código enviado para seu email!');
        setCountdown(60); // 60 segundos de cooldown
        setCode(['', '', '', '', '', '']); // Limpa os inputs
        inputRefs.current[0]?.focus();
      } else {
        setError(result.error || 'Erro ao reenviar código');
      }
    } catch (error) {
      setError('Erro ao reenviar código. Tente novamente.');
    } finally {
      setResendLoading(false);
    }
  };

  const handleBack = () => {
    window.history.pushState({}, '', '/login');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Botão Voltar */}
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-10 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span className="font-semibold">Voltar</span>
        </button>

        {/* Conteúdo Principal */}
        <div className="bg-white rounded-lg shadow-sm p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-gray-800 mb-2">
              Por favor verifique seu e-mail!
            </h1>
            <p className="text-sm text-gray-500 leading-relaxed">
              Enviamos um código de confirmação de 6 dígitos para{' '}
              <span className="font-medium text-gray-700">{emailData.email}</span>.{' '}
              Digite o código enviado na caixa abaixo para verificar seu e-mail.
            </p>
          </div>

          {/* Inputs do Código */}
          <div className="flex justify-center gap-3 mb-6">
            {code.map((digit, index) => (
              <input
                key={index}
                ref={(el) => (inputRefs.current[index] = el)}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength="1"
                value={digit}
                onChange={(e) => handleInputChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                className="w-14 h-14 text-center text-lg font-medium border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition-all"
                disabled={loading}
              />
            ))}
          </div>

          {/* Mensagens de Erro/Sucesso */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm text-center">
              {error}
            </div>
          )}
          
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm text-center">
              {success}
            </div>
          )}

          {/* Botão Verificar */}
          <button
            onClick={handleVerifyCode}
            disabled={loading || code.join('').length !== 6}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mb-4"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Verificando...
              </div>
            ) : (
              'Verificar'
            )}
          </button>

          {/* Reenviar Código */}
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-2">
              Não recebeu o código?{' '}
              {countdown > 0 ? (
                <span className="text-blue-600 font-medium">
                  Reenviar código em {countdown}s
                </span>
              ) : (
                <button
                  onClick={handleResendCode}
                  disabled={resendLoading}
                  className="text-blue-600 hover:text-blue-700 font-medium underline disabled:opacity-50"
                >
                  {resendLoading ? 'Reenviando...' : 'Reenviar código'}
                </button>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailVerificationPage;