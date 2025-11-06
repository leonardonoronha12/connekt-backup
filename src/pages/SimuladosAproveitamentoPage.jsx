import React from 'react';
import { Helmet } from 'react-helmet-async';

const StatBadge = ({ color, label, value, inline = false, groupBelow = false, stacked = false }) => (
  inline ? (
    <div className="flex items-center gap-2">
      <span className="text-[14px] text-[#22252B] font-inter font-normal not-italic">{label}</span>
      <span className="text-[14px] text-[#22252B] font-inter font-semibold not-italic">{value}</span>
    </div>
  ) : stacked ? (
    <div className="flex flex-col items-center gap-2">
      <span className="text-[14px] text-[#22252B] font-inter font-normal not-italic">{label}</span>
      <span className="text-[14px] text-[#22252B] font-inter font-semibold not-italic">{value}</span>
    </div>
  ) : groupBelow ? (
    <div className="flex flex-col items-center gap-2">
      <span className="text-[14px] text-[#22252B] font-inter font-normal not-italic">{label}</span>
      <div className="inline-flex items-center gap-2">
        <span className="inline-flex items-center justify-center w-5 h-5">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="10" cy="10" r="9" stroke={color} strokeWidth="2" />
            <path d="M6 10l2 2 6-6" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
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

const Option = ({ letter, children, percent = 0, responses = 0 }) => (
  <div className="space-y-2">
    <div className="flex flex-col gap-2">
      {/* Linha única com letra e texto juntos */}
      <div className="flex items-center gap-2 h-[30px]">
        <span className="text-[14px] text-[#22252B] font-normal not-italic font-inter">{letter}.</span>
        <div className="text-[14px] text-[#22252B] font-normal not-italic font-inter leading-relaxed">{children}</div>
      </div>

      {/* Rótulo e barra de progresso abaixo, na mesma linha, sem espaçamento vertical */}
      <div className="mt-0 flex items-center gap-2 h-[20px]">
        <span className="text-[12px] text-[#22252B] font-inter">{responses} resp., {percent}%</span>
        <div
          className="relative w-[291px] h-[8px] bg-[#EDECEF] rounded-full overflow-hidden"
          aria-label={`Progresso horizontal ${percent}%`}
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="absolute left-0 top-0 h-[8px] bg-[#EF4444]"
            style={{ width: `${Math.max(0, Math.min(percent, 100))}%` }}
          />
        </div>
      </div>
    </div>
  </div>
);

const SimuladosAproveitamentoPage = () => {
  return (
    <div className="min-h-screen bg-[#FFFFFF]">
      <Helmet>
        <title>Simulados – Aproveitamento</title>
        <meta name="description" content="Resumo de aproveitamento do simulado." />
      </Helmet>

      {/* Botão de voltar movido para o Header quando nesta rota */}

      <div className="pt-8 px-6 pb-10">
        <div className="flex items-start justify-between">
          <div className="space-y-4">
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
                <StatBadge color="#22C55E" label="Aprovação (%)" value="60%" groupBelow />
                <StatBadge color="#EF4444" label="Reprovação (%)" value="40%" groupBelow />
                <StatBadge label="Submissões" value="1200" stacked />
              </div>
              <div className="flex items-center gap-3">
                <button className="px-3 py-1.5 text-[12px] rounded bg-[#EDECEF] text-[#22252B]">Estatística</button>
                <button className="px-3 py-1.5 text-[12px] rounded bg-[#F6F5FA] text-[#3A3D45]">Participantes</button>
              </div>
            </div>
          </div>
          <div className="w-[342px] h-[207.34px] rounded-lg overflow-hidden shadow-sm border border-[#E3E4E5] bg-[#FFFFFF]">
            <img src="/Imagemesquerda.svg" alt="Ilustração" className="w-[342px] h-[207.34px] object-cover" />
          </div>
        </div>
        <div className="mt-4 space-y-[32px]">
          <div className="flex justify-end">
            <button className="flex items-center gap-2 px-3 py-1.5 rounded border border-[#E3E4E5] bg-white text-[12px] text-[#3A3D45]">
              <img src="/Filtro simulados 1.png" alt="Filtrar" className="w-4 h-4" />
              Filtrar
            </button>
          </div>
          <div className="border border-[#E3E4E5] rounded-lg bg-[#FFFFFF] w-[1076px] h-[532px]">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#E3E4E5]">
              <div className="flex items-center gap-2">
                <img src="/question-icon.svg" alt="Questão" className="w-4 h-4" />
                <span className="text-[12px] font-medium text-[#22252B]">Questão de múltipla escolha</span>
              </div>
              <div className="flex items-center gap-2 text-[12px] text-[#737780]">
                <span className="px-2 py-0.5 rounded bg-[#F6F5FA]">20</span>
                <span>Pontos</span>
                <span className="w-1 h-1 rounded-full bg-[#FFD400]"></span>
              </div>
            </div>

            <div className="p-5">
              {/* Enunciado e imagem */}
              <div className="flex items-start gap-4">
                <img src="/config simulados.png" alt="mini" className="w-[227.63px] h-[138px] object-cover rounded" />
                <div className="flex-1 space-y-3">
                  <div className="inline-flex items-center gap-2">
                    <span className="w-[20px] h-[20px] rounded grid place-items-center text-[12px] text-[#0047BB]">1</span>
                    <span className="text-[12px] text-[#3A3D45]">Questão</span>
                  </div>
                  <div className="text-[12px] text-[#3A3D45]">Um paciente de 54 anos, hipertenso e diabético, chega ao pronto-socorro com hemiparesia esquerda súbita há 2 horas. A TC de crânio sem contraste (mostrada na imagem) evidencia área hipodensa compatível com AVC isquêmico em território de artéria cerebral média direita.</div>
                  <div className="text-[12px] text-[#3A3D45]">Qual a conduta inicial mais adequada?</div>
                </div>
              </div>

              {/* Opções ao lado do aside */}
              <div className="mt-4 grid grid-cols-[auto_300px] gap-6">
                <div className="space-y-4">
                  <Option letter="A" percent={55} responses={10}>Iniciar anticoagulação plena imediatamente</Option>
                  <Option letter="B" percent={25} responses={10}>Avaliar elegibilidade para trombólise endovenosa</Option>
                  <Option letter="C" percent={15} responses={10}>Administrar ácido acetilsalicílico em dose plena e observar</Option>
                  <Option letter="D" percent={5} responses={10}>Indicar craniectomia descompressiva imediata</Option>
                </div>

                <aside className="border border-[#E3E4E5] rounded-lg p-4 bg-[#FFFFFF] w-[236px] h-[202px]">
                  <div className="text-[12px] font-medium text-[#22252B] mb-3">Estatística</div>
                  <div className="space-y-2 text-[12px] text-[#3A3D45]">
                    <div className="flex items-center justify-between">
                      <span>Respostas corretas</span>
                      <span className="text-[#22C55E]">32</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Respostas erradas</span>
                      <span className="text-[#EF4444]">22</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Taxa de aproveitamento</span>
                      <span className="text-[#22C55E]">30%</span>
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimuladosAproveitamentoPage;