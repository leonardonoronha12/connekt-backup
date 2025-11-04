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
    'User already registered': 'Usuário já cadastrado',
    'Weak password': 'Senha muito fraca',
    'Invalid password': 'Senha inválida',
    'Network error': 'Erro de conexão',
    'Server error': 'Erro do servidor',
    'Email address not authorized': 'Endereço de email não autorizado',
    'Signup is disabled': 'Cadastro desabilitado'
  };
  
  return translations[errorMessage] || errorMessage;
};

const RegisterForm = ({ onBackToLogin }) => {
  const { signUp } = useAuth();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPasswordRequirements, setShowPasswordRequirements] = useState(false);

  // Estados para alertas
  const [alert, setAlert] = useState({
    show: false,
    message: '',
    type: 'error'
  });

  const showAlert = (message, type = 'error') => {
    setAlert({ show: true, message, type });
  };

  const hideAlert = () => {
    setAlert({ show: false, message: '', type: 'error' });
  };

  // Função para validar senha
  const validatePassword = (password) => {
    const minLength = password.length >= 6;
    const hasNumber = /\d/.test(password);
    const hasLetter = /[a-zA-Z]/.test(password);
    
    if (!minLength) {
      return 'A senha deve ter no mínimo 6 caracteres';
    }
    if (!hasNumber) {
      return 'A senha deve conter pelo menos um número';
    }
    if (!hasLetter) {
      return 'A senha deve conter pelo menos uma letra';
    }
    
    return null; // Senha válida
  };

  // Função para verificar requisitos da senha em tempo real
  const getPasswordRequirements = (password) => {
    const minLength = password.length >= 6;
    const hasNumber = /\d/.test(password);
    const hasLetter = /[a-zA-Z]/.test(password);
    
    return {
      minLength,
      hasNumber,
      hasLetter
    };
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validar senha
    const passwordError = validatePassword(formData.password);
    if (passwordError) {
      showAlert(passwordError);
      return;
    }
    
    if (formData.password !== formData.confirmPassword) {
      showAlert('As senhas não coincidem');
      return;
    }
    
    if (!acceptedTerms || !acceptedPrivacy) {
      showAlert('Você deve aceitar os termos de uso e política de privacidade');
      return;
    }

    setLoading(true);
    
    try {
      const { error } = await signUp(formData.email, formData.password, {
        data: {
          first_name: formData.firstName,
          last_name: formData.lastName,
          full_name: `${formData.firstName} ${formData.lastName}`
        }
      });

      if (error) {
        const translatedMessage = translateErrorMessage(error.message);
        showAlert(`Erro no cadastro: ${translatedMessage}`);
      } else {
        showAlert('Cadastro realizado com sucesso! Verifique seu email para confirmar a conta.', 'success');
        // Limpar o formulário após sucesso
        setFormData({
          firstName: '',
          lastName: '',
          email: '',
          password: '',
          confirmPassword: ''
        });
        setAcceptedTerms(false);
        setAcceptedPrivacy(false);
      }
    } catch (error) {
      console.error('Erro no cadastro:', error);
      showAlert('Erro ao realizar cadastro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = (provider) => {
    console.log(`Cadastro com ${provider}`);
  };

  return (
    <div style={{ 
      width: '100%', 
      height: '100vh', 
      position: 'relative', 
      background: 'white', 
      overflow: 'hidden', 
      display: 'flex' 
    }}>
      {/* Alert Component */}
      <Alert 
        show={alert.show}
        message={alert.message}
        type={alert.type}
        onClose={hideAlert}
      />
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
        <div className="flex-grow flex items-center justify-center">
          <div className="w-full max-w-md mx-auto flex flex-col">
          {/* Botão Voltar */}
          <button 
            onClick={onBackToLogin}
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

          {/* Espaçamento */}
          <div data-espaçamento="40px" style={{ alignSelf: 'stretch', height: '40px', position: 'relative' }}>
            <div style={{ width: '40px', height: '40px', left: '0px', top: '0px', position: 'absolute' }}></div>
          </div>

          {/* Header */}
          <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex' }}>
            <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', gap: '8px', display: 'flex' }}>
              <div style={{ alignSelf: 'stretch', color: 'var(--neutral-800, #22252B)', fontSize: '28px', fontFamily: 'Inter', fontWeight: '600', lineHeight: '42px', wordWrap: 'break-word' }}>Comece agora mesmo!</div>
              <div style={{ alignSelf: 'stretch', justifyContent: 'flex-start', alignItems: 'center', gap: '8px', display: 'inline-flex' }}>
                <div style={{ color: 'var(--color-grey-500, #737780)', fontSize: '14px', fontFamily: 'Inter', fontWeight: '400', lineHeight: '24px', wordWrap: 'break-word' }}>Crie sua conta na melhor plataforma de cursos para medicina do Brasil</div>
              </div>
            </div>

            {/* Espaçamento */}
            <div data-espaçamento="40px" style={{ alignSelf: 'stretch', height: '40px', position: 'relative' }}>
              <div style={{ width: '40px', height: '40px', left: '0px', top: '0px', position: 'absolute' }}></div>
            </div>

            {/* Botões de cadastro social */}
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

            {/* Espaçamento */}
            <div data-espaçamento="32px" style={{ alignSelf: 'stretch', height: '32px', position: 'relative' }}>
              <div style={{ width: '32px', height: '32px', left: '0px', top: '0px', position: 'absolute' }}></div>
            </div>

            {/* Divider "ou" */}
            <div style={{ alignSelf: 'stretch', justifyContent: 'center', alignItems: 'center', gap: '16px', display: 'inline-flex' }}>
              <div style={{ flex: '1 1 0', height: '0px', outline: '1px var(--neutral-100, #E3E4E5) solid', outlineOffset: '-0.50px' }}></div>
              <div style={{ textAlign: 'center', color: 'var(--neutral-100, #E3E4E5)', fontSize: '14px', fontFamily: 'Inter', fontWeight: '400', lineHeight: '24px', wordWrap: 'break-word' }}>ou</div>
              <div style={{ flex: '1 1 0', height: '0px', outline: '1px var(--neutral-100, #E3E4E5) solid', outlineOffset: '-0.50px' }}></div>
            </div>

            {/* Espaçamento */}
            <div data-espaçamento="32px" style={{ alignSelf: 'stretch', height: '32px', position: 'relative' }}>
              <div style={{ width: '32px', height: '32px', left: '0px', top: '0px', position: 'absolute' }}></div>
            </div>
          </div>

          {/* Formulário */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Nome e Sobrenome */}
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{
                  color: '#22252B',
                  fontSize: '14px',
                  fontFamily: 'Inter',
                  fontWeight: '400'
                }}>
                  Primeiro nome
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  placeholder="Igor Rafael"
                  required
                  style={{
                    height: '48px',
                    padding: '12px 16px',
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
                />
              </div>
              <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{
                  color: '#22252B',
                  fontSize: '14px',
                  fontFamily: 'Inter',
                  fontWeight: '400'
                }}>
                  Sobrenome
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  placeholder="Oliveira"
                  required
                  style={{
                    height: '48px',
                    padding: '12px 16px',
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
                />
              </div>
            </div>

            {/* Email */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{
                color: '#22252B',
                fontSize: '14px',
                fontFamily: 'Inter',
                fontWeight: '400'
              }}>
                Email
              </label>
              <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="igorrafael@gmail.com"
              required
              style={{
                height: '48px',
                padding: '12px 16px',
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
            />
            </div>

            {/* Senha */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{
                color: '#22252B',
                fontSize: '14px',
                fontFamily: 'Inter',
                fontWeight: '400'
              }}>
                Senha
              </label>
              <div style={{ position: 'relative' }}>
                <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="••••••••"
                required
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
                onFocus={(e) => {
                  e.target.style.borderColor = '#0047BB';
                  setShowPasswordRequirements(true);
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#E3E4E5';
                  setShowPasswordRequirements(false);
                }}
              />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#737780'
                  }}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              
              {/* Requisitos da senha */}
              {showPasswordRequirements && formData.password && (
                <div style={{
                  padding: '12px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E3E4E5',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontFamily: 'Inter'
                }}>
                  <div style={{ marginBottom: '8px', fontWeight: '500', color: '#22252B' }}>
                    Requisitos da senha:
                  </div>
                  {(() => {
                    const requirements = getPasswordRequirements(formData.password);
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          color: requirements.minLength ? '#10B981' : '#EF4444'
                        }}>
                          <span>{requirements.minLength ? '✓' : '✗'}</span>
                          Mínimo 6 caracteres
                        </div>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          color: requirements.hasNumber ? '#10B981' : '#EF4444'
                        }}>
                          <span>{requirements.hasNumber ? '✓' : '✗'}</span>
                          Pelo menos um número
                        </div>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          color: requirements.hasLetter ? '#10B981' : '#EF4444'
                        }}>
                          <span>{requirements.hasLetter ? '✓' : '✗'}</span>
                          Pelo menos uma letra
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Confirmar Senha */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{
                color: '#22252B',
                fontSize: '14px',
                fontFamily: 'Inter',
                fontWeight: '400'
              }}>
                Confirmar senha
              </label>
              <div style={{ position: 'relative' }}>
                <input
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                placeholder="••••••••"
                required
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
              />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#737780'
                  }}
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              <p style={{
                color: '#737780',
                fontSize: '12px',
                fontFamily: 'Inter',
                margin: '0'
              }}>
                Ter no mínimo 6 caracteres, um número e uma letra
              </p>
            </div>

            {/* Termos e Política */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{
                color: '#22252B',
                fontSize: '14px',
                fontFamily: 'Inter',
                fontWeight: '400'
              }}>
                Termos e política
              </div>
              <p style={{
                color: '#737780',
                fontSize: '12px',
                fontFamily: 'Inter',
                margin: '0',
                lineHeight: '18px'
              }}>
                Para seguirmos com o seu cadastro você precisa estar de acordo com nossos{' '}
                <a href="#" style={{ color: '#0047BB', textDecoration: 'underline' }}>termos de uso</a> e{' '}
                <a href="#" style={{ color: '#0047BB', textDecoration: 'underline' }}>política de privacidade</a>, que estão representados logo abaixo.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontFamily: 'Inter',
                  fontWeight: '400',
                  color: '#22252B'
                }}>
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    style={{
                      width: '16px',
                      height: '16px',
                      accentColor: '#0047BB'
                    }}
                  />
                  Termos de uso
                </label>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontFamily: 'Inter',
                  fontWeight: '400',
                  color: '#22252B'
                }}>
                  <input
                    type="checkbox"
                    checked={acceptedPrivacy}
                    onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                    style={{
                      width: '16px',
                      height: '16px',
                      accentColor: '#0047BB'
                    }}
                  />
                  Política de privacidade
                </label>
              </div>
            </div>

            {/* Botão de Cadastro */}
            <button
              type="submit"
              disabled={loading || !acceptedTerms || !acceptedPrivacy}
              style={{
                width: '100%',
                height: '48px',
                background: loading || !acceptedTerms || !acceptedPrivacy ? '#E3E4E5' : '#0047BB',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '16px',
                fontFamily: 'Inter',
                fontWeight: '600',
                cursor: loading || !acceptedTerms || !acceptedPrivacy ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s'
              }}
            >
              {loading ? 'Criando conta...' : 'Criar'}
            </button>
          </form>
          </div>
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

export default RegisterForm;