import React from 'react';
import { Helmet } from 'react-helmet-async';

// Ícone de progresso animado que acompanha a porcentagem indicada
const AnimatedProgressIcon = ({ percent = 0, color = '#22C55E', size = 28, strokeWidth = 2 }) => {
  const radius = 9; // compatível com viewBox 20x20
  const circumference = 2 * Math.PI * radius;
  const p = Math.max(0, Math.min(Number(percent) || 0, 100));
  const dashoffset = circumference * (1 - p / 100);

  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      {/* círculo base com a mesma espessura */}
      <circle cx="10" cy="10" r={radius} stroke="#FAFAFA" strokeWidth={strokeWidth} fill="none" />
      {/* arco de progresso com a mesma espessura */}
      <circle
        cx="10"
        cy="10"
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={dashoffset}
        strokeLinecap="round"
        transform="rotate(-90 10 10)"
        style={{ transition: 'stroke-dashoffset 700ms ease' }}
      />
    </svg>
  );
};

const StatBadge = ({ color, label, value, inline = false, groupBelow = false, stacked = false, iconSrc, valueFirst = false }) => (
  inline ? (
            <div className="flex items-center gap-2">
      <span className="text-[14px] text-[#22252B] font-inter font-normal not-italic">{label}</span>
      <span className="text-[14px] text-[#22252B] font-inter font-semibold not-italic">{value}</span>
    </div>
  ) : stacked ? (
    <div className="flex flex-col items-start gap-2">
      {valueFirst ? (
        <>
          <span className="text-[14px] text-[#22252B] font-inter font-semibold not-italic">{value}</span>
          <span className="text-[14px] text-[#22252B] font-inter font-normal not-italic">{label}</span>
        </>
      ) : (
        <>
          <span className="text-[14px] text-[#22252B] font-inter font-normal not-italic">{label}</span>
          <span className="text-[14px] text-[#22252B] font-inter font-semibold not-italic">{value}</span>
        </>
      )}
    </div>
  ) : groupBelow ? (
    <div className="flex flex-col items-center gap-2">
      <span className="text-[14px] text-[#22252B] font-inter font-normal not-italic">{label}</span>
      <div className="inline-flex items-center gap-2">
        <span className="inline-flex items-center justify-center w-[28px] h-[28px]">
          {iconSrc ? (
            <AnimatedProgressIcon
              percent={typeof value === 'string' ? parseFloat(value) : Number(value) || 0}
              color={color}
              size={28}
              iconSrc={iconSrc}
            />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <circle cx="10" cy="10" r="9" stroke={color} strokeWidth="2" />
              <path d="M6 10l2 2 6-6" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
        <span className="text-[14px] text-[#22252B] font-inter font-semibold not-italic">{value}</span>
      </div>
    </div>
  ) : (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center justify-center w-5 h-5">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="10" cy="10" r="9" stroke={color} strokeWidth="2" />
          <path d="M6 10l2 2 6-6" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <div className="flex flex-col">
        <span className="text-[14px] text-[#22252B] font-inter font-normal not-italic">{label}</span>
        <span className="text-[14px] text-[#22252B] font-inter font-semibold not-italic">{value}</span>
      </div>
    </div>
  )
);

const Option = ({ letter, children, percent = 0, responses = 0, barColor = '#EF4444' }) => (
  <div className="space-y-0">
    <div className="flex flex-col gap-0">
      {/* Linha única com letra e texto juntos */}
      <div className="flex items-center gap-2 h-[30px] text-[14px] font-inter">
        <span className="text-[14px] text-[#22252B] font-normal not-italic font-inter h-[30px] flex items-center">{letter}.</span>
        <div className="text-[14px] text-[#22252B] font-normal not-italic font-inter leading-relaxed h-[30px] flex items-center">{children}</div>
      </div>

      {/* Rótulo e barra de progresso abaixo, na mesma linha, sem espaçamento vertical */}
      <div className="mt-0 flex items-center gap-2 h-[20px]">
        <span className="text-[12px] text-[#ABADB3] font-inter font-normal not-italic h-[20px] flex items-center">{responses} resp., {percent}%</span>
        <div
          className="relative w-[291px] h-[8px] bg-[#EDECEF] rounded-full overflow-hidden"
          aria-label={`Progresso horizontal ${percent}%`}
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="absolute left-0 top-0 h-[8px]"
            style={{ width: `${Math.max(0, Math.min(percent, 100))}%`, backgroundColor: barColor }}
          />
        </div>
      </div>
    </div>
  </div>
);

const ParticipantsPanel = ({ query }) => {
  const [statusFilter, setStatusFilter] = React.useState('todos'); // 'todos' | 'aprovado' | 'reprovado'
  const rows = [
    { name: 'Ana Souza', email: 'ana.souza@example.com', status: 'aprovado', score: 85, submissions: 3 },
    { name: 'Carlos Lima', email: 'carlos.lima@example.com', status: 'reprovado', score: 42, submissions: 2 },
    { name: 'Mariana Alves', email: 'mariana.alves@example.com', status: 'aprovado', score: 91, submissions: 4 },
    { name: 'João Pereira', email: 'joao.pereira@example.com', status: 'reprovado', score: 38, submissions: 1 },
    { name: 'Beatriz Gomes', email: 'beatriz.gomes@example.com', status: 'aprovado', score: 77, submissions: 3 },
    // Linhas extras copiando as existentes para preencher até o final
    { name: 'Ana Souza', email: 'ana.souza@example.com', status: 'aprovado', score: 85, submissions: 3 },
    { name: 'Carlos Lima', email: 'carlos.lima@example.com', status: 'reprovado', score: 42, submissions: 2 },
    { name: 'Mariana Alves', email: 'mariana.alves@example.com', status: 'aprovado', score: 91, submissions: 4 },
  ];

  const filtered = rows.filter(r => {
    const matchesStatus = statusFilter === 'todos' ? true : r.status === statusFilter;
    const q = query.trim().toLowerCase();
    const matchesQuery = q === '' ? true : (r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q));
    return matchesStatus && matchesQuery;
  });

  return (
    <div className="w-full h-[488px] flex flex-col opacity-100 rotate-0">
      {/* Header */}
      <div className="px-0 h-[56px] border-b border-[#E3E4E5] flex items-center">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-0">
            <span className="inline-flex items-center gap-0 w-[430px] h-[56px] pt-0 pr-0 pb-0 pl-[20px] opacity-100 rotate-0 text-[12px] leading-[100%] tracking-[0] font-inter font-medium not-italic text-[#22252B]">Cliente</span>
          </div>
          <div className="flex items-center gap-0">
            <div className="flex items-center gap-0 rounded px-0 py-0">
              <span className="inline-flex items-center justify-center gap-0 w-[161.5px] h-[56px] pt-0 pr-0 pb-0 pl-0 opacity-100 rotate-0 text-[12px] text-[#22252B] font-inter font-medium not-italic leading-[100%] tracking-[0]">Data de início</span>
              <span className="inline-flex items-center justify-center gap-0 w-[161.5px] h-[56px] pt-0 pr-0 pb-0 pl-0 opacity-100 rotate-0 text-[12px] text-[#22252B] font-inter font-medium not-italic leading-[100%] tracking-[0]">Data de fim</span>
              <span className="inline-flex items-center justify-center gap-0 w-[161.5px] h-[56px] pt-0 pr-0 pb-0 pl-0 opacity-100 rotate-0 text-[12px] text-[#22252B] font-inter font-medium not-italic leading-[100%] tracking-[0]">Pontuação</span>
            </div>
            <div className="flex items-center gap-0">
              <span className="inline-flex items-center justify-center gap-0 w-[161.5px] h-[56px] pt-0 pr-0 pb-0 pl-0 opacity-100 rotate-0 text-[12px] text-[#22252B] font-inter font-medium not-italic leading-[100%] tracking-[0]">Aproveitamento</span>
            </div>
          </div>
        </div>
      {/* contador removido */}
      </div>

      {/* Body */}
      <div className="p-0 overflow-y-auto">
        <div className="rounded-lg overflow-hidden">
          {/* Cabeçalho da tabela removido conforme solicitado */}
          {filtered.map((r, idx) => (
          <div
            key={idx}
            className={`grid grid-cols-[430px_161.5px_0px_161.5px_161.5px_auto] items-center px-0 py-0 h-[54px] ${idx !== 0 ? 'border-t border-[#E3E4E5]' : ''} ${idx === filtered.length - 1 ? 'border-b border-[#E3E4E5]' : ''} bg-white`}
          >
              <div className="inline-flex items-center gap-[10px] w-[430px] h-[54px] pl-[20px] opacity-100 rotate-0">
                <img src="/Avatar.png" alt="Avatar" className="w-[34px] h-[34px] rounded" />
                <div className="flex flex-col leading-[16px] gap-[4px]">
                  <span className="text-[12px] text-[#737780] font-inter font-normal not-italic leading-[100%] tracking-[0]">{r.name}</span>
                  <span className="text-[12px] text-[#333740] font-inter font-normal not-italic leading-[100%] tracking-[0]">pedrosa.22@yahoo.com</span>
                </div>
              </div>
              <div className="inline-flex items-center justify-center gap-0 w-[161.5px] h-[54px] pl-0 opacity-100 rotate-0 text-[14px] text-[#1B2128] font-inter font-normal not-italic leading-[100%] tracking-[0]">02/09/2025</div>
              <div className="flex items-center gap-2"></div>
              <div className="inline-flex items-center justify-center gap-0 w-[161.5px] h-[54px] pl-0 opacity-100 rotate-0 text-[14px] text-[#1B2128] font-inter font-normal not-italic leading-[100%] tracking-[0]">02/09/2025</div>
            <div className="inline-flex items-center justify-center gap-[10px] w-[161.5px] h-[54px] p-[2px] opacity-100 rotate-0 text-[12px] text-[#22252B] font-inter font-medium not-italic leading-[20px] tracking-[0]">
              <span className="text-[12px] text-[#22252B] font-inter font-medium not-italic leading-[20px] tracking-[0]">30 Pontos</span>
              <img src="/pontos 1.png" alt="Pontos" className="w-[18px] h-[18px] object-contain select-none pointer-events-none" />
            </div>
              <div className="flex items-center justify-center gap-2">
                <div className="inline-flex items-center justify-center gap-[8px] w-[161.5px] h-[54px] opacity-100 rotate-0">
                  <span className="inline-flex items-center justify-center w-[28px] h-[28px]">
                    <AnimatedProgressIcon percent={60} color="#0047BB" size={28} strokeWidth={2} />
                  </span>
                  <span className="text-[14px] text-[#22252B] font-inter font-semibold not-italic">60%</span>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="px-4 py-6 text-center text-[12px] text-[#737780]">Nenhum participante encontrado.</div>
          )}
        </div>
      </div>
    </div>
  );
};

const SimuladosAproveitamentoPage = () => {
  const [viewMode, setViewMode] = React.useState('estatistica');
  const [participantsQuery, setParticipantsQuery] = React.useState('');
  const [selectedFilterIndex, setSelectedFilterIndex] = React.useState(null);
  return (
    <div className="min-h-screen bg-[#FFFFFF]">
      <Helmet>
        <title>Simulados – Aproveitamento</title>
        <meta name="description" content="Resumo de aproveitamento do simulado." />
      </Helmet>

      {/* Botão de voltar movido para o Header quando nesta rota */}

      <div className="pt-8 px-6 pb-10">
        <div className="flex items-start justify-between">
          <div className="space-y-[16px]">
            <div className="inline-flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-[64px] h-[18px] px-3 text-[10px] bg-[#E9FFEF] text-[#06C270] rounded-[54px] leading-none font-medium">Publicado</span>
            </div>
            <div className="space-y-[6px]">
              <h1 className="text-[18px] font-semibold text-[#000000] font-inter">Nome do simulado aqui</h1>
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-1 text-[12px] font-normal h-[20px] w-[86px] px-2 py-0 rounded-[4px]"
                  style={{ backgroundColor: 'rgba(173, 137, 247, 0.1)', color: 'rgb(34, 37, 43)' }}
                >
                  <span className="leading-none text-[7px] text-[#06C270]">🟪</span>
                  <span className="text-[12px] text-[#22252B] font-normal not-italic font-inter">Categoria</span>
                </span>
                <span
                   className="inline-flex items-center gap-1 text-[12px] font-normal h-[20px] w-[86px] px-2 py-0 rounded-[4px]"
                   style={{ backgroundColor: '#E9FFEF', color: 'rgb(34, 37, 43)' }}
                >
                   <span className="leading-none text-[7px] text-[#06C270]">🟩</span>
                   <span className="text-[12px] text-[#22252B] font-normal not-italic font-inter">Categoria</span>
                </span>
              </div>
            </div>
            <div className="text-[14px] font-inter font-normal text-[#22252B] flex items-center gap-2">
              <img src="/Produtos - Cores.png" alt="Produtos - Cores" className="w-[20px] h-[20px] rounded-[4px]" />
              <span className="text-[14px] font-inter font-semibold text-[#000000]">Simulado:</span> 10 Questões · Criado em: 20 de Agosto de 2025
            </div>
            <div className="space-y-[32px]">
              <div className="grid grid-cols-3 gap-6">
                <StatBadge color="#22C55E" label="Aprovação (%)" value="60%" groupBelow iconSrc="/progresso verde.png" />
                <StatBadge color="#FF3B3B" label="Reprovação (%)" value="40%" groupBelow iconSrc="/progresso vermelho.png" />
                <StatBadge label="Submissões" value="1200" stacked />
              </div>
              
            </div>
          </div>
          <div className="w-[342px] h-[207.34px] rounded-lg overflow-hidden shadow-sm border border-[#E3E4E5] bg-[#FFFFFF]">
            <img src="/Capas de Curso.png" alt="Capas de Curso" className="w-[342px] h-[207.34px] object-cover" />
          </div>
        </div>
        <div className="mt-4 space-y-[32px]">
          <div className="flex items-center justify-between w-[1076px] h-[42px] opacity-100">
            <div className="flex items-center gap-2 w-[232px] h-[42px] pt-[4px] pr-[8px] pb-[4px] pl-[8px] rounded-[50px] bg-[#F6F5FA] opacity-100">
              <button
                className={`w-[96px] h-[34px] box-border pt-[8px] pr-[18px] pb-[8px] pl-[18px] flex items-center justify-center gap-[1px] text-[12px] rounded-[50px] opacity-100 ${viewMode === 'estatistica' ? 'bg-[#FDFFFF] text-[#22252B]' : 'bg-[#F6F5FA] text-[#22252B]'}`}
                onClick={() => setViewMode('estatistica')}
              >
                Estatística
              </button>
              <button
                className={`w-[96px] h-[34px] box-border pt-[8px] pr-[18px] pb-[8px] pl-[18px] flex items-center justify-center gap-[1px] text-[12px] rounded-[50px] opacity-100 ${viewMode === 'participantes' ? 'bg-[#FDFFFF] text-[#3A3D45]' : 'bg-[#F6F5FA] text-[#3A3D45]'}`}
                onClick={() => setViewMode('participantes')}
              >
                Participantes
              </button>
            </div>
            <div className="flex items-center gap-[12px] w-[421px]">
              {viewMode === 'participantes' && (
                <input
                  type="text"
                  value={participantsQuery}
                  onChange={(e) => setParticipantsQuery(e.target.value)}
                  placeholder="Buscar aluno pelo nome"
                  className="w-[328px] h-[40px] pt-[12px] pr-[16px] pb-[12px] pl-[40px] text-[14px] text-[#ABADB3] font-inter font-normal not-italic leading-[20px] tracking-[0] border border-[#E3E4E5] rounded-[4px] bg-[#F8FAFC] opacity-100 rotate-0 placeholder:text-[#ABADB3] box-border"
                  style={{
                    backgroundImage: "url('/search simulados 1.png')",
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: '12px center',
                    backgroundSize: '18px 18px'
                  }}
                />
              )}
              {viewMode === 'participantes' && (
                <button
                  className="w-[81px] h-[40px] box-border pt-[8px] pr-[18px] pb-[8px] pl-[18px] flex items-center justify-center gap-[8px] text-[14px] leading-[23px] font-normal tracking-[0px] not-italic rounded-[4px] bg-[#F8FAFC] border border-[#E3E4E5] text-[#22252B] opacity-100 rotate-0"
                  style={{ fontFamily: 'Inter' }}
                >
                  <span>Filtrar</span>
                </button>
              )}
            </div>
          </div>
          <div className="border border-[#E3E4E5] rounded-[12px] bg-[#FFFFFF] w-[1076px] h-auto opacity-100 rotate-0">
            {viewMode === 'participantes' ? (
              <ParticipantsPanel query={participantsQuery} />
            ) : (
              <>
                    <div className="px-0 py-3">
            <div className="flex items-center justify-between box-border h-[52px] border-b border-[#E3E4E5] w-full px-[8px]">
              <div className="flex items-center gap-2 w-[185px] h-[40px]">
                <img src="/questão.png" alt="Questão" className="w-[14px] h-[14px]" />
                <span className="text-[12px] font-medium text-[#22252B]">Questão de múltipla escolha</span>
              </div>
              <div className="flex items-center text-[12px] text-[#737780] h-[40px]">
                <button className="p-0 bg-transparent border-0">
                  <img src="/Button filtrar.png" alt="Filtrar" className="select-none pointer-events-none" />
                </button>
              </div>
            </div>
                    </div>

                <div className="p-5 -mt-[20px]">
                  {/* Enunciado e imagem */}
                    <div className="flex items-start justify-start w-[1005.62890625px] h-[188px] gap-x-[18px]">
                      <img src="/Capas de Curso.png" alt="Capas de Curso" className="w-[227.63px] h-[138px] object-cover rounded-[8.59px] opacity-100" />
                    <div className="flex flex-col items-start text-left w-[746px] h-[188px] opacity-100 text-[14px] text-[#22252B] font-inter font-normal not-italic leading-[20px] tracking-[0]">
                      <div className="inline-flex items-center gap-2 h-[20px]">
                        <span className="w-[20px] h-[20px] rounded-[4px] grid place-items-center text-[12px] text-[#FFFFFF] bg-[#0047BB]">1</span>
                        <div className="h-[20px] flex items-center">
                          <span className="text-[14px] text-[#22252B] font-inter font-medium not-italic leading-[16px] tracking-[0]">Questão</span>
                        </div>
                      </div>
                      <div className="text-[14px] text-[#22252B] font-inter font-normal not-italic leading-[20px] tracking-[0] mt-[30px]">Um paciente de 54 anos, hipertenso e diabético, chega ao pronto-socorro com hemiparesia esquerda súbita há<br />2 horas. A TC de crânio sem contraste (mostrada na imagem) evidencia área hipodensa compatível com AVC<br />isquêmico em território de artéria cerebral média direita.</div>
                      <div className="text-[14px] text-[#22252B] font-inter font-normal not-italic leading-[20px] tracking-[0] mt-auto">Qual a conduta inicial mais adequada?</div>
                    </div>
                  </div>

                  {/* Opções ao lado do aside */}
                  <div className="mt-4 grid grid-cols-[auto_300px] gap-x-[18px] gap-y-0">
                    <div className="space-y-4">
                      <Option letter="A" percent={55} responses={10}>Iniciar anticoagulação plena imediatamente</Option>
                      <Option letter="B" percent={25} responses={10}>Avaliar elegibilidade para trombólise endovenosa</Option>
                      <Option letter="C" percent={15} responses={10} barColor="#06C270">Administrar ácido acetilsalicílico em dose plena e observar</Option>
                      <Option letter="D" percent={5} responses={10}>Indicar craniectomia descompressiva imediata</Option>
                    </div>

                    <aside className="border border-[#E3E4E5] rounded-lg p-4 bg-[#FFFFFF] w-[236px] h-[202px]">
                      <div className="text-[12px] text-[#22252B] font-inter font-medium not-italic leading-[16px] tracking-[0] w-[212px] h-[26px] pb-2 border-b border-[#E3E4E5] mb-2">Estatística</div>
                      <div className="space-y-2 text-[12px] text-[#3A3D45]">
                        <div className="flex flex-col items-start">
                          <span className="text-[12px] text-[#22252B] font-inter font-normal not-italic leading-[20px] tracking-[0]">Respostas corretas</span>
                          <span className="inline-flex items-center gap-1 mt-1"><img src="/quadro verde.png" alt="Quadro verde" className="w-[14px] h-[14px]" /><span className="text-[12px] text-[#22252B] font-inter font-medium not-italic">32</span></span>
                        </div>
                        <div className="flex flex-col items-start">
                          <span className="text-[12px] text-[#22252B] font-inter font-normal not-italic leading-[20px] tracking-[0]">Respostas erradas</span>
                          <span className="inline-flex items-center gap-1 mt-1"><span className="inline-block w-[11px] h-[11px] bg-[#FF3B3B] rounded-[2px]"></span><span className="text-[12px] text-[#22252B] font-inter font-medium not-italic">22</span></span>
                        </div>
                        <div className="flex flex-col items-start">
                          <span className="text-[12px] text-[#22252B] font-inter font-normal not-italic leading-[20px] tracking-[0]">Taxa de aproveitamento</span>
                          <span className="inline-flex items-center gap-1 mt-1"><img src="/progresso verde.png" alt="Progresso verde" className="w-[14px] h-[14px]" /><span className="text-[12px] text-[#22252B] font-inter font-medium not-italic">30%</span></span>
                        </div>
                      </div>
                    </aside>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        {/* Botão duplicado no final da página */}
        <div className="mt-6 flex justify-end gap-[12px] w-[1076px]">
          {viewMode === 'participantes' && (
            <>
              <button
                className={`w-[32px] h-[32px] box-border pt-[8px] pr-[9px] pb-[9px] pl-[9px] flex items-center justify-center gap-[10px] text-[12px] leading-[12px] font-normal tracking-[0px] not-italic rounded-[6px] text-[#22252B] opacity-100 rotate-0 ${selectedFilterIndex === 1 ? 'bg-[#F8FAFC] border border-[#E3E4E5]' : 'bg-transparent'}`}
                style={{ fontFamily: 'Inter' }}
                onClick={() => setSelectedFilterIndex(1)}
              >
                <span>01</span>
              </button>
              <button
                className={`w-[32px] h-[32px] box-border pt-[8px] pr-[9px] pb-[9px] pl-[9px] flex items-center justify-center gap-[10px] text-[12px] leading-[12px] font-normal tracking-[0px] not-italic rounded-[6px] text-[#22252B] opacity-100 rotate-0 ${selectedFilterIndex === 2 ? 'bg-[#F8FAFC] border border-[#E3E4E5]' : 'bg-transparent'}`}
                style={{ fontFamily: 'Inter' }}
                onClick={() => setSelectedFilterIndex(2)}
              >
                <span>02</span>
              </button>
              <button
                className={`w-[32px] h-[32px] box-border pt-[8px] pr-[9px] pb-[9px] pl-[9px] flex items-center justify-center gap-[10px] text-[12px] leading-[12px] font-normal tracking-[0px] not-italic rounded-[6px] text-[#22252B] opacity-100 rotate-0 ${selectedFilterIndex === 3 ? 'bg-[#F8FAFC] border border-[#E3E4E5]' : 'bg-transparent'}`}
                style={{ fontFamily: 'Inter' }}
                onClick={() => setSelectedFilterIndex(3)}
              >
                <span>03</span>
              </button>
              <button
                className={`w-[32px] h-[32px] box-border pt-[8px] pr-[9px] pb-[9px] pl-[9px] flex items-center justify-center gap-[10px] text-[12px] leading-[12px] font-normal tracking-[0px] not-italic rounded-[6px] text-[#22252B] opacity-100 rotate-0 ${selectedFilterIndex === 4 ? 'bg-[#F8FAFC] border border-[#E3E4E5]' : 'bg-transparent'}`}
                style={{ fontFamily: 'Inter' }}
                onClick={() => setSelectedFilterIndex(4)}
              >
                <span>04</span>
              </button>
              <button
                className={`w-[32px] h-[32px] box-border pt-[8px] pr-[9px] pb-[9px] pl-[9px] flex items-center justify-center gap-[10px] text-[12px] leading-[12px] font-normal tracking-[0px] not-italic rounded-[6px] text-[#22252B] opacity-100 rotate-0 ${selectedFilterIndex === 5 ? 'bg-[#F8FAFC] border border-[#E3E4E5]' : 'bg-transparent'}`}
                style={{ fontFamily: 'Inter' }}
                onClick={() => setSelectedFilterIndex(5)}
              >
                <span>05</span>
              </button>
              <button
                className={`w-[32px] h-[32px] box-border pt-[8px] pr-[9px] pb-[9px] pl-[9px] flex items-center justify-center gap-[10px] text-[12px] leading-[12px] font-normal tracking-[0px] not-italic rounded-[6px] text-[#22252B] opacity-100 rotate-0 ${selectedFilterIndex === 6 ? 'bg-[#F8FAFC] border border-[#E3E4E5]' : 'bg-transparent'}`}
                style={{ fontFamily: 'Inter' }}
                onClick={() => setSelectedFilterIndex(6)}
              >
                <span>06</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SimuladosAproveitamentoPage;