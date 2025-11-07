import React from 'react';
import { Helmet } from 'react-helmet-async';

const Toggle = ({ checked, onChange, ariaLabel }) => (
  <button
    type="button"
    aria-label={ariaLabel}
    onClick={onChange}
    className={`relative w-[44px] h-[24px] rounded-[50px] transition-colors ${checked ? 'bg-[#0047BB]' : 'bg-[#E3E4E5]'}`}
  >
    <span
      className={`absolute top-[3px] ${checked ? 'left-[23px]' : 'left-[3px]'} w-[18px] h-[18px] bg-white rounded-full transition-all`}
    />
  </button>
);

const ControleAcessoSimuladosPage = () => {
  const [allowAccess, setAllowAccess] = React.useState(false);
  const [requireLogin, setRequireLogin] = React.useState(true);
  const [audience, setAudience] = React.useState('todos'); // 'todos' | 'matriculados' | 'lista'
  const [emails, setEmails] = React.useState('');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [maxAttempts, setMaxAttempts] = React.useState(1);

  const handleSave = () => {
    // Aqui futuramente pode integrar com API
    console.log('Configurações salvas:', {
      allowAccess,
      requireLogin,
      audience,
      emails,
      startDate,
      endDate,
      maxAttempts,
    });
    alert('Configurações salvas (demo)');
  };

  const handleCancel = () => {
    setAllowAccess(false);
    setRequireLogin(true);
    setAudience('todos');
    setEmails('');
    setStartDate('');
    setEndDate('');
    setMaxAttempts(1);
  };

  return (
    <div className="min-h-screen bg-[#FFFFFF]">
      <Helmet>
        <title>Controle de acesso simulados</title>
        <meta name="description" content="Controle de acesso dos simulados." />
      </Helmet>

      <div className="pt-8 px-6 pb-10">
        <div className="space-y-[16px]">
          <h1 className="text-[18px] leading-[42px] font-semibold text-[#000000] font-inter tracking-[0px]">Controle de acesso</h1>
          <p className="text-[16px] leading-[24px] font-normal tracking-[0px] text-[#404040] font-inter">Configure o controle de acesso para esse produto</p>
        </div>

        <div className="mt-6">
          <div className="border border-[#E3E4E5] rounded-[12px] bg-[#FFFFFF] w-[1076px] p-6">
            {/* Seção: Acesso geral */}
            <div className="flex items-center justify-between border-b border-[#E3E4E5] pb-4">
              <div className="flex items-start gap-6">
                <div className="flex flex-col w-[504px] h-[140px] gap-[16px] opacity-100 pt-[22px] pr-[32px] pb-[22px] pl-[32px] rounded-[4px] border border-[#E3E4E5]">
                  <span className="text-[16px] leading-[24px] text-[#22252B] font-inter font-semibold not-italic tracking-[0px]">Simulado gratuito</span>
                  <span className="text-[12px] leading-[18px] text-[#737780] font-inter font-normal not-italic">Ao marcar essa opção, não será cobrado nenhum valor para o acesso deste simulado. Todos os alunos matriculados, planos gratuitos ou premium terão acesso</span>
                </div>
                <div className="flex flex-col w-[504px] h-[140px] gap-[16px] opacity-100 pt-[22px] pr-[32px] pb-[22px] pl-[32px] rounded-[4px] border border-[#E3E4E5]">
                  <span className="text-[16px] leading-[24px] text-[#22252B] font-inter font-semibold not-italic tracking-[0px]">Simulado pago</span>
                  <span className="text-[12px] leading-[18px] text-[#737780] font-inter font-normal not-italic">Ao marcar essa opção, apenas os alunos que comprarem o acesso através de pagamento online, poderão responder as questões do simulado.</span>
                </div>
              </div>
              <Toggle checked={allowAccess} onChange={() => setAllowAccess(v => !v)} ariaLabel="Liberar acesso" />
            </div>

            {/* Seção: Janela de disponibilidade */}
            <div className="grid grid-cols-2 gap-6 border-b border-[#E3E4E5] py-4">
              <div className="flex flex-col gap-2">
                <label className="text-[12px] text-[#737780] font-inter">Data de início</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full h-[40px] px-3 text-[14px] text-[#22252B] font-inter border border-[#E3E4E5] rounded-[4px] bg-[#F8FAFC]"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[12px] text-[#737780] font-inter">Data de fim</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full h-[40px] px-3 text-[14px] text-[#22252B] font-inter border border-[#E3E4E5] rounded-[4px] bg-[#F8FAFC]"
                />
              </div>
            </div>

            {/* Seção: Quem pode acessar */}
            <div className="border-b border-[#E3E4E5] py-4">
              <label className="text-[12px] text-[#737780] font-inter">Quem pode acessar</label>
              <div className="mt-2 grid grid-cols-3 gap-3">
                <button
                  type="button"
                  className={`h-[36px] rounded-[6px] text-[12px] font-inter border ${audience === 'todos' ? 'bg-[#FDFFFF] border-[#E3E4E5] text-[#22252B]' : 'bg-[#F6F5FA] border-transparent text-[#3A3D45]'}`}
                  onClick={() => setAudience('todos')}
                >
                  Todos
                </button>
                <button
                  type="button"
                  className={`h-[36px] rounded-[6px] text-[12px] font-inter border ${audience === 'matriculados' ? 'bg-[#FDFFFF] border-[#E3E4E5] text-[#22252B]' : 'bg-[#F6F5FA] border-transparent text-[#3A3D45]'}`}
                  onClick={() => setAudience('matriculados')}
                >
                  Somente matriculados
                </button>
                <button
                  type="button"
                  className={`h-[36px] rounded-[6px] text-[12px] font-inter border ${audience === 'lista' ? 'bg-[#FDFFFF] border-[#E3E4E5] text-[#22252B]' : 'bg-[#F6F5FA] border-transparent text-[#3A3D45]'}`}
                  onClick={() => setAudience('lista')}
                >
                  Lista personalizada
                </button>
              </div>
              {audience === 'lista' && (
                <div className="mt-3">
                  <label className="text-[12px] text-[#737780] font-inter">E-mails (um por linha)</label>
                  <textarea
                    value={emails}
                    onChange={e => setEmails(e.target.value)}
                    rows={4}
                    className="mt-1 w-full px-3 py-2 text-[12px] text-[#22252B] font-inter border border-[#E3E4E5] rounded-[6px] bg-[#F8FAFC]"
                    placeholder="aluno1@exemplo.com\naluno2@exemplo.com"
                  />
                </div>
              )}
            </div>

            {/* Seção: Limite de tentativas e login */}
            <div className="grid grid-cols-2 gap-6 py-4">
              <div className="flex items-center justify-between h-[40px]">
                <span className="text-[14px] text-[#22252B] font-inter font-medium">Exigir login</span>
                <Toggle checked={requireLogin} onChange={() => setRequireLogin(v => !v)} ariaLabel="Exigir login" />
              </div>
              <div className="flex items-center justify-between h-[40px]">
                <label className="text-[14px] text-[#22252B] font-inter font-medium">Máximo de tentativas</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={maxAttempts}
                  onChange={e => setMaxAttempts(Number(e.target.value) || 1)}
                  className="w-[80px] h-[32px] text-center text-[14px] text-[#22252B] font-inter border border-[#E3E4E5] rounded-[6px] bg-[#F8FAFC]"
                />
              </div>
            </div>

            {/* Ações */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="h-[36px] px-4 rounded-[6px] text-[12px] font-inter bg-[#F6F5FA] text-[#3A3D45]"
                onClick={handleCancel}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="h-[36px] px-4 rounded-[6px] text-[12px] font-inter bg-[#0047BB] text-white"
                onClick={handleSave}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ControleAcessoSimuladosPage;