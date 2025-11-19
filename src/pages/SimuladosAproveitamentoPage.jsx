import React, { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/lib/supabaseClient';
import AproveitamentoIcon from '../components/ui/AproveitamentoIcon.jsx';
import PontuacaoDot from '../components/ui/PontuacaoDot.jsx';

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

const Option = ({ letter, children, percent = 0, responses = 0, correct = false }) => (
  <div className="space-y-2">
    <div className="flex flex-col gap-2">
      {/* Linha única com letra e texto juntos */}
      <div className="flex items-center gap-2 h-[30px]">
        <span className="text-[14px] text-[#22252B] font-normal not-italic font-inter">{letter}.</span>
        <div className="text-[14px] text-[#22252B] font-normal not-italic font-inter leading-relaxed">{children}</div>
      </div>

      {/* Rótulo e barra de progresso abaixo, na mesma linha, sem espaçamento vertical */}
      <div className="mt-0 flex items-center gap-2 h-[20px]">
        <span className={`text-[12px] font-inter ${correct ? 'text-[#22C55E]' : 'text-[#22252B]'}`}>{responses} resp., {percent}%</span>
        <div
          className="relative w-[291px] h-[8px] bg-[#EDECEF] rounded-full overflow-hidden"
          aria-label={`Progresso horizontal ${percent}%`}
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={`absolute left-0 top-0 h-[8px] ${correct ? 'bg-[#22C55E]' : 'bg-[#EF4444]'}`}
            style={{ width: `${Math.max(0, Math.min(percent, 100))}%` }}
          />
        </div>
      </div>
    </div>
  </div>
);

const SimuladosAproveitamentoPage = () => {
  const [sim, setSim] = useState(null);
  const [simLoading, setSimLoading] = useState(false);
  const [simError, setSimError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    const simId = params.get('simId');
    if (!simId) {
      setSim(null);
      setSimError(null);
      return;
    }
    setSimLoading(true);
    setSimError(null);
    (async () => {
      try {
        const { data, error } = await supabase
          .from('simulados')
          .select('*')
          .eq('id', simId)
          .single();
        if (!cancelled) {
          if (error) {
            setSim(null);
            setSimError(error.message || 'Erro ao carregar simulado');
          } else {
            setSim(data || null);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setSim(null);
          setSimError(e?.message || 'Erro inesperado ao buscar simulado');
        }
      } finally {
        if (!cancelled) setSimLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);
  const [activeTab, setActiveTab] = useState('estatistica');
  const [participantQuery, setParticipantQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [userSimulados, setUserSimulados] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState(null);

  useEffect(() => {
    const loadSimulados = async () => {
      setListLoading(true);
      setListError(null);
      try {
        const { data, error } = await supabase
          .from('simulados')
          .select('id,title,created_at')
          .order('created_at', { ascending: false });
        if (error) {
          setUserSimulados([]);
          setListError(error.message || 'Erro ao carregar simulados');
        } else {
          setUserSimulados(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        setUserSimulados([]);
        setListError(e?.message || 'Erro inesperado ao listar simulados');
      } finally {
        setListLoading(false);
      }
    };
    loadSimulados();
  }, []);

  const navigateToSimulado = (id) => {
    if (!id) return;
    const url = new URL(window.location.href);
    url.searchParams.set('simId', String(id));
    window.location.href = url.toString();
  };

  const participants = [
    { name: 'Ygor Rafael', email: 'ygorafael@gmail.com', avatar: '/perfil rc.png', pontuacao: '30 Pontos', aproveitamento: '60%', startDate: '02.09.2025', endDate: '02.09.2025' },
    { name: 'Sandra Paixoto', email: 'sandrapaixoto@gmail.com', avatar: '/perfil rc.png', pontuacao: '30 Pontos', aproveitamento: '60%', startDate: '02.09.2025', endDate: '02.09.2025' },
    { name: 'Manuela de Alcântara', email: 'manuelaskant@outlook.com', avatar: '/perfil rc.png', pontuacao: '30 Pontos', aproveitamento: '60%', startDate: '02.09.2025', endDate: '02.09.2025' },
    { name: 'Maria Cavalcante', email: 'maria.cavalcante@gmail.com', avatar: '/perfil rc.png', pontuacao: '30 Pontos', aproveitamento: '60%', startDate: '02.09.2025', endDate: '02.09.2025' },
    { name: 'Antônio de Aguiar', email: 'aguiar.antonio@hotmail.com', avatar: '/perfil rc.png', pontuacao: '30 Pontos', aproveitamento: '60%', startDate: '02.09.2025', endDate: '02.09.2025' },
    { name: 'Pedroza', email: 'pedroza.22@yahoo.com', avatar: '/perfil rc.png', pontuacao: '30 Pontos', aproveitamento: '60%', startDate: '02.09.2025', endDate: '02.09.2025' },
    { name: 'Aline Cardoso', email: 'aline.cardoso@outlook.com', avatar: '/perfil rc.png', pontuacao: '30 Pontos', aproveitamento: '80%', startDate: '02.09.2025', endDate: '02.09.2025' },
    { name: 'Francisco de Queiroz', email: 'fran.queiroz@gmail.com', avatar: '/perfil rc.png', pontuacao: '30 Pontos', aproveitamento: '60%', startDate: '02.09.2025', endDate: '02.09.2025' },
  ];

  const studentAvatars = ['/verde.svg', '/azul.svg', '/laranja.svg', '/roxo.svg', '/amarelo.svg'];

  const filteredParticipants = (Array.isArray(participants)
    ? participants.filter((p) => (
        ((p?.name || '') + ' ' + (p?.email || '')).toLowerCase().includes((participantQuery || '').toLowerCase())
      ))
    : []);

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
              <h1 className="text-[18px] font-semibold text-[#000000] font-inter">{sim?.title || 'Nome do simulado aqui'}</h1>
              <div className="flex items-center gap-2">
                {(Array.isArray(sim?.settings?.categories) ? sim.settings.categories : []).map((c, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 text-[12px] font-normal h-[20px] px-2 py-0 rounded-[4px]"
                    style={{ backgroundColor: 'rgba(173, 137, 247, 0.1)', color: '#22252B' }}
                  >
                    <span className="leading-none text-[7px] text-[#AD89F7]">🟪</span>
                    <span className="text-[12px] text-[#22252B] font-normal not-italic font-inter">{String(c)}</span>
                  </span>
                ))}
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
                <button
                  className={`px-3 py-1.5 text-[12px] rounded ${activeTab === 'estatistica' ? 'bg-[#EDECEF] text-[#22252B]' : 'bg-[#F6F5FA] text-[#3A3D45]'}`}
                  onClick={() => setActiveTab('estatistica')}
                >
                  Estatística
                </button>
                <button
                  className={`px-3 py-1.5 text-[12px] rounded ${activeTab === 'participantes' ? 'bg-[#EDECEF] text-[#22252B]' : 'bg-[#F6F5FA] text-[#3A3D45]'}`}
                  onClick={() => setActiveTab('participantes')}
                >
                  Participantes
                </button>
              </div>
            </div>
          </div>
          <div className="w-[342px] h-[207.34px] rounded-lg overflow-hidden shadow-sm border border-[#E3E4E5] bg-[#FFFFFF]">
            <img src={sim?.cover_image_url || '/Imagemesquerda.svg'} alt={sim?.title || 'Ilustração'} className="w-[342px] h-[207.34px] object-cover" />
          </div>
        </div>
        <div className="mt-4 space-y-[32px]">
          <div className="flex justify-end relative">
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={isDropdownOpen}
              onClick={() => setIsDropdownOpen((v) => !v)}
              className="flex items-center gap-2 px-3 py-1.5 rounded border border-[#E3E4E5] bg-white text-[12px] text-[#3A3D45]"
            >
              <img src="/Filtro simulados 1.png" alt="Filtrar" className="w-4 h-4" />
              Filtrar
            </button>
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-[280px] rounded border border-[#E3E4E5] bg-white shadow-md z-10">
                <div className="px-3 py-2 text-[12px] text-[#9291A5]">
                  {listLoading ? 'Carregando simulados...' : (listError ? 'Erro ao carregar' : 'Selecione um simulado')}
                </div>
                {!listLoading && !listError && (
                  <ul role="listbox" className="max-h-[240px] overflow-auto divide-y divide-[#E3E4E5]">
                    {userSimulados.length === 0 ? (
                      <li className="px-3 py-2 text-[12px] text-[#9291A5]">Nenhum simulado encontrado</li>
                    ) : (
                      userSimulados.map((s) => (
                        <li key={s.id}>
                          <button
                            role="option"
                            className="w-full text-left px-3 py-2 text-[12px] hover:bg-[#F6F5FA] text-[#1E1B39]"
                            onClick={() => { setIsDropdownOpen(false); navigateToSimulado(s.id); }}
                          >
                            {s.title || `Simulado ${s.id}`}
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            )}
          </div>

          {activeTab === 'estatistica' ? (
            <div className="border border-[#E3E4E5] rounded-lg bg-[#FFFFFF] w-full h-[532px]">
              <div className="flex items-center justify-between px-5 py-3 border-b border-[#E3E4E5]">
                <div className="flex items-center gap-2">
            <span
              aria-label="Questão"
              className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-neutral-200 text-[#0047BB] text-[10px] font-bold"
            >
              ?
            </span>
                  <span className="text-[12px] font-medium text-[#22252B]">Questão de múltipla escolha</span>
                </div>
                <div className="flex items-center gap-2 text-[12px] text-[#737780]">
                  <span className="px-2 py-0.5 rounded bg-[#F6F5FA]">20</span>
                  <span>Pontos</span>
                  <span className="w-1 h-1 rounded-full bg-[#FFD400]"></span>
                </div>
              </div>

              <div className="p-5">
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

                <div className="mt-4 grid grid-cols-[auto_300px] gap-6">
                  <div className="space-y-4">
                    <Option letter="A" percent={55} responses={10}>Iniciar anticoagulação plena imediatamente</Option>
                    <Option letter="B" percent={25} responses={10}>Avaliar elegibilidade para trombólise endovenosa</Option>
                    <Option letter="C" percent={15} responses={10} correct>Administrar ácido acetilsalicílico em dose plena e observar</Option>
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
          ) : (
            <div className="border border-[#E3E4E5] rounded-lg bg-[#FFFFFF] w-full h-[532px] overflow-auto">
              <div className="flex items-center justify-between px-5 py-3 border-b border-[#E3E4E5]">
                <div className="flex items-center gap-2">
                  <img src="/icons/alunos.svg" alt="Participantes" className="w-4 h-4" />
                  <span className="text-[12px] font-medium text-[#22252B]">Participantes</span>
                </div>
                <div className="flex items-center gap-3 text-[12px] text-[#737780]">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[#737780]" aria-hidden="true" />
                    <input
                      type="text"
                      value={participantQuery}
                      onChange={(e) => setParticipantQuery(e.target.value)}
                      placeholder="Buscar aluno pelo nome"
                      aria-label="Buscar aluno pelo nome"
                      className="pl-8 pr-3 py-1.5 text-[12px] border border-[#E3E4E5] rounded bg-white w-[220px] focus:outline-none focus:ring-1 focus:ring-[#0047BB]"
                    />
                  </div>
                  <span className="px-2 py-0.5 rounded bg-[#F6F5FA]">{filteredParticipants.length}</span>
                  <span>Inscritos</span>
                </div>
              </div>

              <div className="p-5">
                <div className="grid grid-cols-[2fr,1.2fr,1.2fr,1fr,1fr] px-4 py-2 text-[12px] text-[#737780] bg-[#F9FAFB] rounded-md border border-[#E3E4E5]">
                  <span>Cliente</span>
                  <span className="justify-self-center text-center">Data de início</span>
                  <span className="justify-self-center text-center">Data de fim</span>
                  <span className="inline-block whitespace-nowrap justify-self-end text-right">Pontuação</span>
                  <span className="inline-block whitespace-nowrap justify-self-end text-right">Aproveitamento</span>
                </div>
                <ul className="divide-y divide-[#E3E4E5] rounded-md overflow-hidden">
                  {filteredParticipants.map((p, idx) => (
                    <li key={idx} className="grid grid-cols-[2fr,1.2fr,1.2fr,1fr,1fr] items-center py-3 px-4 bg-white">
                      <div className="flex items-center gap-3">
                        <img src={studentAvatars[idx % studentAvatars.length]} alt={p.name} className="w-[28px] h-[28px] rounded-full ring-1 ring-white object-cover" />
                        <div className="flex flex-col">
                          <span className="text-[12px] text-[#1E1B39] font-inter font-medium">{p.name}</span>
                          <span className="text-[12px] text-[#9291A5]">{p.email}</span>
                        </div>
                      </div>
                      <span className="text-[12px] text-[#3A3D45] justify-self-center text-center">{p.startDate}</span>
                      <span className="text-[12px] text-[#3A3D45] justify-self-center text-center">{p.endDate}</span>
                      <div className="flex items-center gap-2 justify-end text-[12px] text-[#3A3D45] pr-2 w-full justify-self-end">
                        <span className="text-right">{p.pontuacao || p.score}</span>
                        <PontuacaoDot className="w-3 h-3 shrink-0" />
                      </div>
                      <div className="flex items-center gap-1 text-[12px] text-[#0047BB] w-full justify-self-end justify-end">
                        <span className="inline-block whitespace-nowrap leading-[16px]">{p.aproveitamento}</span>
                        <AproveitamentoIcon className="w-4 h-4 text-blue-500" percent={parseInt(p.aproveitamento, 10)} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SimuladosAproveitamentoPage;