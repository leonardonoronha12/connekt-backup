import React, { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/lib/supabaseClient';
import AproveitamentoIcon from '../components/ui/AproveitamentoIcon.jsx';
import PontuacaoDot from '../components/ui/PontuacaoDot.jsx';

const normalizeToList = (value) => {
  if (Array.isArray(value)) return value.filter((x) => x != null).map((x) => String(x).trim()).filter(Boolean);
  if (typeof value === 'string') {
    const v = value.trim();
    if (!v) return [];
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.filter((x) => x != null).map((x) => String(x).trim()).filter(Boolean);
    } catch (_) {}
    return v.split(',').map((s) => s.trim()).filter(Boolean);
  }
  if (value && typeof value === 'object') return [];
  return [];
};

const parseJsonMaybe = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  const s = String(value || '').trim();
  if (!s) return null;
  try { return JSON.parse(s); } catch (_) { return null; }
};

const stripHtml = (value) => {
  const s = String(value || '');
  return s
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const formatDateBr = (value) => {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(d);
  } catch (_) {
    return d.toLocaleDateString('pt-BR');
  }
};

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
  const [simId, setSimId] = useState(() => {
    try { return new URLSearchParams(window.location.search).get('simId') || ''; } catch (_) { return ''; }
  });
  const [sim, setSim] = useState(null);
  const [simLoading, setSimLoading] = useState(false);
  const [simError, setSimError] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [attempts, setAttempts] = useState([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0);
  const [questionImageSrc, setQuestionImageSrc] = useState('/config simulados.png');

  useEffect(() => {
    const onPop = () => {
      try { setSimId(new URLSearchParams(window.location.search).get('simId') || ''); } catch (_) { setSimId(''); }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const id = String(simId || '').trim();
    if (!id) {
      setSim(null);
      setSimError(null);
      setQuestions([]);
      setAttempts([]);
      setParticipants([]);
      return;
    }
    setSimLoading(true);
    setSimError(null);
    (async () => {
      try {
        const { data, error } = await supabase
          .from('simulados')
          .select('*')
          .eq('id', id)
          .single();
        if (cancelled) return;
        if (error) {
          setSim(null);
          setSimError(error.message || 'Erro ao carregar simulado');
        } else {
          setSim(data || null);
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
  }, [simId]);

  const questionIds = useMemo(() => {
    const s = sim && typeof sim === 'object' ? sim : null;
    const settings = (s?.settings && typeof s.settings === 'object') ? s.settings : (parseJsonMaybe(s?.settings) || {});
    const candidates = [
      settings?.questionIds,
      settings?.question_ids,
      settings?.questions,
      s?.question_ids,
      s?.questionIds,
    ];
    for (const c of candidates) {
      const list = normalizeToList(c);
      if (list.length > 0) return Array.from(new Set(list));
    }
    return [];
  }, [sim]);

  useEffect(() => {
    let cancelled = false;
    const ids = Array.isArray(questionIds) ? questionIds : [];
    if (ids.length === 0) {
      setQuestions([]);
      setSelectedQuestionIndex(0);
      return;
    }
    setQuestionsLoading(true);
    (async () => {
      try {
        const out = [];
        const chunkSize = 100;
        for (let i = 0; i < ids.length; i += chunkSize) {
          const chunk = ids.slice(i, i + chunkSize);
          const { data, error } = await supabase
            .from('questions')
            .select('id,title,body,metadata,created_at,updated_at')
            .in('id', chunk);
          if (error) break;
          if (Array.isArray(data)) out.push(...data);
        }
        if (cancelled) return;
        const byId = new Map(out.map((q) => [String(q?.id || ''), q]));
        const ordered = ids.map((id) => byId.get(String(id))).filter(Boolean);
        setQuestions(ordered);
        setSelectedQuestionIndex((prev) => {
          const n = ordered.length;
          if (n <= 0) return 0;
          if (Number.isFinite(prev) && prev >= 0 && prev < n) return prev;
          return 0;
        });
      } catch (_) {
        if (!cancelled) setQuestions([]);
      } finally {
        if (!cancelled) setQuestionsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [questionIds]);

  useEffect(() => {
    let cancelled = false;
    const id = String(simId || '').trim();
    if (!id) {
      setAttempts([]);
      setParticipants([]);
      return;
    }
    setAttemptsLoading(true);
    (async () => {
      const strategies = [
        { table: 'simulado_attempts', simCol: 'simulado_id' },
        { table: 'simulados_attempts', simCol: 'simulado_id' },
        { table: 'simulation_attempts', simCol: 'simulation_id' },
        { table: 'simulado_results', simCol: 'simulado_id' },
        { table: 'simulados_results', simCol: 'simulado_id' },
        { table: 'simulado_submissions', simCol: 'simulado_id' },
        { table: 'simulados_submissions', simCol: 'simulado_id' },
        { table: 'simulado_tentativas', simCol: 'simulado_id' },
        { table: 'simulados_tentativas', simCol: 'simulado_id' },
      ];

      const guessStudentId = (row) => {
        const r = row && typeof row === 'object' ? row : {};
        const candidates = [
          r.student_id,
          r.studentId,
          r.aluno_id,
          r.alunoId,
          r.user_id,
          r.userId,
          r.uid,
        ];
        for (const c of candidates) {
          const v = String(c || '').trim();
          if (v) return v;
        }
        return '';
      };

      try {
        let found = null;
        for (const strat of strategies) {
          const q = await supabase
            .from(strat.table)
            .select('*')
            .eq(strat.simCol, id)
            .limit(2000);
          if (q?.error) continue;
          found = { strat, rows: Array.isArray(q?.data) ? q.data : [] };
          break;
        }
        if (cancelled) return;
        const rows = found?.rows || [];
        setAttempts(rows);

        const studentIds = Array.from(new Set(rows.map(guessStudentId).filter(Boolean)));
        if (studentIds.length === 0) {
          setParticipants([]);
          return;
        }

        const { data: students, error: studentsError } = await supabase
          .from('students')
          .select('id,name,avatar_url,email')
          .in('id', studentIds)
          .limit(2000);
        const byId = new Map((Array.isArray(students) && !studentsError ? students : []).map((s) => [String(s?.id || ''), s]));

        const byStudent = new Map();
        for (const row of rows) {
          const sid = guessStudentId(row);
          if (!sid) continue;
          const createdAt = row?.created_at || row?.started_at || row?.start_at || row?.startDate || null;
          const endAt = row?.finished_at || row?.ended_at || row?.end_at || row?.endDate || row?.updated_at || null;
          const score = row?.score ?? row?.points ?? row?.total_score ?? row?.totalScore ?? row?.grade ?? null;
          const pct = row?.percentage ?? row?.percent ?? row?.aproveitamento ?? null;
          const current = {
            id: sid,
            name: byId.get(sid)?.name || row?.student_name || row?.name || 'Aluno',
            email: byId.get(sid)?.email || row?.student_email || row?.email || '',
            avatar_url: byId.get(sid)?.avatar_url || row?.avatar_url || null,
            startDate: createdAt,
            endDate: endAt,
            score,
            percent: pct,
          };
          const prev = byStudent.get(sid);
          if (!prev) {
            byStudent.set(sid, current);
          } else {
            const prevT = new Date(String(prev?.startDate || 0)).getTime();
            const curT = new Date(String(createdAt || 0)).getTime();
            if ((Number.isFinite(curT) ? curT : 0) >= (Number.isFinite(prevT) ? prevT : 0)) byStudent.set(sid, current);
          }
        }
        setParticipants(Array.from(byStudent.values()));
      } catch (_) {
        if (!cancelled) {
          setAttempts([]);
          setParticipants([]);
        }
      } finally {
        if (!cancelled) setAttemptsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [simId]);

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
    try {
      window.history.pushState({}, '', url.toString());
      setSimId(String(id));
    } catch (_) {
      window.location.href = url.toString();
    }
  };

  const studentAvatars = ['/verde.svg', '/azul.svg', '/laranja.svg', '/roxo.svg', '/amarelo.svg'];

  const filteredParticipants = (Array.isArray(participants)
    ? participants.filter((p) => (
      ((p?.name || '') + ' ' + (p?.email || '')).toLowerCase().includes((participantQuery || '').toLowerCase())
    ))
    : []);

  const simStatus = useMemo(() => {
    const s = sim && typeof sim === 'object' ? sim : null;
    const settings = (s?.settings && typeof s.settings === 'object') ? s.settings : (parseJsonMaybe(s?.settings) || {});
    if (settings?.archived === true) return 'Arquivado';
    if (settings?.draft === true) return 'Rascunho';
    const availability = s?.availability_date ? new Date(String(s.availability_date)) : null;
    if (availability && !Number.isNaN(availability.getTime()) && availability.getTime() > Date.now()) return 'Agendado';
    return 'Publicado';
  }, [sim]);

  const simCategories = useMemo(() => {
    const s = sim && typeof sim === 'object' ? sim : null;
    const settings = (s?.settings && typeof s.settings === 'object') ? s.settings : (parseJsonMaybe(s?.settings) || {});
    const candidates = [
      settings?.categories,
      settings?.categorias,
      settings?.category,
      settings?.categoria,
      s?.categories,
      s?.categorias,
      s?.category,
      s?.categoria,
    ];
    for (const c of candidates) {
      const list = normalizeToList(c);
      if (list.length > 0) return list;
    }
    return [];
  }, [sim]);

  const passingPct = useMemo(() => {
    const s = sim && typeof sim === 'object' ? sim : null;
    const settings = (s?.settings && typeof s.settings === 'object') ? s.settings : (parseJsonMaybe(s?.settings) || {});
    const raw = settings?.passingPercentage ?? settings?.approvalPercentage ?? settings?.approval ?? settings?.passing_pct ?? settings?.passingPct ?? 60;
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0 && n <= 100) return n;
    return 60;
  }, [sim]);

  const totalQuestions = useMemo(() => {
    if (Array.isArray(questions) && questions.length > 0) return questions.length;
    if (Array.isArray(questionIds) && questionIds.length > 0) return questionIds.length;
    return 0;
  }, [questions, questionIds]);

  const selectedQuestion = useMemo(() => {
    const list = Array.isArray(questions) ? questions : [];
    const idx = Number.isFinite(Number(selectedQuestionIndex)) ? Number(selectedQuestionIndex) : 0;
    if (idx < 0 || idx >= list.length) return null;
    return list[idx] || null;
  }, [questions, selectedQuestionIndex]);

  const selectedQuestionMeta = useMemo(() => {
    const meta = selectedQuestion?.metadata && typeof selectedQuestion.metadata === 'object'
      ? selectedQuestion.metadata
      : (parseJsonMaybe(selectedQuestion?.metadata) || {});
    return meta && typeof meta === 'object' ? meta : {};
  }, [selectedQuestion]);

  useEffect(() => {
    let cancelled = false;
    const fallback = '/config simulados.png';
    const resolve = async () => {
      const meta = selectedQuestionMeta || {};
      const img = meta.imageUrl || meta.image_url || meta.image || meta.imageSrc || meta.image_src || meta.imagePath || meta.image_path || '';
      const raw = String(img || '').trim();
      if (!raw) {
        if (!cancelled) setQuestionImageSrc(fallback);
        return;
      }

      const decodeBase64Url = (input) => {
        try {
          const base64 = String(input).replace(/-/g, '+').replace(/_/g, '/');
          const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
          return atob(padded);
        } catch (_) {
          return '';
        }
      };

      const isExpiredSignedUrl = (urlStr) => {
        try {
          const u = new URL(urlStr);
          const token = u.searchParams.get('token');
          if (!token) return false;
          const parts = token.split('.');
          if (parts.length < 2) return false;
          const payloadJson = decodeBase64Url(parts[1]);
          if (!payloadJson) return false;
          const payload = JSON.parse(payloadJson);
          const exp = Number(payload?.exp);
          if (!Number.isFinite(exp)) return false;
          return exp * 1000 <= Date.now() + 30_000;
        } catch (_) {
          return false;
        }
      };

      const refreshSignedUrl = async (signedUrl) => {
        try {
          const re = /\/storage\/v1\/object\/sign\/([^/]+)\/([^?]+)(?:\?|$)/;
          const m = String(signedUrl).match(re);
          if (!m) return '';
          const bucket = decodeURIComponent(m[1] || '');
          const path = decodeURIComponent(m[2] || '');
          if (!bucket || !path) return '';
          const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 7);
          if (error) return '';
          return String(data?.signedUrl || '').trim();
        } catch (_) {
          return '';
        }
      };

      if (raw.includes('/storage/v1/object/sign/') && isExpiredSignedUrl(raw)) {
        const refreshed = await refreshSignedUrl(raw);
        if (!cancelled) setQuestionImageSrc(refreshed || fallback);
        return;
      }

      if (!cancelled) setQuestionImageSrc(raw);
    };
    resolve();
    return () => { cancelled = true; };
  }, [selectedQuestion?.id, selectedQuestionMeta]);

  const selectedChoices = useMemo(() => {
    const meta = selectedQuestionMeta || {};
    const c = Array.isArray(meta.choices) ? meta.choices : (Array.isArray(meta.alternatives) ? meta.alternatives : (Array.isArray(meta.options) ? meta.options : []));
    return c.map((x) => (typeof x === 'string' ? x : String(x?.text || x?.label || x?.value || '').trim())).filter(Boolean);
  }, [selectedQuestionMeta]);

  const selectedCorrectIndex = useMemo(() => {
    const v = selectedQuestionMeta?.correctChoiceIndex ?? selectedQuestionMeta?.correct_choice_index ?? selectedQuestionMeta?.correctIndex ?? null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }, [selectedQuestionMeta]);

  const perQuestionPoints = useMemo(() => {
    const max = Number(sim?.max_grade ?? sim?.maxGrade ?? 0);
    if (!Number.isFinite(max) || max <= 0) return 0;
    const n = totalQuestions > 0 ? totalQuestions : (Array.isArray(questionIds) ? questionIds.length : 0);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.max(0, Math.round(max / n));
  }, [sim, totalQuestions, questionIds]);

  const selectedPoints = useMemo(() => {
    const v = selectedQuestionMeta?.points ?? selectedQuestionMeta?.score ?? 0;
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
    return perQuestionPoints;
  }, [selectedQuestionMeta, perQuestionPoints]);

  const distribution = useMemo(() => {
    const list = Array.isArray(attempts) ? attempts : [];
    const qid = String(selectedQuestion?.id || '').trim();
    if (!qid || list.length === 0 || selectedChoices.length === 0) {
      return { total: 0, counts: {}, correct: 0, incorrect: 0 };
    }

    const extractAnswerMap = (row) => {
      const r = row && typeof row === 'object' ? row : {};
      const candidates = [
        r.answers,
        r.respostas,
        r.responses,
        r.response,
        r.data,
        r.payload,
        r.meta,
      ];
      for (const cand of candidates) {
        const obj = parseJsonMaybe(cand);
        if (!obj) continue;
        if (Array.isArray(obj)) {
          const m = new Map();
          for (const it of obj) {
            if (!it || typeof it !== 'object') continue;
            const q = String(it.question_id || it.questionId || it.qid || it.id || '').trim();
            if (!q) continue;
            const v = it.choiceIndex ?? it.choice_index ?? it.selectedChoiceIndex ?? it.selected_choice_index ?? it.selectedOptionIndex ?? it.selected_option_index ?? it.answer ?? it.value ?? null;
            const n = Number(v);
            if (Number.isFinite(n)) m.set(q, n);
          }
          if (m.size > 0) return m;
        }
        if (obj && typeof obj === 'object') {
          const m = new Map();
          const keys = Object.keys(obj);
          for (const k of keys) {
            const v = obj[k];
            if (v && typeof v === 'object') {
              const q = String(v.question_id || v.questionId || k || '').trim();
              const idx = v.choiceIndex ?? v.choice_index ?? v.selectedChoiceIndex ?? v.selected_choice_index ?? v.answer ?? v.value ?? null;
              const n = Number(idx);
              if (q && Number.isFinite(n)) m.set(q, n);
              continue;
            }
            const n = Number(v);
            if (Number.isFinite(n)) m.set(String(k || '').trim(), n);
          }
          if (m.size > 0) return m;
        }
      }
      return null;
    };

    const counts = {};
    let total = 0;
    for (const row of list) {
      const m = extractAnswerMap(row);
      if (!m) continue;
      const idx = m.get(qid);
      if (!Number.isFinite(Number(idx))) continue;
      total += 1;
      const k = String(Number(idx));
      counts[k] = (counts[k] || 0) + 1;
    }

    let correct = 0;
    if (selectedCorrectIndex !== null && Number.isFinite(Number(selectedCorrectIndex))) {
      correct = counts[String(Number(selectedCorrectIndex))] || 0;
    }
    const incorrect = Math.max(0, total - correct);
    return { total, counts, correct, incorrect };
  }, [attempts, selectedQuestion, selectedChoices, selectedCorrectIndex]);

  const overallStats = useMemo(() => {
    const list = Array.isArray(attempts) ? attempts : [];
    if (list.length === 0) return { submissions: 0, approvalPct: 0, reprovalPct: 0 };

    const max = (() => {
      const fromSim = Number(sim?.max_grade ?? sim?.maxGrade ?? 0);
      if (Number.isFinite(fromSim) && fromSim > 0) return fromSim;
      const sum = (Array.isArray(questions) ? questions : []).reduce((acc, q) => {
        const meta = q?.metadata && typeof q.metadata === 'object' ? q.metadata : (parseJsonMaybe(q?.metadata) || {});
        const p = Number(meta?.points ?? 0);
        return acc + (Number.isFinite(p) ? p : 0);
      }, 0);
      return sum > 0 ? sum : 100;
    })();

    const calcPct = (row) => {
      const p = row?.percentage ?? row?.percent ?? row?.aproveitamento ?? row?.approval ?? null;
      const pn = Number(String(p || '').replace('%', ''));
      if (Number.isFinite(pn) && pn >= 0 && pn <= 100) return pn;
      const score = Number(row?.score ?? row?.points ?? row?.total_score ?? row?.totalScore ?? row?.grade ?? null);
      if (Number.isFinite(score) && max > 0) return Math.max(0, Math.min(100, (score / max) * 100));
      return 0;
    };

    let approved = 0;
    for (const row of list) {
      const pct = calcPct(row);
      if (pct >= passingPct) approved += 1;
    }
    const submissions = list.length;
    const approvalPct = submissions > 0 ? Math.round((approved / submissions) * 100) : 0;
    const reprovalPct = submissions > 0 ? Math.round(((submissions - approved) / submissions) * 100) : 0;
    return { submissions, approvalPct, reprovalPct };
  }, [attempts, sim, questions, passingPct]);

  return (
    <div className="min-h-screen bg-[#FFFFFF]">
      <Helmet>
        <title>Simulados – Aproveitamento</title>
        <meta name="description" content="Resumo de aproveitamento do simulado." />
      </Helmet>

      {/* Botão de voltar movido para o Header quando nesta rota */}

      <div className="pt-8 px-6 pb-10">
        {simLoading ? (
          <div className="text-[12px] text-[#737780]">Carregando simulado…</div>
        ) : simError ? (
          <div className="text-[12px] text-red-600">{simError}</div>
        ) : null}
        <div className="flex items-start justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2">
              <span className={`inline-flex items-center justify-center w-[64px] h-[18px] px-3 text-[10px] rounded-[54px] leading-none font-medium ${
                simStatus === 'Publicado' ? 'bg-[#E9FFEF] text-[#06C270]' : (simStatus === 'Rascunho' ? 'bg-yellow-100 text-yellow-800' : 'bg-[#F6F5FA] text-[#3A3D45]')
              }`}>{simStatus}</span>
            </div>
            <div className="space-y-[6px]">
              <h1 className="text-[18px] font-semibold text-[#000000] font-inter">{sim?.title || 'Nome do simulado aqui'}</h1>
              <div className="flex items-center gap-2">
                {simCategories.map((c, i) => (
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
              <span className="text-[14px] font-inter font-semibold text-[#000000]">Simulado:</span> {totalQuestions} Questões · Criado em: {formatDateBr(sim?.created_at) || '—'}
            </div>
            <div className="space-y-[32px]">
              <div className="grid grid-cols-3 gap-6">
                <StatBadge color="#22C55E" label="Aprovação (%)" value={`${overallStats.approvalPct}%`} groupBelow />
                <StatBadge color="#EF4444" label="Reprovação (%)" value={`${overallStats.reprovalPct}%`} groupBelow />
                <StatBadge label="Submissões" value={String(overallStats.submissions)} stacked />
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
            <img
              src={(() => {
                const v = String(sim?.cover_image_url || '').trim()
                return v || '/simulado-cover.svg'
              })()}
              alt={sim?.title || 'Ilustração'}
              className="w-[342px] h-[207.34px] object-cover"
              loading="lazy"
              decoding="async"
            />
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
                  <span className="px-2 py-0.5 rounded bg-[#F6F5FA]">{String(selectedPoints || 0)}</span>
                  <span>Pontos</span>
                  <span className="w-1 h-1 rounded-full bg-[#FFD400]"></span>
                </div>
              </div>

              <div className="p-5">
                {questionsLoading ? (
                  <div className="text-[12px] text-[#737780]">Carregando questões…</div>
                ) : (Array.isArray(questions) && questions.length > 0 && selectedQuestion) ? (
                  <>
                    <div className="flex items-start gap-4">
                      <img
                        src={questionImageSrc}
                        alt="mini"
                        className="w-[227.63px] h-[138px] object-cover rounded"
                        onError={(e) => {
                          const el = e?.currentTarget;
                          if (!el) return;
                          if (el.src && el.src.includes('/config simulados.png')) return;
                          setQuestionImageSrc('/config simulados.png');
                        }}
                      />
                      <div className="flex-1 space-y-3">
                        <div className="inline-flex items-center gap-2">
                          <span className="w-[20px] h-[20px] rounded grid place-items-center text-[12px] text-[#0047BB]">{selectedQuestionIndex + 1}</span>
                          <span className="text-[12px] text-[#3A3D45]">Questão</span>
                        </div>
                        <div className="text-[12px] text-[#3A3D45]">{stripHtml(selectedQuestion.body || selectedQuestion.title || '') || '—'}</div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                      {questions.map((q, idx) => (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => setSelectedQuestionIndex(idx)}
                          className={`w-7 h-7 rounded-[6px] border text-[12px] ${idx === selectedQuestionIndex ? 'bg-[#0047BB] border-[#0047BB] text-white' : 'bg-white border-[#E3E4E5] text-[#3A3D45] hover:bg-[#F6F5FA]'}`}
                          aria-label={`Selecionar questão ${idx + 1}`}
                        >
                          {idx + 1}
                        </button>
                      ))}
                    </div>

                    <div className="mt-4 grid grid-cols-[auto_300px] gap-6">
                      <div className="space-y-4">
                        {selectedChoices.length === 0 ? (
                          <div className="text-[12px] text-[#737780]">Esta questão não possui alternativas.</div>
                        ) : (
                          selectedChoices.slice(0, 6).map((choice, idx) => {
                            const total = distribution.total || 0;
                            const cnt = distribution.counts[String(idx)] || 0;
                            const pct = total > 0 ? Math.round((cnt / total) * 100) : 0;
                            const letter = String.fromCharCode(65 + idx);
                            return (
                              <Option key={idx} letter={letter} percent={pct} responses={cnt} correct={selectedCorrectIndex === idx}>
                                {choice}
                              </Option>
                            );
                          })
                        )}
                      </div>

                      <aside className="border border-[#E3E4E5] rounded-lg p-4 bg-[#FFFFFF] w-[236px] h-[202px]">
                        <div className="text-[12px] font-medium text-[#22252B] mb-3">Estatística</div>
                        <div className="space-y-2 text-[12px] text-[#3A3D45]">
                          <div className="flex items-center justify-between">
                            <span>Respostas corretas</span>
                            <span className="text-[#22C55E]">{String(distribution.correct || 0)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Respostas erradas</span>
                            <span className="text-[#EF4444]">{String(distribution.incorrect || 0)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Taxa de aproveitamento</span>
                            <span className="text-[#22C55E]">{distribution.total > 0 ? `${Math.round((distribution.correct / distribution.total) * 100)}%` : '0%'}</span>
                          </div>
                        </div>
                      </aside>
                    </div>
                  </>
                ) : (
                  <div className="text-[12px] text-[#737780]">Este simulado não possui questões vinculadas.</div>
                )}
              </div>
            </div>
          ) : (
            <div className="border border-[#E3E4E5] rounded-lg bg-[#FFFFFF] w-full h-[532px] overflow-auto">
              <div className="flex items-center justify-between px-5 py-3 border-b border-[#E3E4E5]">
                <div className="flex items-center gap-2">
                  <img src="/icons/alunos.svg?v=2" alt="Participantes" className="w-4 h-4" />
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
                  {attemptsLoading ? (
                    <li className="px-4 py-4 text-[12px] text-[#737780]">Carregando participantes…</li>
                  ) : filteredParticipants.length === 0 ? (
                    <li className="px-4 py-4 text-[12px] text-[#737780]">Nenhum participante encontrado.</li>
                  ) : null}
                  {filteredParticipants.map((p, idx) => (
                    <li key={idx} className="grid grid-cols-[2fr,1.2fr,1.2fr,1fr,1fr] items-center py-3 px-4 bg-white">
                      <div className="flex items-center gap-3">
                        <img src={p.avatar_url || studentAvatars[idx % studentAvatars.length]} alt={p.name} className="w-[28px] h-[28px] rounded-full ring-1 ring-white object-cover" />
                        <div className="flex flex-col">
                          <span className="text-[12px] text-[#1E1B39] font-inter font-medium">{p.name}</span>
                          <span className="text-[12px] text-[#9291A5]">{p.email}</span>
                        </div>
                      </div>
                      <span className="text-[12px] text-[#3A3D45] justify-self-center text-center">{formatDateBr(p.startDate) || '—'}</span>
                      <span className="text-[12px] text-[#3A3D45] justify-self-center text-center">{formatDateBr(p.endDate) || '—'}</span>
                      <div className="flex items-center gap-2 justify-end text-[12px] text-[#3A3D45] pr-2 w-full justify-self-end">
                        <span className="text-right">{p.score == null ? '—' : `${String(p.score)} Pontos`}</span>
                        <PontuacaoDot className="w-3 h-3 shrink-0" />
                      </div>
                      <div className="flex items-center gap-1 text-[12px] text-[#0047BB] w-full justify-self-end justify-end">
                        <span className="inline-block whitespace-nowrap leading-[16px]">{(() => {
                          const v = p.percent;
                          const n = Number(String(v || '').replace('%', ''));
                          if (Number.isFinite(n)) return `${Math.round(n)}%`;
                          return '0%';
                        })()}</span>
                        <AproveitamentoIcon className="w-4 h-4 text-blue-500" percent={(() => {
                          const v = p.percent;
                          const n = Number(String(v || '').replace('%', ''));
                          if (Number.isFinite(n)) return Math.round(n);
                          return 0;
                        })()} />
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
