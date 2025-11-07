import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/SupabaseAuthContext';
import Alert from './ui/Alert';

// Função para traduzir mensagens de erro do Supabase
const translateErrorMessage = (errorMessage) => {
  const translations = {
    'Invalid login credentials': 'Credenciais de login inválidas',
    'Email not confirmed': 'Email não confirmado',
    'Too many requests': 'Muitas tentativas. Tente novamente mais tarde',
    'User not found': 'Usuário não encontrado',
    'Invalid email': 'Email inválido',
    'Password should be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres',
    'Email already registered': 'Email já cadastrado',
    'Weak password': 'Senha muito fraca',
    'Invalid password': 'Senha inválida',
    'Network error': 'Erro de conexão',
    'Server error': 'Erro do servidor'
  };
  
  return translations[errorMessage] || errorMessage;
};

const LoginForm = ({ onShowRegister }) => {
  const { signIn, resetPassword } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  
  // Estados para alertas
  const [alert, setAlert] = useState({
    show: false,
    message: '',
    type: 'error'
  });

  const showAlert = (message, type = 'error') => {
    setAlert({
      show: true,
      message,
      type
    });
  };

  const hideAlert = () => {
    setAlert({
      show: false,
      message: '',
      type: 'error'
    });
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password) {
      showAlert('Por favor, preencha todos os campos');
      return;
    }

    setLoading(true);
    
    try {
      const { error } = await signIn(formData.email, formData.password);

      if (error) {
        const translatedMessage = translateErrorMessage(error.message);
        showAlert(`Erro no login: ${translatedMessage}`);
      } else {
        showAlert('Login realizado com sucesso!', 'success');
        // Redireciona imediatamente para o dashboard após login bem-sucedido
        window.history.replaceState({}, '', '/dashboard');
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    } catch (error) {
      console.error('Erro no login:', error);
      showAlert('Erro ao realizar login. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    setShowForgotPassword(true);
  };

  const handleBackToLogin = () => {
    setShowForgotPassword(false);
    setResetEmail('');
    setResetEmailSent(false);
    setResetLoading(false);
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    
    if (!resetEmail.trim()) {
      showAlert('Por favor, digite seu email');
      return;
    }

    setResetLoading(true);
    
    try {
      const { error } = await resetPassword(resetEmail);
      
      if (error) {
        const translatedMessage = translateErrorMessage(error.message);
        showAlert(`Erro ao enviar email de recuperação: ${translatedMessage}`);
      } else {
        // Redireciona para página de verificação
        window.history.pushState({}, '', '/verify-email');
        window.dispatchEvent(new PopStateEvent('popstate'));
        
        // Passa o email via state (simulando navigate com state)
        setTimeout(() => {
          const event = new CustomEvent('navigate-to-verify', {
            detail: { email: resetEmail, isPasswordReset: true }
          });
          window.dispatchEvent(event);
        }, 100);
        
        showAlert('Código de recuperação enviado para seu email!', 'success');
      }
    } catch (error) {
      console.error('Erro ao enviar email de recuperação:', error);
      showAlert('Erro ao enviar email de recuperação. Tente novamente.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleSocialLogin = (provider) => {
    console.log(`Login with ${provider}`);
  };

  return (
    <div className="flex min-h-screen">
      {/* Alert Component */}
      <Alert 
        show={alert.show}
        message={alert.message}
        type={alert.type}
        onClose={hideAlert}
      />

      <style>{`
         @keyframes slideInFromRight {
           0% {
             transform: translateX(100%);
             opacity: 0;
           }
           100% {
             transform: translateX(0);
             opacity: 1;
           }
         }

         @keyframes slideLeftBorder {
           0% {
             width: 100%;
             transform: translateX(0);
           }
           100% {
             width: 0%;
             transform: translateX(0);
           }
         }
       `}</style>
      {/* Painel Esquerdo - Background com logo integrada */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden" style={{ maxWidth: '590px' }}>
        <img 
          src="/Imagemesquerda.svg" 
          alt="Background" 
          className="absolute inset-0 h-full object-cover"
          style={{
            width: '590px'
          }}
        />
        
        {/* Logo integrada com a imagem de fundo */}
        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 z-10" style={{ width: '590px', paddingBottom: '70px' }}>
          <img 
            src="/logo-expanded.svg" 
            alt="Connekt" 
            className="object-contain mx-auto"
            style={{
              width: '194px',
              height: '58px'
            }}
          />
        </div>
      </div>

      {/* Painel Direito - Formulário */}
      <div className="w-full flex flex-col p-4 sm:p-8 bg-white min-h-screen overflow-y-auto">
        {/* Logo para mobile */}
        <div className="lg:hidden absolute top-8 left-1/2 transform -translate-x-1/2">
          <img 
            src="https://f1925bd3031c7289927c33dbfff0ab8f.cdn.bubble.io/f1756911553447x294420453444362900/HORIZONTAL%20BRANCO.svg"
            alt="Connekt Logo"
            className="h-6 w-auto filter brightness-0"
          />
        </div>
        
        {/* Conteúdo principal */}
        <div className="flex-1 flex items-center justify-center">
        {showForgotPassword ? (
           /* Forgot Password Form */
           <div className="w-full max-w-md mx-auto space-y-6 flex flex-col justify-center">
             <div style={{ width: '100%', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex' }}>
               {/* Back Button */}
               <button 
                 onClick={handleBackToLogin}
                 style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
               >
                 <div style={{ width: '100%', height: '100%', overflow: 'hidden', borderRadius: '8px', justifyContent: 'flex-start', alignItems: 'center', gap: '8px', display: 'inline-flex' }}>
                    <div style={{ width: '24px', height: '24px', position: 'relative' }}>
                      <img 
                        src="/Arrow.svg" 
                        alt="Voltar" 
                        style={{ width: '24px', height: '24px' }}
                      />
                    </div>
                    <div style={{ justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--secondary-500, #0047BB)', fontSize: '16px', fontFamily: 'Inter', fontWeight: '600', lineHeight: '24px', wordWrap: 'break-word' }}>
                       Voltar
                     </div>
                  </div>
               </button>

               {/* Spacing */}
               <div style={{ alignSelf: 'stretch', height: '40px', position: 'relative' }}>
                 <div style={{ width: '40px', height: '40px', left: '0px', top: '0px', position: 'absolute' }}></div>
               </div>

               {/* Header */}
               <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', gap: '8px', display: 'flex' }}>
                 <div style={{ alignSelf: 'stretch', color: '#22252B', fontSize: '28px', fontFamily: 'Inter', fontWeight: '600', lineHeight: '42px', wordWrap: 'break-word' }}>
                   Recuperar acesso
                 </div>
                 <div style={{ alignSelf: 'stretch', color: '#737780', fontSize: '14px', fontFamily: 'Inter', fontWeight: '400', lineHeight: '24px', wordWrap: 'break-word' }}>
                   Digite seu endereço de e-mail e enviaremos um link para redefinir sua senha.
                 </div>
               </div>

               {/* Spacing */}
               <div style={{ alignSelf: 'stretch', height: '40px', position: 'relative' }}>
                 <div style={{ width: '40px', height: '40px', left: '0px', top: '0px', position: 'absolute' }}></div>
               </div>

               {resetEmailSent ? (
                 /* Success Message */
                 <div className="text-center space-y-4">
                   <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                     <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                     </svg>
                   </div>
                   <div>
                     <h3 className="text-lg font-medium text-gray-900 mb-2">Email enviado!</h3>
                     <p className="text-gray-600 text-sm">
                       Enviamos um link de recuperação para <strong>{resetEmail}</strong>. 
                       Verifique sua caixa de entrada e siga as instruções.
                     </p>
                   </div>
                   <button
                     onClick={handleBackToLogin}
                     style={{
                       width: '100%',
                       padding: '12px 16px',
                       backgroundColor: '#0047BB',
                       color: 'white',
                       fontWeight: '500',
                       borderRadius: '4px',
                       border: 'none',
                       cursor: 'pointer',
                       transition: 'background-color 0.2s',
                       outline: 'none'
                     }}
                     onMouseEnter={(e) => e.target.style.backgroundColor = '#003399'}
                     onMouseLeave={(e) => e.target.style.backgroundColor = '#0047BB'}
                   >
                     Voltar ao login
                   </button>
                 </div>
               ) : (
                 <>
                   {/* Email Field */}
                   <div style={{ width: '100%' }}>
                     <label htmlFor="resetEmail" style={{
                       color: '#22252B',
                       fontSize: '14px',
                       fontFamily: 'Inter',
                       fontWeight: '400'
                     }}>
                       Email
                     </label>
                     <input
                       id="resetEmail"
                       name="resetEmail"
                       type="email"
                       value={resetEmail}
                       onChange={(e) => setResetEmail(e.target.value)}
                       placeholder="seuemail@gmail.com"
                       style={{
                         width: '100%',
                         height: '48px',
                         padding: '12px 16px',
                         backgroundColor: '#F8FAFC',
                         border: '1px solid #E3E4E5',
                         borderRadius: '4px',
                         fontSize: '14px',
                         fontFamily: 'Inter',
                         outline: 'none',
                         transition: 'border-color 0.2s',
                         marginTop: '8px'
                       }}
                       onFocus={(e) => e.target.style.borderColor = '#0047BB'}
                       onBlur={(e) => e.target.style.borderColor = '#E3E4E5'}
                       required
                       disabled={resetLoading}
                     />
                   </div>

                   {/* Spacing */}
                   <div style={{ alignSelf: 'stretch', height: '40px', position: 'relative' }}>
                     <div style={{ width: '40px', height: '40px', left: '0px', top: '0px', position: 'absolute' }}></div>
                   </div>

                   {/* Submit Button - Bloqueado temporariamente */}
                   <button
                     type="button"
                     disabled={true}
                     style={{ 
                       alignSelf: 'stretch', 
                       paddingTop: '10px', 
                       paddingBottom: '10px', 
                       paddingLeft: '24px', 
                       paddingRight: '20px', 
                       background: '#E3E4E5', 
                       borderRadius: '4px', 
                       justifyContent: 'center', 
                       alignItems: 'center', 
                       gap: '8px', 
                       display: 'inline-flex',
                       border: 'none',
                       cursor: 'not-allowed',
                       opacity: 0.5,
                       transition: 'background-color 0.2s, opacity 0.2s'
                     }}
                   >
                     <div style={{ height: '24px', justifyContent: 'center', alignItems: 'center', gap: '10px', display: 'flex' }}>
                       <div style={{ textAlign: 'center', justifyContent: 'center', display: 'flex', flexDirection: 'column', color: '#9291A5', fontSize: '14px', fontFamily: 'Inter', fontWeight: '700', lineHeight: '23.80px', wordWrap: 'break-word' }}>
                         Enviar (Em breve)
                       </div>
                     </div>
                   </button>

                   {/* Spacing */}
                   <div style={{ alignSelf: 'stretch', height: '32px', position: 'relative' }}>
                     <div style={{ width: '32px', height: '32px', left: '0px', top: '0px', position: 'absolute' }}></div>
                   </div>
                 </>
               )}
             </div>
           </div>
        ) : (
          /* Login Form */
          <div className="w-full max-w-md mx-auto space-y-6 flex-grow flex flex-col justify-center">
          {/* Header de boas-vindas */}
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">
              Boas-vindas à <span className="text-[#0047BB]">Connekt!</span>
            </h1>
            <div className="flex items-center justify-center gap-2 text-sm">
              <span className="text-gray-600">Novo por aqui?</span>
              <button 
                type="button"
                className="text-[#0047BB] hover:text-[#003399] font-medium transition-colors"
                onClick={onShowRegister}
              >
                Crie sua conta agora
              </button>
            </div>
          </div>

          {/* Botões de login social */}
          <div style={{ display: 'flex', gap: '16px', width: '100%' }}>
            <button
              type="button"
              onClick={() => handleSocialLogin('Google')}
              style={{
                flex: '1',
                height: '48px',
                padding: '12px 16px',
                backgroundColor: 'white',
                overflow: 'hidden',
                borderRadius: '8px',
                outline: '1px #E3E4E5 solid',
                outlineOffset: '-1px',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '8px',
                display: 'flex',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M9.18 7.36v3.28h4.64c-.2 1.04-.8 1.92-1.68 2.52v2.08h2.72c1.6-1.48 2.52-3.64 2.52-6.24 0-.6-.04-1.16-.12-1.72H9.18z"/>
                <path fill="#34A853" d="M4.24 10.78c-.32-.96-.32-2 0-2.96V5.74H1.52c-1.04 2.08-1.04 4.52 0 6.6l2.72-2.08z"/>
                <path fill="#FBBC05" d="M9.18 3.6c1.32 0 2.52.48 3.44 1.36l2.56-2.56C13.68.92 11.56 0 9.18 0 5.6 0 2.52 2.24 1.52 5.36l2.72 2.08c.64-1.92 2.44-3.24 4.94-3.24z"/>
                <path fill="#EA4335" d="M9.18 18c2.38 0 4.38-.8 5.84-2.16l-2.72-2.08c-.8.56-1.84.88-3.12.88-2.5 0-4.3-1.32-4.94-3.24L1.52 13.48C2.52 16.76 5.6 18 9.18 18z"/>
              </svg>
              <div style={{
                justifyContent: 'center',
                display: 'flex',
                flexDirection: 'column',
                color: '#333740',
                fontSize: '16px',
                fontFamily: 'Inter',
                fontWeight: '500',
                lineHeight: '24px',
                wordWrap: 'break-word'
              }}>Google</div>
            </button>
            
            <button
              type="button"
              onClick={() => handleSocialLogin('Facebook')}
              style={{
                flex: '1',
                height: '48px',
                padding: '12px 16px',
                overflow: 'hidden',
                borderRadius: '8px',
                outline: '1px #E3E4E5 solid',
                outlineOffset: '-1px',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '8px',
                display: 'flex',
                background: 'white',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="#1877F2">
                <path d="M18 9C18 4.03 13.97 0 9 0S0 4.03 0 9c0 4.49 3.29 8.21 7.59 8.94v-6.32H5.31V9h2.28V7.02c0-2.25 1.34-3.49 3.39-3.49.98 0 2.01.18 2.01.18v2.21h-1.13c-1.11 0-1.46.69-1.46 1.4V9h2.49l-.4 2.62h-2.09v6.32C14.71 17.21 18 13.49 18 9z"/>
              </svg>
              <div style={{
                justifyContent: 'center',
                display: 'flex',
                flexDirection: 'column',
                color: '#22252B',
                fontSize: '16px',
                fontFamily: 'Inter',
                fontWeight: '500',
                lineHeight: '24px',
                wordWrap: 'break-word'
              }}>Facebook</div>
            </button>
          </div>

          {/* Divisor */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-gray-300"></div>
            <span style={{ color: '#737780', fontSize: '14px', fontFamily: 'Inter', fontWeight: '400' }}>ou faça login com email</span>
            <div className="flex-1 h-px bg-gray-300"></div>
          </div>

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Campo Email */}
            <div>
              <label htmlFor="email" style={{
                color: '#22252B',
                fontSize: '14px',
                fontFamily: 'Inter',
                fontWeight: '400'
              }}>
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="seuemail@gmail.com"
                style={{
                  width: '100%',
                  height: '48px',
                  padding: '12px 16px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E3E4E5',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontFamily: 'Inter',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  marginTop: '8px'
                }}
                onFocus={(e) => e.target.style.borderColor = '#0047BB'}
                onBlur={(e) => e.target.style.borderColor = '#E3E4E5'}
                required
              />
            </div>

            {/* Campo Senha */}
            <div>
              <label htmlFor="password" style={{
                color: '#22252B',
                fontSize: '14px',
                fontFamily: 'Inter',
                fontWeight: '400'
              }}>
                Senha
              </label>
              <div style={{ position: 'relative', marginTop: '8px' }}>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  style={{
                    width: '100%',
                    height: '48px',
                    padding: '12px 48px 12px 16px',
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #E3E4E5',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontFamily: 'Inter',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#0047BB'}
                  onBlur={(e) => e.target.style.borderColor = '#E3E4E5'}
                  required
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#737780',
                    padding: '4px'
                  }}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? (
                    <EyeOff style={{ width: '20px', height: '20px' }} />
                  ) : (
                    <Eye style={{ width: '20px', height: '20px' }} />
                  )}
                </button>
              </div>
            </div>

            {/* Opções adicionais */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="rememberMe"
                  checked={formData.rememberMe}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-[#0047BB] bg-white border-gray-300 rounded focus:ring-[#0047BB] focus:ring-2"
                />
                <span className="text-gray-700 text-sm">Manter conectado</span>
              </label>
              
              <button
                type="button"
                className="text-[#0047BB] hover:text-[#003399] text-sm font-medium transition-colors"
                onClick={handleForgotPassword}
              >
                Esqueci minha senha
              </button>
            </div>

            {/* Botão de login */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 16px',
                backgroundColor: loading ? '#E3E4E5' : '#0047BB',
                color: 'white',
                fontWeight: '500',
                borderRadius: '4px',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s',
                outline: 'none'
              }}
              onMouseEnter={(e) => !loading && (e.target.style.backgroundColor = '#003399')}
              onMouseLeave={(e) => !loading && (e.target.style.backgroundColor = '#0047BB')}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          {/* Link para criar conta */}
          <div className="text-center">
            <span className="text-gray-600 text-sm">Novo por aqui? </span>
            <button 
              type="button"
              className="text-[#0047BB] hover:text-[#003399] font-medium text-sm transition-colors"
              onClick={onShowRegister}
            >
              Crie sua conta agora
            </button>
          </div>
        </div>
        )}
        </div>
        
        {/* Footer separado do conteúdo principal */}
        <div className="flex justify-between items-center mt-8 w-full px-4 sm:px-8" style={{ 
          color: '#22252B',
          fontSize: '12px',
          fontFamily: 'Inter',
          fontWeight: 400,
          lineHeight: '24px'
        }}>
          <div>Copyright © 2025 - Todos os direitos reservados</div>
          <div className="flex space-x-4">
            <button className="hover:text-gray-700 transition-colors">Suporte</button>
            <span>•</span>
            <button className="hover:text-gray-700 transition-colors">Termos de uso</button>
            <span>•</span>
            <button className="hover:text-gray-700 transition-colors">Política de privacidade</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;