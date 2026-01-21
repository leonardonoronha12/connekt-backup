import React, { useMemo, useState, useEffect } from 'react';
import { ArrowLeft, X, HelpCircle, Bell, ChevronDown, User, Search } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import SystemNotificationsModal from '@/components/SystemNotificationsModal.jsx';
import { notificationsService } from '@/services/notificationsService.js';
import ContentSearchModal from '@/components/ContentSearchModal.jsx';

const Header = () => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchValue, setSearchValue] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [currentSearch, setCurrentSearch] = useState(window.location.search);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const { signOut, user } = useAuth();

  const avatarUrl = useMemo(() => {
    try {
      const meta = user && typeof user === 'object' ? (user.user_metadata || {}) : {}
      const candidates = [
        meta.avatar_url,
        meta.picture,
        meta.avatar,
        meta.photoURL,
        meta.profile_picture,
        meta.profile_image_url,
      ]
      const direct = candidates.find((v) => typeof v === 'string' && v.trim())
      if (direct) return String(direct).trim()

      const identities = Array.isArray(user?.identities) ? user.identities : []
      for (const identity of identities) {
        const data = identity && typeof identity === 'object' ? (identity.identity_data || {}) : {}
        const idCandidates = [
          data.avatar_url,
          data.picture,
          data.avatar,
          data.picture_url,
          data.profile_picture,
          data.profile_image_url,
        ]
        const found = idCandidates.find((v) => typeof v === 'string' && v.trim())
        if (found) return String(found).trim()
      }
    } catch (_) {}
    return ''
  }, [user]);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [avatarUrl]);

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

  useEffect(() => {
    const userId = user?.id || null
    const isAlunoPath = String(currentPath || '').startsWith('/aluno')
    if (isAlunoPath) {
      setUnreadCount(0)
      return
    }
    if (!userId) {
      setUnreadCount(0)
      return
    }
    const unsub = notificationsService.subscribe(userId, (items) => {
      setUnreadCount((Array.isArray(items) ? items : []).filter(n => n && !n.readAt).length)
    })
    return () => { try { unsub && unsub() } catch (_) {} }
  }, [user?.id, currentPath])

  const isAproveitamento = currentPath === '/simulados-aproveitamento';
  const isSimuladoResposta = currentPath === '/reposta-correta-simulado';
  const isAlunoPath = String(currentPath || '').startsWith('/aluno')
  const showSearch = isAlunoPath
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
      const isAluno = String(window.location.pathname || '').startsWith('/aluno')
      window.history.replaceState({}, '', isAluno ? '/login-aluno' : '/login');
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (e) {
      console.error('Exceção ao deslogar:', e?.message || String(e));
    }
  };

  const navigateTo = (path) => {
    try {
      window.history.pushState({}, '', path);
      setCurrentPath(window.location.pathname);
      setCurrentSearch(window.location.search);
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (_) {
      window.location.assign(path);
    }
  }

  const handleGoToProfile = () => {
    setIsDropdownOpen(false)
    const isAluno = String(window.location.pathname || '').startsWith('/aluno')
    navigateTo(isAluno ? '/aluno/configuracoes?tab=perfil' : '/configuracoes?tab=perfil')
  }

  const handleGoToSettings = () => {
    setIsDropdownOpen(false)
    const isAluno = String(window.location.pathname || '').startsWith('/aluno')
    navigateTo(isAluno ? '/aluno/configuracoes' : '/configuracoes')
  }

  useEffect(() => {
    const q = String(searchValue || '').trim()
    if (!showSearch) {
      if (q.length > 0) setSearchValue('')
      setIsSearchOpen(false)
      return
    }
    if (q.length > 0) {
      setIsSearchOpen(true)
      return
    }
    setIsSearchOpen(false)
  }, [searchValue, showSearch])

  const handleSelectSearchResult = (item) => {
    setIsSearchOpen(false)
    if (!item) return
    const isAluno = String(window.location.pathname || '').startsWith('/aluno')
    if (item.type === 'Simulado') {
      navigateTo(isAluno ? '/aluno/simulados/acesso?simId=s1' : '/simulados/acesso?simId=s1')
      return
    }
    if (item.type === 'Curso') {
      navigateTo(isAluno ? '/aluno' : '/produtos')
      return
    }
    if (item.type === 'Aula') {
      navigateTo(isAluno ? '/aluno/aula' : '/produtos')
      return
    }
  }

  return (
    <header 
      className={`sticky top-0 w-full flex items-center ${isSimuladoResposta ? 'justify-end' : 'justify-between'}`}
      style={{
        height: isSimuladoResposta ? '48px' : '60px',
        backgroundColor: 'rgb(255, 255, 255)',
        border: '1px solid rgb(227, 228, 229)',
        paddingRight: isSimuladoResposta ? '18px' : '22px',
        paddingLeft: isSimuladoResposta ? undefined : '22px',
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

      {!isSimuladoResposta && !isAproveitamento && showSearch ? (
        <div className="flex items-center gap-3 flex-1">
          <div className="flex items-center gap-2 w-full max-w-[420px]" style={{ height: '36px', padding: '0 12px', borderRadius: '8px', border: '1px solid rgb(227, 228, 229)', backgroundColor: 'rgb(249, 250, 251)' }}>
            <Search className="w-4 h-4 text-[#737780]" />
            <input
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="flex-1 bg-transparent outline-none text-[12px] text-[#22252B]"
              placeholder="Busque por um termo desejado"
              onKeyDown={(e) => {
                if (e.key === 'Escape') setSearchValue('')
                if (e.key === 'Enter') setIsSearchOpen(true)
              }}
            />
          </div>
        </div>
      ) : (
        <div />
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
            <HelpCircle className="w-3 h-3 text-[#22252B]" />
          </button>

          {/* Botão 2 - Notificações */}
          {!isAlunoPath ? (
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
              onClick={() => setIsNotificationsOpen(v => !v)}
            >
              <span className="relative">
                <Bell className="w-3 h-3 text-[#22252B]" />
                {unreadCount > 0 ? (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#0047BB]" />
                ) : null}
              </span>
            </button>
          ) : null}

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
            <span
              className="inline-flex items-center justify-center"
              style={{ width: '28px', height: '28px', borderRadius: '100px', backgroundColor: 'rgb(243, 244, 245)' }}
            >
              {avatarUrl && !avatarLoadFailed ? (
                <img
                  src={avatarUrl}
                  alt="Foto de perfil"
                  className="w-full h-full object-cover"
                  style={{ borderRadius: '100px' }}
                  onError={() => setAvatarLoadFailed(true)}
                />
              ) : (
                <User className="w-4 h-4 text-[#22252B]" />
              )}
            </span>
            <ChevronDown className="w-3 h-3 text-[#22252B]" />
          </div>

          {/* Dropdown Menu (placeholder) */}
          {isDropdownOpen && (
            <div 
              className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg py-2 min-w-48"
              style={{ zIndex: 10 }}
            >
              <button type="button" onClick={handleGoToProfile} className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm">Perfil</button>
              <button type="button" onClick={handleGoToSettings} className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm">Configurações</button>
              <hr className="my-1" />
              <button onClick={handleLogout} className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-red-600">Sair</button>
            </div>
          )}

          {!isAlunoPath ? (
            <SystemNotificationsModal
              open={isNotificationsOpen}
              onClose={() => setIsNotificationsOpen(false)}
              user={user}
            />
          ) : null}
        </div>
      )}

      <ContentSearchModal
        open={showSearch && isSearchOpen && !isSimuladoResposta && !isAproveitamento}
        query={searchValue}
        onChangeQuery={setSearchValue}
        onClose={() => setIsSearchOpen(false)}
        onSelect={handleSelectSearchResult}
      />
    </header>
  );
};

export default Header;
