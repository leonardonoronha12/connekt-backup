"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Award,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  Folder,
  HelpCircle,
  Plus,
  X,
} from "lucide-react";

type TipoPagamento = "gratuito" | "pago";
type UnidadeTempo = "segundos" | "minutos";

type Curso = { id: number; name: string };
type Questao = { id: number; nome: string };
type CategoriaQuestoes = { id: number; nome: string; questoes: Questao[] };

export default function CriarSimuladoPage() {
  const { toast } = useToast();

  // Estados principais
  const [simuladoNome, setSimuladoNome] = useState<string>("");
  const [descricao, setDescricao] = useState<string>("");

  const [categorias, setCategorias] = useState<string[]>(["Medicina Geral"]);
  const [subcategorias, setSubcategorias] = useState<string[]>([
    "Clínica Médica",
    "Urgência e Emergência",
  ]);
  const [tags, setTags] = useState<string[]>([
    "Neurologia",
    "Cardiologia",
    "Emergência",
    "Diagnóstico",
  ]);

  const [tipoPagamento, setTipoPagamento] = useState<TipoPagamento>("gratuito");
  const [valor, setValor] = useState<string>("");
  const [dataDisponibilidade, setDataDisponibilidade] = useState<string>("");
  const [duracao, setDuracao] = useState<string>("");
  const [notaMaxima, setNotaMaxima] = useState<string>("100");

  const [questoesSelecionadas, setQuestoesSelecionadas] = useState<number[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<number[]>([1]);

  const [cursosSelecionados, setCursosSelecionados] = useState<number[]>([1, 2]);
  const [searchCursos, setSearchCursos] = useState<string>("");

  const [showConfiguracoes, setShowConfiguracoes] = useState<boolean>(true);

  const [configuracoes, setConfiguracoes] = useState({
    segundaChance: true,
    embaralharQuestao: false,
    pularQuestao: true,
    notaAprovacao: "70",
    tentativa: false,
    mostrarRespostaCorreta: true,
    forcarOrdem: false,
    calculadora: false,
    naoRefazer: true,
    temporizadorAtivo: false,
    temporizadorTempo: "5",
    temporizadorUnidade: "segundos" as UnidadeTempo,
  });

  // Mock de cursos
  const cursos: Curso[] = [
    { id: 1, name: "Medicina 1" },
    { id: 2, name: "Medicina 2" },
    { id: 3, name: "Residência Clínica" },
    { id: 4, name: "Urgência & Emergência" },
    { id: 5, name: "Cardiologia Avançada" },
  ];

  // Mock de categorias/questões
  const categoriasQuestoes: CategoriaQuestoes[] = [
    {
      id: 1,
      nome: "Cardiologia",
      questoes: [
        { id: 101, nome: "IAM: diagnóstico e conduta" },
        { id: 102, nome: "Insuficiência cardíaca: classificação" },
        { id: 103, nome: "Arritmias: taquiarritmias comuns" },
      ],
    },
    {
      id: 2,
      nome: "Neurologia",
      questoes: [
        { id: 201, nome: "AVC isquêmico: trombólise" },
        { id: 202, nome: "Epilepsia: primeira crise" },
        { id: 203, nome: "Cefaleia: red flags" },
      ],
    },
    {
      id: 3,
      nome: "Obstetrícia",
      questoes: [
        { id: 301, nome: "Pré-natal: rastreios essenciais" },
        { id: 302, nome: "Parto: indicações de cesárea" },
      ],
    },
    {
      id: 4,
      nome: "Cirurgia",
      questoes: [
        { id: 401, nome: "Apendicite aguda: sinais clínicos" },
        { id: 402, nome: "Colecistite: diagnóstico diferencial" },
      ],
    },
  ];

  // Utilidades
  const questaoPorId = useMemo(() => {
    const map = new Map<number, string>();
    for (const cat of categoriasQuestoes) {
      for (const q of cat.questoes) map.set(q.id, q.nome);
    }
    return map;
  }, [categoriasQuestoes]);

  const cursosDisponiveis = useMemo(() => {
    return cursos
      .filter((c) => !cursosSelecionados.includes(c.id))
      .filter((c) => c.name.toLowerCase().includes(searchCursos.toLowerCase()));
  }, [cursos, cursosSelecionados, searchCursos]);

  // Funções
  function addQuestao(id: number, nome: string) {
    if (!questoesSelecionadas.includes(id)) {
      setQuestoesSelecionadas((prev) => [...prev, id]);
      toast({ title: "Questão adicionada", description: nome });
    }
  }

  function removeQuestao(id: number) {
    setQuestoesSelecionadas((prev) => prev.filter((q) => q !== id));
    toast({ title: "Questão removida", description: questaoPorId.get(id) ?? String(id) });
  }

  function addCurso(id: number, nome: string) {
    if (!cursosSelecionados.includes(id)) {
      setCursosSelecionados((prev) => [...prev, id]);
      toast({ title: "Curso adicionado", description: nome });
    }
  }

  function removeCurso(id: number) {
    setCursosSelecionados((prev) => prev.filter((c) => c !== id));
  }

  function removeBadge(tipo: "categoria" | "subcategoria" | "tag", valor: string) {
    if (tipo === "categoria") setCategorias((prev) => prev.filter((c) => c !== valor));
    if (tipo === "subcategoria") setSubcategorias((prev) => prev.filter((c) => c !== valor));
    if (tipo === "tag") setTags((prev) => prev.filter((c) => c !== valor));
  }

  function adicionarBadge(tipo: "categoria" | "subcategoria" | "tag") {
    const novo = tipo === "categoria" ? "Nova categoria" : tipo === "subcategoria" ? "Nova subcategoria" : "Nova tag";
    if (tipo === "categoria") setCategorias((prev) => [...prev, novo]);
    if (tipo === "subcategoria") setSubcategorias((prev) => [...prev, novo]);
    if (tipo === "tag") setTags((prev) => [...prev, novo]);
  }

  function toggleCategoria(catId: number) {
    setExpandedCategories((prev) => (prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]));
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-white">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-gradient-to-br from-pink-500 via-purple-500 to-violet-600" />
            <h1 className="text-[18px] font-semibold text-[#0047BB]">Criar novo simulado</h1>
          </div>
          <div className="flex items-center gap-2">
            {!showConfiguracoes && (
              <Button variant="outline" className="border-gray-300 text-[#0047BB]" onClick={() => setShowConfiguracoes(true)}>
                Configurações
              </Button>
            )}
            <Button variant="outline" className="border-gray-300 text-gray-700">Cancelar</Button>
            <Button className="bg-[#0047BB] hover:bg-[#003a98] text-white">Continuar</Button>
          </div>
        </div>
      </header>

      {/* Corpo */}
      <div className="mx-auto flex max-w-[1400px] flex-1 gap-4 overflow-hidden px-4 py-3">
        {/* Coluna central */}
        <main className="flex-1 overflow-y-auto">
          {/* Cover */}
          <div className="rounded-xl bg-gradient-to-r from-blue-500 via-violet-500 to-pink-500 p-6 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white/20">
                <HelpCircle className="h-6 w-6" />
              </div>
              <div className="text-sm opacity-90">Simulado</div>
            </div>
            <div className="mt-4">
              <Input
                value={simuladoNome}
                onChange={(e) => setSimuladoNome(e.target.value)}
                placeholder="Digite o nome do simulado aqui"
                className="h-12 border-none bg-white/10 text-white placeholder:text-white/70 focus-visible:ring-white"
              />
            </div>
          </div>

          {/* Categorias / Subcategorias / Tags */}
          <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {/* Categoria */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-700">
                    <Folder className="h-4 w-4 text-gray-600" />
                    <span className="text-sm font-medium">Categoria</span>
                  </div>
                  <Button variant="outline" className="h-8 border-[#0047BB] text-[#0047BB]" onClick={() => adicionarBadge("categoria")}>Adicionar</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {categorias.map((c) => (
                    <Badge key={c} className="bg-violet-100 text-violet-800">
                      <span>{c}</span>
                      <button className="ml-1" onClick={() => removeBadge("categoria", c)}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
              {/* Subcategoria */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-700">
                    <Folder className="h-4 w-4 text-gray-600" />
                    <span className="text-sm font-medium">Subcategoria</span>
                  </div>
                  <Button variant="outline" className="h-8 border-[#0047BB] text-[#0047BB]" onClick={() => adicionarBadge("subcategoria")}>Adicionar</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {subcategorias.map((c) => (
                    <Badge key={c} className="bg-yellow-100 text-yellow-800">
                      <span>{c}</span>
                      <button className="ml-1" onClick={() => removeBadge("subcategoria", c)}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
              {/* Tags */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-700">
                    <Folder className="h-4 w-4 text-gray-600" />
                    <span className="text-sm font-medium">Tags</span>
                  </div>
                  <Button variant="outline" className="h-8 border-[#0047BB] text-[#0047BB]" onClick={() => adicionarBadge("tag")}>Adicionar</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tags.map((t) => (
                    <Badge key={t} className="bg-blue-100 text-blue-800">
                      <span>{t}</span>
                      <button className="ml-1" onClick={() => removeBadge("tag", t)}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            {/* Descrição */}
            <div className="mt-6">
              <label className="text-sm text-gray-700">Descrição</label>
              <textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value.slice(0, 300))}
                className="mt-2 w-full rounded-md border border-gray-300 p-3 text-sm focus-visible:ring-[#0047BB]"
                rows={4}
                placeholder="Descreva brevemente o simulado"
              />
              <div className="mt-1 text-right text-xs text-gray-500">{descricao.length}/300</div>
            </div>
          </div>

          {/* Pagamento e Disponibilidade */}
          <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-3 text-sm font-medium text-gray-700">Pagamento e Disponibilidade</div>
            <div className="flex gap-3">
              {/* Gratuito */}
              <button
                className={`flex-1 rounded-md border p-4 text-left ${
                  tipoPagamento === "gratuito" ? "border-[#0047BB] bg-[#0047BB]/5" : "border-gray-200"
                }`}
                onClick={() => setTipoPagamento("gratuito")}
              >
                <div className="text-sm font-semibold">Gratuito</div>
                <div className="text-xs text-gray-500">Sem custo para o aluno</div>
              </button>
              {/* Pago */}
              <button
                className={`flex-1 rounded-md border p-4 text-left ${
                  tipoPagamento === "pago" ? "border-[#0047BB] bg-[#0047BB]/5" : "border-gray-200"
                }`}
                onClick={() => setTipoPagamento("pago")}
              >
                <div className="text-sm font-semibold">Pago</div>
                <div className="text-xs text-gray-500">Disponível mediante pagamento</div>
              </button>
            </div>

            {tipoPagamento === "pago" && (
              <div className="mt-4">
                <label className="text-sm text-gray-700">Valor (R$)</label>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex items-center rounded-md border border-gray-300 px-2 py-2">
                    <DollarSign className="mr-2 h-4 w-4 text-gray-500" />
                    <input
                      value={valor}
                      onChange={(e) => setValor(e.target.value)}
                      className="w-40 bg-transparent text-sm outline-none"
                      placeholder="0,00"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Data de disponibilidade */}
              <div>
                <label className="text-sm text-gray-700">Data de Disponibilidade</label>
                <div className="mt-2 flex items-center rounded-md border border-gray-300 px-2 py-2">
                  <Calendar className="mr-2 h-4 w-4 text-gray-500" />
                  <input
                    type="date"
                    value={dataDisponibilidade}
                    onChange={(e) => setDataDisponibilidade(e.target.value)}
                    className="bg-transparent text-sm outline-none"
                  />
                </div>
              </div>
              {/* Duração */}
              <div>
                <label className="text-sm text-gray-700">Duração do Simulado</label>
                <div className="mt-2 flex items-center rounded-md border border-gray-300 px-2 py-2">
                  <Clock className="mr-2 h-4 w-4 text-gray-500" />
                  <input
                    type="number"
                    value={duracao}
                    onChange={(e) => setDuracao(e.target.value)}
                    className="w-24 bg-transparent text-sm outline-none"
                    placeholder="0"
                  />
                  <span className="ml-2 text-xs text-gray-500">minutos</span>
                </div>
              </div>
              {/* Nota Máxima */}
              <div>
                <label className="text-sm text-gray-700">Nota Máxima</label>
                <div className="mt-2 flex items-center rounded-md border border-gray-300 px-2 py-2">
                  <Award className="mr-2 h-4 w-4 text-gray-500" />
                  <input
                    type="number"
                    value={notaMaxima}
                    onChange={(e) => setNotaMaxima(e.target.value)}
                    className="w-24 bg-transparent text-sm outline-none"
                    placeholder="100"
                  />
                  <span className="ml-2 text-xs text-gray-500">pontos</span>
                </div>
              </div>
            </div>
          </div>

          {/* Controle de Acesso */}
          <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-3 text-sm font-medium text-gray-700">Controle de Acesso</div>
            <Input
              value={searchCursos}
              onChange={(e) => setSearchCursos(e.target.value)}
              placeholder="Buscar curso…"
              className="mb-3"
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <div className="mb-2 text-xs font-semibold text-gray-600">SELECIONADOS</div>
                <div className="space-y-2">
                  {cursosSelecionados.length === 0 && (
                    <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-700">Nenhum curso selecionado</div>
                  )}
                  {cursosSelecionados.map((id) => {
                    const c = cursos.find((x) => x.id === id)!;
                    return (
                      <div key={id} className="flex items-center justify-between rounded-md bg-blue-50 p-3 text-sm">
                        <span className="text-blue-800">{c.name}</span>
                        <Button variant="ghost" size="sm" onClick={() => removeCurso(id)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="mb-2 text-xs font-semibold text-gray-600">DISPONÍVEIS</div>
                <div className="space-y-2">
                  {cursosDisponiveis.map((c) => (
                    <div key={c.id} className="flex items-center justify-between rounded-md border border-gray-200 p-3 text-sm">
                      <span>{c.name}</span>
                      <Button variant="ghost" size="sm" className="text-[#0047BB]" onClick={() => addCurso(c.id, c.name)}>
                        <Plus className="mr-1 h-4 w-4" /> Adicionar
                      </Button>
                    </div>
                  ))}
                  {cursosDisponiveis.length === 0 && (
                    <div className="rounded-md border border-dashed p-3 text-xs text-gray-500">Nenhum curso disponível</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Banco de questões */}
          <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-3 text-sm font-medium text-gray-700">Banco de questões</div>
            <Input placeholder="Nome do banco" className="mb-3" />
            <div className="space-y-3">
              {categoriasQuestoes.map((cat) => {
                const expanded = expandedCategories.includes(cat.id);
                return (
                  <div key={cat.id} className="rounded-md border border-gray-200">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between bg-[#F6F5FA] px-3 py-2"
                      onClick={() => toggleCategoria(cat.id)}
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-5 rounded-sm bg-gradient-to-br from-blue-500 to-blue-700" />
                        <span className="text-sm font-medium text-gray-800">{cat.nome}</span>
                      </div>
                      {expanded ? (
                        <ChevronUp className="h-4 w-4 text-gray-500" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-500" />
                      )}
                    </button>
                    {expanded && (
                      <ul className="space-y-2 p-3">
                        {cat.questoes.map((q) => {
                          const selecionada = questoesSelecionadas.includes(q.id);
                          return (
                            <li key={q.id} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100">
                                  <HelpCircle className="h-4 w-4 text-blue-600" />
                                </div>
                                <span className="text-sm text-gray-700">{q.nome}</span>
                              </div>
                              {selecionada ? (
                                <Button size="sm" variant="outline" onClick={() => removeQuestao(q.id)}>Remover</Button>
                              ) : (
                                <Button size="sm" variant="outline" onClick={() => addQuestao(q.id, q.nome)}>Adicionar</Button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </main>

        {/* Coluna direita 1 – Questões selecionadas */}
        <aside className="w-80 shrink-0 overflow-y-auto rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold">Questões selecionadas</div>
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs text-white">
              {questoesSelecionadas.length}
            </div>
          </div>
          {questoesSelecionadas.length === 0 ? (
            <div className="flex items-center gap-2 rounded-md border border-dashed p-3 text-sm text-gray-500">
              <HelpCircle className="h-4 w-4" /> Nenhuma questão selecionada
            </div>
          ) : (
            <div className="space-y-2">
              {questoesSelecionadas.map((id) => (
                <div key={id} className="flex items-center justify-between rounded-md border border-gray-200 p-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100">
                      <HelpCircle className="h-4 w-4 text-blue-600" />
                    </div>
                    <span className="text-sm text-gray-700">{questaoPorId.get(id)}</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeQuestao(id)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* Coluna direita 2 – Configurações */}
        {showConfiguracoes && (
          <aside className="w-80 shrink-0 overflow-y-auto rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold">Configurações do simulado</div>
              <Button variant="ghost" size="sm" onClick={() => setShowConfiguracoes(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Perguntas */}
            <div>
              <div className="mb-2 text-xs font-semibold text-gray-600">Perguntas</div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Segunda chance</span>
                  <Switch checked={configuracoes.segundaChance} onCheckedChange={(v) => setConfiguracoes((p) => ({ ...p, segundaChance: v }))} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Embaralhar questão</span>
                  <Switch checked={configuracoes.embaralharQuestao} onCheckedChange={(v) => setConfiguracoes((p) => ({ ...p, embaralharQuestao: v }))} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Pular questão</span>
                  <Switch checked={configuracoes.pularQuestao} onCheckedChange={(v) => setConfiguracoes((p) => ({ ...p, pularQuestao: v }))} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Forçar ordem</span>
                  <Switch checked={configuracoes.forcarOrdem} onCheckedChange={(v) => setConfiguracoes((p) => ({ ...p, forcarOrdem: v }))} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Calculadora</span>
                  <Switch checked={configuracoes.calculadora} onCheckedChange={(v) => setConfiguracoes((p) => ({ ...p, calculadora: v }))} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Não refazer</span>
                  <Switch checked={configuracoes.naoRefazer} onCheckedChange={(v) => setConfiguracoes((p) => ({ ...p, naoRefazer: v }))} />
                </div>
              </div>

              {/* Temporizador */}
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Temporizador por questão</span>
                  <Switch checked={configuracoes.temporizadorAtivo} onCheckedChange={(v) => setConfiguracoes((p) => ({ ...p, temporizadorAtivo: v }))} />
                </div>
                {configuracoes.temporizadorAtivo && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={configuracoes.temporizadorTempo}
                      onChange={(e) => setConfiguracoes((p) => ({ ...p, temporizadorTempo: e.target.value }))}
                      className="w-20"
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className={
                          configuracoes.temporizadorUnidade === "segundos"
                            ? "border-[#0047BB] bg-[#0047BB]/5"
                            : ""
                        }
                        onClick={() => setConfiguracoes((p) => ({ ...p, temporizadorUnidade: "segundos" }))}
                      >
                        Segundos
                      </Button>
                      <Button
                        variant="outline"
                        className={
                          configuracoes.temporizadorUnidade === "minutos"
                            ? "border-[#0047BB] bg-[#0047BB]/5"
                            : ""
                        }
                        onClick={() => setConfiguracoes((p) => ({ ...p, temporizadorUnidade: "minutos" }))}
                      >
                        Minutos
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Respostas */}
            <div className="mt-6">
              <div className="mb-2 text-xs font-semibold text-gray-600">Respostas</div>
              <div className="space-y-3">
                <div>
                  <label className="text-sm">Nota de aprovação</label>
                  <Input
                    type="number"
                    value={configuracoes.notaAprovacao}
                    onChange={(e) => setConfiguracoes((p) => ({ ...p, notaAprovacao: e.target.value }))}
                    className="mt-1 w-24"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Tentativa</span>
                  <Switch checked={configuracoes.tentativa} onCheckedChange={(v) => setConfiguracoes((p) => ({ ...p, tentativa: v }))} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Mostrar resposta correta</span>
                  <Switch checked={configuracoes.mostrarRespostaCorreta} onCheckedChange={(v) => setConfiguracoes((p) => ({ ...p, mostrarRespostaCorreta: v }))} />
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}