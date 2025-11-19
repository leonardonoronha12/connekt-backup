import React, { useEffect, useState, useRef } from 'react';

function Badge({ children }) {
  return (
    <span className="inline-flex items-center rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
      {children}
    </span>
  );
}

function StatItem({ label, value, color = 'text-gray-700', icon, labelFirst = false }) {
  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        data-action="stat-click"
        data-value={label}
        className="flex w-[44px] h-[44px] items-center justify-center rounded-[4px] border border-transparent bg-white rotate-0 opacity-100 hover:bg-gray-50"
      >
        {icon}
      </button>
      {labelFirst ? (
        <>
          <span className="mt-1 font-inter font-medium text-[12px] leading-[16px] tracking-[0px] text-[#22252b]">{label}</span>
          <span className="font-inter font-semibold text-[16px] leading-[24px] tracking-[0px] text-[#22252B]">{value}</span>
        </>
      ) : (
        <>
          <span className="mt-1 font-inter font-semibold text-[16px] leading-[24px] tracking-[0px] text-[#22252B]">{value}</span>
          <span className="mt-1 font-inter font-medium text-[12px] leading-[16px] tracking-[0px] text-[#22252b]">{label}</span>
        </>
      )}
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
      className="flex w-[220px] h-[36px] items-center justify-between rounded border border-transparent bg-white px-4 py-2 text-left opacity-100 hover:bg-gray-50 rotate-0"
    >
      <div className="flex items-center gap-3">
        <span className={`${statusColor} inline-flex items-center justify-center rounded-full ${statusColor === 'bg-green-500' || statusColor === 'bg-gray-300' || statusColor === 'bg-red-500' ? 'w-[16.250003814697266px] h-[16.250003814697266px]' : 'w-2 h-2'}`}>
          {statusColor === 'bg-red-500' ? (
            <img src="/errada.png" alt="Errada" className="w-full h-full rotate-0 opacity-100 object-contain" />
          ) : (statusColor === 'bg-green-500' || statusColor === 'bg-gray-300') ? (
            <img src="/certa.png" alt="Certa" className="w-full h-full rotate-0 opacity-100 object-contain" />
          ) : null}
        </span>
        <span className="font-inter font-medium text-[14px] leading-[16px] tracking-[0px] text-[#22252B]">Questão {index}</span>
      </div>
    </button>
  );
}

function AproveitamentoCircle({ percent = 0 }) {
  const p = Math.max(0, Math.min(100, Number(percent) || 0));
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const dash = (p / 100) * circumference;
  const angle = (p / 100) * 360 - 90;
  const cx = 50 + radius * Math.cos((angle * Math.PI) / 180);
  const cy = 50 + radius * Math.sin((angle * Math.PI) / 180);
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full rotate-0 opacity-100">
      <circle cx="50" cy="50" r={radius} fill="none" stroke="#E3E4E5" strokeWidth="6" />
      <circle
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        stroke="#0047BB"
        strokeWidth="6"
        strokeDasharray={`${dash} ${circumference}`}
        transform="rotate(-90 50 50)"
      />
      <circle cx={cx} cy={cy} r="3.5" fill="#0047BB" />
    </svg>
  );
}

