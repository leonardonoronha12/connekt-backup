import React, { useState } from 'react';

function Badge({ children }) {
  return (
    <span className="inline-flex items-center rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
      {children}
    </span>
  );
}

function StatItem({ label, value, color = 'text-gray-700', icon }) {
  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        data-action="stat-click"
        data-value={label}
        className="flex w-[44px] h-[44px] items-center justify-center rounded-[4px] border border-gray-200 bg-white rotate-0 opacity-100 hover:bg-gray-50"
      >
        {icon}
      </button>
      <span className={`mt-1 text-sm font-semibold ${color}`}>{value}</span>
      <span className="text-[10px] leading-tight text-gray-600">{label}</span>
    </div>
  );
}

function QuestionListItem({ index, label, status }) {
  const statusColor = status === 'correct' ? 'bg-green-500' : status === 'wrong' ? 'bg-red-500' : 'bg-gray-300';
  return (
    <button
      type="button"
      data-action="open-question"
      data-value={index}
      className="flex w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-left hover:bg-gray-50"
    >
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${statusColor}`}></span>
        <span className="text-sm text-gray-700">Questão {index}</span>
      </div>
    </button>
  );
}

function RepostaCorretaSimuladoPage() {
  const [selected, setSelected] = useState(null);
  const [activeQuestion, setActiveQuestion] = useState(8);
  const [showExplanation, setShowExplanation] = useState(false);

  const handleClick = (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.getAttribute('data-action');
    const value = el.getAttribute('data-value');
    switch (action) {
      case 'select-option':
        setSelected(Number(value));
        break;
      case 'open-question':
        setActiveQuestion(Number(value));
        break;
      case 'stat-click':
        // Placeholder para ação de clique em estatística
        break;
      case 'toggle-explanation':
        setShowExplanation((v) => !v);
        break;
      case 'skip':
        // Placeholder para pular questão
        break;
      case 'respond':
        // Placeholder para responder questão
        break;
      default:
        break;
    }
  };

  const questionStatuses = [
    'correct',
    'neutral',
    'wrong',
    'wrong',
    'neutral',
    'wrong',
    'neutral',
    'neutral',
    'neutral',
    'neutral',
  ];

  return (
      <div className="w-[1374px] h-[908px] mx-auto grid grid-cols-12 gap-[32px] pt-[32px] pl-[22px] pr-[22px] mb-[32px] rotate-0 opacity-100" onClick={handleClick}>
        {/* Sidebar esquerdo */}
        <div className="col-span-3 rounded-[4px] bg-white shadow-sm border-r border-gray-200 w-[280px] h-[577.6222534179688px] py-[44px] px-4 flex flex-col gap-[32px] m-0 ml-[-20px] rotate-0 opacity-100">
            <div className="flex flex-col items-center gap-2">
              <div className="h-16 w-16 overflow-hidden rounded-full bg-gray-100">
                <img src="/perfil rc.png" alt="Avatar" className="h-full w-full" />
              </div>
              <div className="text-center">
            <p className="font-inter font-semibold text-[16px] leading-[24px] tracking-[0px] text-gray-800">Dr. Pedro Andrade</p>
            <p className="font-inter font-normal text-[12px] leading-[20px] tracking-[0px] text-gray-500">drpedroandrade@gmail.com</p>
              </div>
            </div>

            <div className="flex items-center justify-end w-[207px] h-[92px] gap-[32px] mx-auto rotate-0 opacity-100">
              <StatItem label="Questões" value={10} />
              <StatItem label="Certas" value={4} color="text-green-600" />
              <StatItem
                label="Erradas"
                value={3}
                color="text-red-600"
                icon={<img src="/erradas.png" alt="Erradas" className="w-3/4 h-3/4 object-contain" />}
              />
            </div>

            <div>
              <div className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2">
                <span className="text-sm text-gray-600">Total de pontos</span>
                <span className="text-sm font-semibold text-gray-800">20</span>
              </div>
            </div>

            <div>
              <label className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2">
                <span className="text-sm text-gray-600">Pular de ponto</span>
                <input type="checkbox" className="h-4 w-4 rounded border-gray-300" />
              </label>
            </div>

            <div className="rounded-md border border-gray-200 bg-white px-3 py-2">
              <p className="text-xs text-gray-600">Tempo restante</p>
              <p className="text-lg font-semibold text-blue-700">00:54:21</p>
            </div>
          </div>

        {/* Conteúdo principal restaurado */}
        <main className="col-span-6 -ml-[32px]">
          <div className="w-[810px] h-[908px] rounded-[4px] pt-[16px] pr-[22px] pb-[16px] pl-[22px] gap-[32px] rotate-0 opacity-100 border border-gray-200 bg-white shadow-sm">
            {/* Cabeçalho alinhado à imagem: "8 Questão" à esquerda e caixas à direita */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center h-[28px] min-w-[28px] rounded-[4px] bg-blue-600 px-2 text-xs font-semibold text-white">8</span>
                <span className="text-sm font-semibold text-gray-800">Questão</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 rounded-[4px] border border-gray-200 bg-white px-3 py-2 shadow-sm">
                  <span className="text-sm font-semibold text-gray-800">20</span>
                  <span className="text-sm text-gray-600">Pontos</span>
                  <span className="h-2 w-2 rounded-full bg-yellow-400"></span>
                </div>
                <div className="flex items-center gap-2 rounded-[4px] border border-gray-200 bg-white px-3 py-2 shadow-sm">
                  <span className="text-sm font-semibold text-gray-800">3</span>
                  <span className="text-sm text-gray-600">Tentativas</span>
                </div>
              </div>
            </div>

            {/* Texto da questão conforme a imagem */}
            <div className="space-y-4 text-sm leading-[22px] text-gray-800">
              <p>Um paciente de 64 anos, hipertenso e diabético, chega ao pronto-socorro com hemiparesia esquerda súbita há 2 horas. A TC de crânio sem contraste (mostrada na imagem) evidencia área hipodensa compatível com AVC isquêmico em território da artéria cerebral média direita.</p>
              <p>Qual a conduta inicial mais adequada?</p>
            </div>

            {/* Imagem da questão */}
            <img src="/resposta correta.png" alt="Imagem da questão" className="mt-4 w-full h-[360px] rounded-[4px] object-cover" />
          </div>

          {/* Estatísticas removidas do main: restauradas na sidebar esquerda */}
        </main>

        {/* Sidebar direito (wrapper removido) */}
          <div className="col-span-3 w-[220px] h-[908px] ml-auto mr-[-22px] flex flex-col gap-[32px] rotate-0 opacity-100">
            <div className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
              <p className="text-xs text-gray-500">Aproveitamento</p>
              <div className="mx-auto mt-2 flex h-24 w-24 items-center justify-center rounded-full border-8 border-blue-600">
                <span className="text-xl font-bold text-blue-700">62%</span>
              </div>
              <img src="/favicon.svg" alt="Connekt" className="mx-auto mt-3 h-6" />
            </div>

            <div className="flex flex-col gap-2">
              {questionStatuses.map((st, i) => (
                <QuestionListItem key={i} index={i + 1} status={st} />
              ))}
            </div>
          </div>
      </div>
  );
}

export default RepostaCorretaSimuladoPage;