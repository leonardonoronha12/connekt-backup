import React, { useState, useEffect } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const Header = () => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [currentSearch, setCurrentSearch] = useState(window.location.search);
  const { signOut } = useAuth();

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleDropdown();
    }
  };

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
      setCurrentSearch(window.location.search);
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const isAproveitamento = currentPath === '/simulados-aproveitamento';
  const isSimuladoResposta = currentPath === '/reposta-correta-simulado';
  const isFromPreview = new URLSearchParams(currentSearch).get('source') === 'preview';
  const goToSimulados = () => {
    window.history.pushState({}, '', '/simulados');
    setCurrentPath(window.location.pathname);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleLogout = async () => {
    try {
      const { error } = await signOut();
      if (error) {
        console.error('Erro ao deslogar:', error?.message || String(error));
      }
      setIsDropdownOpen(false);
      // Garantir redirecionamento imediato para login
      window.history.replaceState({}, '', '/login');
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (e) {
      console.error('Exceção ao deslogar:', e?.message || String(e));
    }
  };

  return (
    <header 
      className={`sticky top-0 w-full flex items-center ${isAproveitamento ? 'justify-between' : 'justify-end'}`}
      style={{
        height: isSimuladoResposta ? '48px' : '60px',
        backgroundColor: 'rgb(255, 255, 255)',
        border: '1px solid rgb(227, 228, 229)',
        paddingRight: isSimuladoResposta ? '18px' : '22px',
        paddingLeft: isAproveitamento ? '22px' : undefined,
        zIndex: 2
      }}
    >
      {/* Bloco à esquerda (apenas aproveitamento) */}
      {isAproveitamento && (
        <div className="flex items-center" style={{ width: '173px', height: '30px' }}>
          <button 
            type="button" 
            onClick={goToSimulados}
            className="inline-flex items-center gap-2 text-[14px] text-[#737780] font-semibold hover:underline font-sans"
            aria-label="Voltar aos simulados"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              className="w-[24px] h-[24px]"
              aria-hidden="true"
            >
              <path d="M5 12H19" stroke="#737780" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M10 7L5 12" stroke="#737780" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M10 17L5 12" stroke="#737780" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Voltar aos simulados
          </button>
        </div>
      )}

      {/* Centro (apenas rota de resposta do simulado): texto + imagem pequena */}
      {isSimuladoResposta && (
        <div
          className="absolute left-1/2 -translate-x-1/2 flex items-center"
          style={{ gap: '1px' }}
        >
          <img
            src="/header resposta correta.png"
            alt="Header resposta correta"
            style={{ width: '20px', height: '20px', transform: 'rotate(0deg)', opacity: 1, borderRadius: '4px', padding: '8px' }}
          />
          <span className="font-inter text-[14px] font-semibold not-italic leading-[22px] tracking-[0px] text-[#000000]">
            Simulado: Nome do simulado
          </span>
        </div>
      )}
      {/* Bloco de ações à direita */}
      {isSimuladoResposta ? (
        <div 
          className="flex items-center"
          style={{ height: '40px', gap: '12px' }}
        >
          {/* Único botão à direita */}
          <button
            className="flex items-center justify-center transition-all duration-200 hover:bg-black hover:bg-opacity-5 gap-[10px] border border-[#E3E4E5] bg-[#F9FAFB] rounded-[4px] w-[182px] h-[35px] px-[18px] py-[10px] cursor-pointer opacity-100 rotate-0"
            aria-label={isFromPreview ? 'Voltar para criação' : 'Fechar preview'}
            title={isFromPreview ? 'Voltar para criação' : 'Fechar preview'}
            onClick={() => {
              if (isFromPreview) {
                try {
                  const backUrl = localStorage.getItem('simulationPreviewBackUrl');
                  const target = backUrl && typeof backUrl === 'string' && backUrl.startsWith('/')
                    ? backUrl
                    : '/simulados/novo';
                  window.history.pushState({}, '', target);
                } catch {
                  window.history.pushState({}, '', '/simulados/novo');
                }
              } else {
                window.history.pushState({}, '', '/simulados');
              }
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
          >
            {isFromPreview ? (
          <ArrowLeft className="w-[48px] h-[48px] text-[#22252B]" />
            ) : (
              <X className="w-[16px] h-[16px] text-[#22252B]" />
            )}
            <span className="font-inter font-semibold not-italic text-[14px] leading-[22px] tracking-[0px] text-center align-middle text-[#22252B] rotate-0 opacity-100 whitespace-nowrap">
              {isFromPreview ? 'Voltar para criação' : 'Fechar preview'}
            </span>
          </button>
        </div>
      ) : (
        <div 
          className="flex items-center"
          style={{
            width: '130px',
            height: '40px',
            gap: '12px'
          }}
        >
          {/* Botão 1 - Ajuda */}
          <button
            className="flex items-center justify-center transition-all duration-200 hover:bg-black hover:bg-opacity-5"
            style={{
              width: '24px',
              height: '24px',
              backgroundColor: 'rgb(243, 244, 245)',
              borderRadius: '2px',
              cursor: 'pointer'
            }}
            aria-label="Ajuda"
            title="Ajuda"
          >
            <img 
              src="https://f1925bd3031c7289927c33dbfff0ab8f.cdn.bubble.io/f1758656816291x534640535926265100/Subtract.svg"
              alt="Ajuda"
              style={{ width: '12px', height: '12px' }}
            />
          </button>

          {/* Botão 2 - Notificações */}
          <button
            className="flex items-center justify-center transition-all duration-200 hover:bg-black hover:bg-opacity-5"
            style={{
              width: '24px',
              height: '24px',
              backgroundColor: 'rgb(243, 244, 245)',
              borderRadius: '2px',
              cursor: 'pointer'
            }}
            aria-label="Notificações"
            title="Notificações"
          >
            <img 
              src="https://f1925bd3031c7289927c33dbfff0ab8f.cdn.bubble.io/f1758657103732x225759737813068900/Union.svg"
              alt="Notificações"
              style={{ width: '12px', height: '12px' }}
            />
          </button>

          {/* Avatar + Caret */}
          <div
            className="flex items-center cursor-pointer"
            style={{ padding: '8px 12px 8px 0px', gap: '6px' }}
            role="button"
            tabIndex="0"
            aria-haspopup="menu"
            aria-expanded={isDropdownOpen}
            onClick={toggleDropdown}
            onKeyDown={handleKeyDown}
          >
            {/* Avatar */}
            <img 
              src="https://f1925bd3031c7289927c33dbfff0ab8f.cdn.bubble.io/cdn-cgi/image/w=32,h=32,f=auto,dpr=1.5,fit=contain/f1758657000108x375355944655553200/17495777b6f375488fdef0cd10bfe5a730b103ac.jpg"
              alt="Avatar do usuário"
              style={{ width: '28px', height: '28px', borderRadius: '100px' }}
            />
            {/* Caret */}
            <img 
              src="https://f1925bd3031c7289927c33dbfff0ab8f.cdn.bubble.io/f1758657042906x525379221023984260/Component%203.svg"
              alt="Menu"
              style={{ width: '12px', height: '12px' }}
            />
          </div>

          {/* Dropdown Menu (placeholder) */}
          {isDropdownOpen && (
            <div 
              className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg py-2 min-w-48"
              style={{ zIndex: 10 }}
            >
              <button className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm">Perfil</button>
              <button className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm">Configurações</button>
              <hr className="my-1" />
              <button onClick={handleLogout} className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-red-600">Sair</button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};

export default Header;