function RepostaCorretaSimuladoPage() {
  const [activeQuestion, setActiveQuestion] = useState(1);
  const [preview, setPreview] = useState({
    title: '',
    totalPoints: 0,
    attempts: 1,
    durationMinutes: 0,
    questions: [],
  });
  const [questionStatuses, setQuestionStatuses] = useState([]); // 'neutral' | 'correct' | 'wrong'
  const [selectedIndices, setSelectedIndices] = useState([]); // índice selecionado por questão
  const [aproveitamentoPercent, setAproveitamentoPercent] = useState(0);
  const [remainingMs, setRemainingMs] = useState(0);
  const endTimeRef = useRef(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('simulationPreview');
      if (raw) {
        const parsed = JSON.parse(raw);
        setPreview({
          title: parsed?.title || '',
          totalPoints: Number(parsed?.totalPoints) || 0,
          attempts: Number(parsed?.attempts) || 1,
          durationMinutes: Number(parsed?.durationMinutes) || 0,
          questions: Array.isArray(parsed?.questions) ? parsed.questions : [],
        });
        const total = Array.isArray(parsed?.questions) ? parsed.questions.length : 0;
        setQuestionStatuses(Array.from({ length: Math.max(total, 1) }, () => 'neutral'));
        setSelectedIndices(Array.from({ length: Math.max(total, 1) }, () => null));
        setActiveQuestion(1);

        // Inicializa o cronômetro com base na duração em minutos
        const durationMs = Math.max(0, (Number(parsed?.durationMinutes) || 0) * 60_000);
        endTimeRef.current = Date.now() + durationMs;
        setRemainingMs(durationMs);
      }
    } catch (err) {
      console.warn('Falha ao carregar simulationPreview:', err);
    }
  }, []);

  // Atualiza o cronômetro a cada segundo com base no horário final calculado
  useEffect(() => {
    const tick = () => {
      if (!endTimeRef.current) return;
      const now = Date.now();
      const rest = Math.max(0, endTimeRef.current - now);
      setRemainingMs(rest);
    };
    // Executa um tick inicial para sincronizar imediatamente
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const totalQuestions = Array.isArray(preview.questions) ? preview.questions.length : 0;

  const handleClick = (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.getAttribute('data-action');
    const value = el.getAttribute('data-value');
    switch (action) {
      case 'select-option':
        {
          const idx = Number(value);
          const q = preview.questions?.[activeQuestion - 1];
          const choices = Array.isArray(q?.choices) ? q.choices : [];
          const isCorrect = !!choices[idx]?.is_correct;
          setSelectedIndices((prev) => {
            const next = [...prev];
            next[activeQuestion - 1] = idx;
            return next;
          });
          setQuestionStatuses((prev) => {
            const next = [...prev];
            next[activeQuestion - 1] = isCorrect ? 'correct' : 'wrong';
            return next;
          });
          // Atualiza aproveitamento
          setAproveitamentoPercent((prevPct) => {
            const correctCount = questionStatuses.reduce((acc, st, i) => acc + (i === activeQuestion - 1 ? (isCorrect ? 1 : 0) : (st === 'correct' ? 1 : 0)), 0);
            const pct = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
            return pct;
          });
        }
        break;
      case 'open-question':
        setActiveQuestion(Number(value));
        break;
      case 'skip':
        // Pular para próxima questão
        setActiveQuestion((q) => Math.min(q + 1, Math.max(totalQuestions, 1)));
        break;
      default:
        break;
    }
  };

  // Seleção/Corretas para questão ativa
  const selectedForActive = selectedIndices?.[activeQuestion - 1];
  const qActive = preview.questions?.[activeQuestion - 1] || {};
  const choicesActive = Array.isArray(qActive?.choices) ? qActive.choices : [];
  const correctIdxActive = choicesActive.findIndex((c) => !!c?.is_correct);

  function formatTime(ms) {
    const totalSec = Math.floor((Number(ms) || 0) / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (v) => String(v).padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  return (
      <div className="w-[1374px] h-[908px] mx-auto grid grid-cols-12 items-start gap-[32px] pt-[32px] pl-[22px] pr-[22px] mb-[32px] rotate-0 opacity-100" onClick={handleClick}>
        {/* Sidebar esquerdo */}
        <div className="col-span-3 rounded-[4px] bg-white border-r border-transparent w-[280px] h-[577.6222534179688px] py-[44px] px-4 flex flex-col gap-[32px] m-0 ml-[-20px] rotate-0 opacity-100">
            <div className="flex flex-col items-center gap-2">
              <div className="h-16 w-16 overflow-hidden rounded-full bg-gray-100">
                <img src="/perfil rc.png" alt="Avatar" className="h-full w-full" />
              </div>
              <div className="text-center">
            <p className="font-inter font-semibold text-[16px] leading-[24px] tracking-[0px] text-gray-800">{preview.title || 'Simulado'}</p>
            <p className="font-inter font-normal text-[12px] leading-[20px] tracking-[0px] text-gray-500">Preview</p>
              </div>
            </div>

            <div className="flex items-center justify-end w-[207px] h-[92px] gap-[32px] mx-auto rotate-0 opacity-100">
              <StatItem
                label="Questões"
                value={totalQuestions}
                icon={<img src="/questoes.png" alt="Questões" className="w-[44px] h-[44px] object-contain" />}
                labelFirst
              />
              <StatItem
                label="Certas"
                value={0}
                color="text-green-600"
                icon={<img src="/certas.png" alt="Certas" className="w-[44px] h-[44px] object-contain" />}
                labelFirst
              />
              <StatItem
                label="Erradas"
                value={0}
                color="text-red-600"
                icon={<img src="/erradas.png" alt="Erradas" className="w-[44px] h-[44px] object-contain" />}
                labelFirst
              />
            </div>

            <div>
              <div className="w-[207px] h-[40px] rounded-[4px] bg-[#F6F5FA] p-[12px] flex items-center justify-between gap-[8px] rotate-0 opacity-100 mx-auto">
                <span className="inline-flex items-center gap-[1px] font-inter font-medium text-[12px] leading-[16px] tracking-[0px] text-[#22252B]">
                  <img src="/pontos.png" alt="Pontos" className="w-[14px] h-[14px] rounded-[600px] p-[1px] rotate-0 opacity-100 object-contain" />
                  Total de pontos
                </span>
              <span className="inline-block w-[0.5px] h-[30px] bg-gray-200"></span>
                <span className="text-sm font-semibold text-gray-800">{preview.totalPoints}</span>
              </div>
            </div>

            <div>
              {/* Label "Pular de ponto" removido conforme solicitado */}
            </div>

            <div className="w-[207px] h-[97px] rounded-[4px] border border-transparent bg-[#F6F5FA] p-[12px] flex flex-col gap-[16px] rotate-0 opacity-100 mx-auto">
              <div className="w-[183px] h-[26px] flex flex-col gap-[8px] rotate-0 opacity-100">
                <p className="font-inter font-medium text-[12px] leading-[16px] tracking-[0px] text-[#22252B]"><img src="/Tempo.png" alt="Tempo" className="inline-block h-[14px] w-[14px] mr-[1px] align-middle rotate-0 opacity-100 rounded-[600px] p-[1px]" /> Tempo restante</p>
                <hr className="w-full border-t border-gray-200" />
              </div>
              <p className="font-inter font-semibold text-[24px] leading-[24px] tracking-[0px] text-center text-[#0047BB]">{formatTime(remainingMs)}</p>
            </div>
          </div>

        {/* Conteúdo principal restaurado */}
        <main className="col-span-6 -ml-[32px]">
        <div className="w-[810px] h-[908px] rounded-[4px] pt-[16px] pr-[22px] pb-[16px] pl-[22px] flex flex-col gap-[18px] rotate-0 opacity-100 border border-transparent bg-white">
            {/* Bloco conteúdo: cabeçalho movido para dentro deste container */}
            <div className="w-[766px] h-[541px] rotate-0 opacity-100 flex flex-col gap-[18px]">
              {/* Cabeçalho + linha agrupados em contêiner 766x48 */}
              <div className="w-[766px] h-[48px] rotate-0 opacity-100 flex flex-col justify-between pb-[8px] border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center h-[28px] min-w-[28px] rounded-[4px] bg-blue-600 px-2 text-[14px] leading-[16px] tracking-[0px] font-medium text-[#F6F5FA]">{activeQuestion}</span>
                    <span className="text-sm font-semibold text-gray-800">Questão</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center w-[117px] h-[40px] gap-[8px] rounded-[4px] bg-[#F6F5FA] p-[12px] rotate-0 opacity-100">
                      <span className="text-sm font-semibold text-gray-800">{preview.totalPoints}</span>
                      <span className="inline-block w-[0.5px] h-[30px] bg-gray-200"></span>
                      <span className="font-inter font-medium text-[12px] leading-[16px] tracking-[0px] text-[#22252B]">Pontos</span>
                      <img src="/pontos.png" alt="Pontos" className="h-[14px] w-[14px] rotate-0 opacity-100 rounded-[600px] p-[1px]" />
                    </div>
                    <div className="flex items-center w-[117px] h-[40px] gap-[8px] rounded-[4px] bg-[#F6F5FA] p-[12px] rotate-0 opacity-100">
                      <span className="text-sm font-semibold text-gray-800">{preview.attempts}</span>
                      <span className="inline-block w-[0.5px] h-[30px] bg-gray-200"></span>
                      <span className="font-inter font-medium text-[12px] leading-[16px] tracking-[0px] text-[#22252B]">Tentativas</span>
                      <img src="/Tentativas.png" alt="Tentativas" className="h-[14px] w-[14px] rotate-0 opacity-100 rounded-[600px] p-[1px]" />
                    </div>
                  </div>
                </div>
                <hr className="w-full border-t border-transparent" />
              </div>
      <div className="text-sm leading-[22px] text-gray-800 w-[746px] h-[150px] rotate-0 opacity-100 flex flex-col justify-between">
                <p className="font-inter font-normal text-[14px] leading-[22px] tracking-[0px] text-[#22252B]">
                  {(() => {
                    const q = preview.questions?.[activeQuestion - 1]
                    return q?.stem || q?.name || 'Selecione questões no criador para visualizar aqui.'
                  })()}
                </p>
              </div>

              {/* Imagem da questão */}
              <img src="/resposta correta.png" alt="Imagem da questão" className="w-full h-[360px] rounded-[4px] object-cover" />
            </div>
        <div className="w-[766px] min-h-[120px] rotate-0 opacity-100 flex flex-col gap-[12px] pb-[22px]">
          {(() => {
            const choices = choicesActive;
            if (choices.length === 0) {
              return (
                <div className="text-virtualBlack text-sm">Nenhuma alternativa disponível para esta questão.</div>
              )
            }
            return (
              <>
                {choices.map((c, i) => {
                  const isSelected = selectedForActive === i;
                  const isCorrect = !!c?.is_correct;
                  const borderColor = isSelected ? (isCorrect ? 'border-green-500' : 'border-red-500') : 'border-transparent';
                  const bgColor = isSelected ? (isCorrect ? 'bg-green-50' : 'bg-red-50') : 'bg-[#F6F5FA]';
                  return (
                    <div key={i} className="w-[766px] h-[46px] flex flex-row items-center gap-[18px] rotate-0 opacity-100">
                      <button
                        type="button"
                        data-action="select-option"
                        data-value={i}
                        className={`inline-flex items-center justify-center w-[34px] h-[46px] rounded-[4px] border ${borderColor} ${bgColor} px-[8px] py-[8px] gap-[12px] rotate-0 opacity-100 text-[#22252B] text-[14px] leading-[20px] tracking-[0px] font-semibold`}
                      >
                        {String.fromCharCode(65 + i)}
                      </button>
                      <button
                        type="button"
                        data-action="select-option"
                        data-value={i}
                        className={`inline-flex items-center justify-between w-[714px] h-[46px] rounded-[4px] ${bgColor} pt-[8px] pb-[8px] pr-[12px] pl-[12px] gap-[12px] rotate-0 opacity-100 text-[#22252B] text-[14px] leading-[20px] tracking-[0px] font-normal text-left border ${borderColor}`}
                      >
                        {c?.label || ''}
                      </button>
                    </div>
                  );
                })}
                {typeof selectedForActive === 'number' && questionStatuses[activeQuestion - 1] === 'wrong' && correctIdxActive >= 0 && (
                  <div className="mt-2 text-sm text-red-700">
                    Resposta correta: {String.fromCharCode(65 + correctIdxActive)} — {choicesActive[correctIdxActive]?.label || ''}
                  </div>
                )}
              </>
            )
          })()}
        </div>
              {/* Nova div adicionada conforme solicitado, com um botão dentro */}
              <div className="w-[766px] h-[46px] relative flex flex-row items-center justify-end gap-[18px] rotate-0 opacity-100">
                <span className="absolute left-0 bottom-0 font-inter font-normal text-[12px] leading-[20px] tracking-[0px] text-[#737780]">Questão {activeQuestion} / {totalQuestions || 1}</span>
                <button
                  type="button"
                  data-action="skip"
                  className="inline-flex items-center justify-center w-[75px] h-[35px] rounded-[4px] border-[1px] border-[#0047BB] bg-[#F6F5FA] pt-[10px] pr-[20px] pb-[10px] pl-[20px] gap-[8px] rotate-0 opacity-100 font-inter text-center text-[#0047BB] text-[14px] leading-[20px] tracking-[0px] font-semibold"
                >
                  Pular
                </button>
              </div>
          </div>

          {/* Estatísticas removidas do main: restauradas na sidebar esquerda */}
        </main>

        {/* Sidebar direito (wrapper removido) */}
          <div className="col-span-3 w-[220px] h-[908px] ml-auto mr-[-22px] flex flex-col gap-[32px] rotate-0 opacity-100">
            <div className="rounded-xl border border-transparent bg-white p-4 text-center">
              <div className="mx-auto mt-2 relative w-[170.59893798828125px] h-[88.31529235839844px]">
                <AproveitamentoCircle percent={aproveitamentoPercent} />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="font-inter font-bold text-[31.99px] leading-[34.45px] tracking-[0px] text-center text-[#22252B]">{aproveitamentoPercent}%</span>
                </div>
              </div>
              <p className="font-inter font-medium text-[12px] leading-[16px] tracking-[0px] text-center text-[#22252B] mt-[10px]">Aproveitamento</p>
              <img src="/logo connekt.png" alt="Connekt" className="mx-auto mt-3 w-[99.375px] h-[29.71004867553711px] rotate-0 opacity-100" />
            </div>

            <div className="flex flex-col gap-2">
              {(Array.isArray(preview?.questions) && preview.questions.length > 0
                ? preview.questions
                : Array.from({ length: Math.max(totalQuestions || 1, 1) }))
                .map((_, i) => (
                  <QuestionListItem key={i} index={i + 1} status={questionStatuses[i] || 'neutral'} />
                ))}
            </div>
          </div>
      </div>
  );
}

export default RepostaCorretaSimuladoPage;