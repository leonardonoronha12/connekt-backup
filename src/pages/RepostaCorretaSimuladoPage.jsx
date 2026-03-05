import React, { useEffect, useMemo, useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useActiveProducerUserId } from '@/hooks/useActiveProducerUserId';
import { useAuth } from '@/contexts/SupabaseAuthContext'

function InlineDeferredVideo({ src }) {
  const [armed, setArmed] = useState(false)
  const videoRef = useRef(null)

  useEffect(() => {
    setArmed(false)
  }, [src])

  useEffect(() => {
    if (!armed) return
    const v = videoRef.current
    if (!v) return
    try {
      const p = v.play?.()
      if (p && typeof p.catch === 'function') p.catch(() => {})
    } catch (_) {}
  }, [armed])

  if (!src) return null
  const finalSrc = (typeof src === 'string' && src.includes('.supabase.co/storage/v1/object/')) ? `/api/media?u=${encodeURIComponent(src)}` : src

  if (!armed) {
    return (
      <button
        type="button"
        className="w-full aspect-video rounded-[4px] border border-gray-200 bg-black flex items-center justify-center"
        onClick={() => setArmed(true)}
        aria-label="Carregar vídeo"
      >
        <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center text-black text-[18px]">
          ▶
        </div>
      </button>
    )
  }

  return (
    <video
      ref={videoRef}
      className="w-full rounded-[4px] border border-gray-200 bg-black"
      controls
      preload="metadata"
      playsInline
      src={finalSrc}
      onError={(e) => {
        const v = e.currentTarget
        if (!finalSrc.startsWith('/api/media?u=')) return
        if (v?.dataset?.fallbackUsed === '1') return
        v.dataset.fallbackUsed = '1'
        v.src = src
        try {
          v.load()
          const p = v.play?.()
          if (p && typeof p.catch === 'function') p.catch(() => {})
        } catch (_) {}
      }}
    />
  )
}

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
  const statusColor =
    status === 'correct'
      ? 'bg-green-500'
      : status === 'wrong'
        ? 'bg-red-500'
        : status === 'answered'
          ? 'bg-blue-500'
          : 'bg-gray-300';
  return (
    <button
      type="button"
      data-action="open-question"
      data-value={index}
      className="flex w-full min-h-[36px] items-center justify-between rounded border border-transparent bg-white px-4 py-2 text-left opacity-100 hover:bg-gray-50 rotate-0"
    >
      <div className="flex items-center gap-3">
        <span className={`${statusColor} inline-flex items-center justify-center rounded-full ${statusColor === 'bg-green-500' || statusColor === 'bg-gray-300' || statusColor === 'bg-red-500' ? 'w-[16.250003814697266px] h-[16.250003814697266px]' : 'w-2 h-2'}`}>
          {statusColor === 'bg-red-500' ? (
            <img src="/errada.png" alt="Errada" className="w-full h-full rotate-0 opacity-100 object-contain" />
          ) : statusColor === 'bg-green-500' ? (
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
  const isAlunoView = typeof window !== 'undefined' && String(window.location.pathname || '').startsWith('/aluno/');
  const { user } = useAuth()
  const activeProducerUserId = useActiveProducerUserId()
  const params = (() => {
    try {
      const sp = new URLSearchParams(window.location.search || '');
      return {
        simId: sp.get('simId') || 'preview',
        demo: sp.get('demo') === '1',
        resultado: sp.get('resultado') === '1' || sp.get('resultado') === 'true' || sp.get('result') === '1',
      };
    } catch (_) {
      return { simId: 'preview', demo: false, resultado: false };
    }
  })();
  const pauseKey = `connekt_simulado_pause_${params.simId}`;
  const finishKey = `connekt_simulado_finish_${params.simId}`;
  const progressKey = `connekt_simulado_progress:${params.simId}`;
  const startKey = `connekt_simulado_started_${params.simId}`
  const previewKey = params.simId && params.simId !== 'preview' ? `connekt_simulationPreview:${params.simId}` : 'simulationPreview'
  const navigateTo = (path) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

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
  const [finishedAt, setFinishedAt] = useState(null);
  const [finalRemainingMs, setFinalRemainingMs] = useState(null);
  const endTimeRef = useRef(null);
  const interactedRef = useRef(false)
  const [studentProfile, setStudentProfile] = useState({ name: '', avatar_url: '' })
  const [confirmModal, setConfirmModal] = useState({ open: false, mode: '' })

  const getAllowRepeat = () => {
    try {
      const raw = localStorage.getItem(`connekt_simulado_allowRepeat:${params.simId}`)
      if (raw === '0') return false
      if (raw === '1') return true
    } catch (_) {}
    try {
      const raw = localStorage.getItem(previewKey) || localStorage.getItem('simulationPreview')
      if (!raw) return true
      const parsed = JSON.parse(raw)
      if (typeof parsed?.allowRepeat === 'boolean') return Boolean(parsed.allowRepeat)
      if (typeof parsed?.allow_repeat === 'boolean') return Boolean(parsed.allow_repeat)
      return true
    } catch (_) {
      return true
    }
  }

  const getAvailabilityWindow = () => {
    const parseStartMs = (v) => {
      const s = String(v || '').trim()
      if (!s) return null
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
      if (m) return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0)
      const t = new Date(s).getTime()
      if (!Number.isFinite(t)) return null
      return t
    }
    const parseEndMsInclusive = (v) => {
      const s = String(v || '').trim()
      if (!s) return null
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
      if (m) return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999)
      const t = new Date(s).getTime()
      if (!Number.isFinite(t)) return null
      return t
    }
    let startRaw = ''
    let endRaw = ''
    try {
      startRaw = localStorage.getItem(`connekt_simulado_windowStart:${params.simId}`) || ''
      endRaw = localStorage.getItem(`connekt_simulado_windowEnd:${params.simId}`) || ''
    } catch (_) {}
    if (!startRaw || !endRaw) {
      try {
        const raw = localStorage.getItem(previewKey) || localStorage.getItem('simulationPreview')
        if (raw) {
          const parsed = JSON.parse(raw)
          if (!startRaw && parsed?.availabilityStartDate) startRaw = String(parsed.availabilityStartDate || '')
          if (!endRaw && parsed?.availabilityEndDate) endRaw = String(parsed.availabilityEndDate || '')
        }
      } catch (_) {}
    }
    const startMs = parseStartMs(startRaw)
    const endMs = parseEndMsInclusive(endRaw)
    return { startMs, endMs }
  }

  useEffect(() => {
    try {
      if (isAlunoView && !params.resultado) {
        if (!params.demo) {
          const { startMs, endMs } = getAvailabilityWindow()
          const now = Date.now()
          if (startMs != null && now < startMs) {
            const suffix = params.demo ? `&demo=1` : ''
            navigateTo(`/aluno/simulados/acesso?simId=${encodeURIComponent(params.simId)}${suffix}`)
            return
          }
          if (endMs != null && now > endMs) {
            let hasFinish = false
            try { hasFinish = !!localStorage.getItem(finishKey) } catch (_) { hasFinish = false }
            const suffix = params.demo ? `&demo=1` : ''
            if (hasFinish) {
              navigateTo(`/aluno/simulados/resultado?simId=${encodeURIComponent(params.simId)}${suffix}`)
              return
            }
            navigateTo(`/aluno/simulados/acesso?simId=${encodeURIComponent(params.simId)}${suffix}`)
            return
          }
        }
        const allowRepeat = getAllowRepeat()
        let hasFinish = false
        try {
          hasFinish = !!localStorage.getItem(finishKey)
        } catch (_) {
          hasFinish = false
        }
        if (hasFinish && !allowRepeat) {
          const suffix = params.demo ? `&demo=1` : ''
          navigateTo(`/aluno/simulados/resultado?simId=${encodeURIComponent(params.simId)}${suffix}`)
          return
        }
        try {
          localStorage.removeItem(pauseKey);
          if (allowRepeat) localStorage.removeItem(finishKey);
          localStorage.setItem(progressKey, '0');
          localStorage.setItem(startKey, String(Date.now()))
        } catch (_) {}
      }
      const raw = localStorage.getItem(previewKey) || localStorage.getItem('simulationPreview');
      let paused = null;
      try {
        const rawPaused = localStorage.getItem(pauseKey);
        if (rawPaused) paused = JSON.parse(rawPaused);
      } catch (_) {}
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
        const baseStatuses = Array.from({ length: Math.max(total, 1) }, () => 'neutral');
        const baseSelected = Array.from({ length: Math.max(total, 1) }, () => null);

        const nextActiveQuestion = Math.max(1, Math.min(Number(paused?.activeQuestion) || 1, Math.max(total, 1)));
        const nextSelected = Array.isArray(paused?.selectedIndices) ? paused.selectedIndices : null;
        const nextStatuses = Array.isArray(paused?.questionStatuses) ? paused.questionStatuses : null;

        setQuestionStatuses(Array.isArray(nextStatuses) ? baseStatuses.map((_, i) => nextStatuses[i] || 'neutral') : baseStatuses);
        setSelectedIndices(Array.isArray(nextSelected) ? baseSelected.map((_, i) => (Number.isFinite(Number(nextSelected[i])) ? Number(nextSelected[i]) : null)) : baseSelected);
        setActiveQuestion(nextActiveQuestion);
        setAproveitamentoPercent(Math.max(0, Math.min(100, Number(paused?.aproveitamentoPercent) || 0)));

        let finished = null;
        try {
          const rawFinished = localStorage.getItem(finishKey);
          if (rawFinished) finished = JSON.parse(rawFinished);
        } catch (_) {}

        const fAt = finished?.finishedAt || null;
        const fRemaining = Number.isFinite(Number(finished?.finalRemainingMs)) ? Number(finished.finalRemainingMs) : null;
        setFinishedAt(fAt ? String(fAt) : null);
        setFinalRemainingMs(fRemaining);

        // Inicializa o cronômetro com base na duração em minutos
        const durationMs = Math.max(0, (Number(parsed?.durationMinutes) || 0) * 60_000);
        const startRestMs = Math.max(0, Number(paused?.remainingMs) || durationMs);
        const restMs = fRemaining != null ? Math.max(0, fRemaining) : startRestMs;
        if (fRemaining != null || params.resultado) {
          endTimeRef.current = null;
        } else {
          endTimeRef.current = Date.now() + restMs;
        }
        setRemainingMs(restMs);
      }
    } catch (err) {
      console.warn('Falha ao carregar simulationPreview:', err);
    }
  }, []);

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!isAlunoView) return
      if (params.demo) return
      const uid = String(user?.id || '').trim()
      const email = String(user?.email || '').trim()
      if (!uid && !email) return
      const attempts = [
        () => supabase.from('students').select('name,avatar_url').eq('user_id', uid).maybeSingle(),
        () => supabase.from('students').select('name,avatar_url').eq('external_id', uid).maybeSingle(),
        () => supabase.from('students').select('name,avatar_url').eq('email', email).maybeSingle(),
      ]
      for (const fn of attempts) {
        try {
          const { data, error } = await fn()
          if (cancelled) return
          if (error) continue
          if (data?.name || data?.avatar_url) {
            setStudentProfile({ name: String(data?.name || ''), avatar_url: String(data?.avatar_url || '') })
            return
          }
        } catch (_) {}
      }
    }
    run()
    return () => { cancelled = true }
  }, [isAlunoView, params.demo, user?.id, user?.email])

  const studentName = useMemo(() => {
    const fromStudents = String(studentProfile?.name || '').trim()
    const meta = user?.user_metadata && typeof user.user_metadata === 'object' ? user.user_metadata : {}
    const fromMeta = String(meta.full_name || meta.name || meta.user_name || '').trim()
    const raw = fromStudents || fromMeta || String(user?.email || '').split('@')[0] || ''
    const parts = raw.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) return `${parts[0]} ${parts[parts.length - 1]}`
    return raw || 'Aluno'
  }, [studentProfile?.name, user?.user_metadata, user?.email])

  const studentAvatar = useMemo(() => {
    const fromStudents = String(studentProfile?.avatar_url || '').trim()
    const meta = user?.user_metadata && typeof user.user_metadata === 'object' ? user.user_metadata : {}
    const fromMeta = String(meta.avatar_url || meta.picture || '').trim()
    return fromStudents || fromMeta || '/perfil rc.png'
  }, [studentProfile?.avatar_url, user?.user_metadata])

  const doPause = () => {
    if (!isAlunoView) return
    if (isFinished) return
    try {
      localStorage.setItem(
        pauseKey,
        JSON.stringify({
          pausedAt: new Date().toISOString(),
          remainingMs,
          activeQuestion,
          selectedIndices,
          questionStatuses,
          aproveitamentoPercent,
        })
      )
    } catch (_) {}
    try {
      const url = new URL('/aluno/simulados', window.location.origin)
      if (params.demo) url.searchParams.set('demo', '1')
      navigateTo(`${url.pathname}${url.search}`)
    } catch (_) {
      navigateTo(`/aluno/simulados${params.demo ? '?demo=1' : ''}`)
    }
  }

  const doExit = () => {
    if (!isAlunoView) return
    try {
      const url = new URL('/aluno/simulados', window.location.origin)
      if (params.demo) url.searchParams.set('demo', '1')
      navigateTo(`${url.pathname}${url.search}`)
    } catch (_) {
      navigateTo(`/aluno/simulados${params.demo ? '?demo=1' : ''}`)
    }
  }

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!isAlunoView) return
      if (params.demo) return
      if (!params.simId || params.simId === 'preview') return
      const producerId = String(activeProducerUserId || '').trim()
      if (!producerId) return
      try {
        const token = (await supabase.auth.getSession().catch(() => ({ data: null })))?.data?.session?.access_token || ''
        if (!token) return
        const r = await fetch(`/api/producer?type=simulado_runner&simId=${encodeURIComponent(String(params.simId))}&producerId=${encodeURIComponent(producerId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const body = await r.json().catch(() => ({}))
        if (cancelled) return
        if (!r.ok) return
        const data = body?.data || null
        if (!data || typeof data !== 'object') return
        if (interactedRef.current) return
        const nextPreview = {
          title: data?.title || '',
          totalPoints: Number(data?.totalPoints) || 0,
          attempts: Number(data?.attempts) || 1,
          durationMinutes: Number(data?.durationMinutes) || 0,
          questions: Array.isArray(data?.questions) ? data.questions : [],
          meta: data?.meta && typeof data.meta === 'object' ? data.meta : null,
        }
        const normalizeIds = (list) =>
          (Array.isArray(list) ? list : [])
            .map((v) => String(v?.id || v || '').trim())
            .filter(Boolean)
        let storedPreview = null
        try {
          const raw = localStorage.getItem(previewKey)
          if (raw) storedPreview = JSON.parse(raw)
        } catch (_) {}
        const currentQuestionIds = normalizeIds(storedPreview?.questions || preview?.questions)
        const nextQuestionIds = normalizeIds(nextPreview?.questions)
        const sameIds =
          currentQuestionIds.length === nextQuestionIds.length &&
          currentQuestionIds.every((v, idx) => v === nextQuestionIds[idx])
        const shouldReplace =
          !sameIds ||
          String(storedPreview?.title || preview?.title || '') !== String(nextPreview?.title || '') ||
          Number(storedPreview?.durationMinutes || preview?.durationMinutes || 0) !== Number(nextPreview?.durationMinutes || 0) ||
          Number(storedPreview?.totalPoints || preview?.totalPoints || 0) !== Number(nextPreview?.totalPoints || 0) ||
          Number(storedPreview?.attempts || preview?.attempts || 1) !== Number(nextPreview?.attempts || 1)
        if (!shouldReplace) return
        setPreview(nextPreview)
        try { localStorage.setItem(previewKey, JSON.stringify(nextPreview)) } catch (_) {}
        try { localStorage.setItem('simulationPreview', JSON.stringify(nextPreview)) } catch (_) {}
        const total = Array.isArray(nextPreview?.questions) ? nextPreview.questions.length : 0
        if (total > 0) {
          setQuestionStatuses(Array.from({ length: total }, () => 'neutral'))
          setSelectedIndices(Array.from({ length: total }, () => null))
          setActiveQuestion(1)
          const durationMs = Math.max(0, (Number(nextPreview?.durationMinutes) || 0) * 60_000)
          endTimeRef.current = durationMs > 0 ? Date.now() + durationMs : null
          setRemainingMs(durationMs)
        }
      } catch (_) {}
    }
    run()
    return () => { cancelled = true }
  }, [isAlunoView, params.demo, params.simId, activeProducerUserId, previewKey]);

  useEffect(() => {
    if (!isAlunoView) return;
    if (!params.resultado) return;
    try {
      const url = new URL('/aluno/simulados/resultado', window.location.origin);
      url.searchParams.set('simId', String(params.simId || 'preview'));
      if (params.demo) url.searchParams.set('demo', '1');
      navigateTo(`${url.pathname}${url.search}`);
    } catch (_) {
      navigateTo(`/aluno/simulados/resultado?simId=${encodeURIComponent(String(params.simId || 'preview'))}${params.demo ? '&demo=1' : ''}`);
    }
  }, [isAlunoView, params.resultado]);

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
  const correctCount = questionStatuses.filter((s) => s === 'correct').length;
  const wrongCount = questionStatuses.filter((s) => s === 'wrong').length;
  const answeredCount = correctCount + wrongCount;
  const isFinished = params.resultado || (typeof finishedAt === 'string' && finishedAt.length > 0);
  const canRevealAnswer = !isAlunoView || isFinished;
  const durationMs = Math.max(0, (Number(preview.durationMinutes) || 0) * 60_000);
  const usedMs = Math.max(0, durationMs - Math.max(0, Number(finalRemainingMs != null ? finalRemainingMs : remainingMs) || 0));
  const resultTitle = isFinished ? 'Resultado final' : 'Simulado';

  const finalizeSimulado = () => {
    const pct = totalQuestions > 0 ? Math.round((questionStatuses.filter((s) => s === 'correct').length / totalQuestions) * 100) : 0
    try {
      const fAt = new Date().toISOString()
      const startedAtMs = (() => {
        try {
          const raw = localStorage.getItem(startKey)
          const n = Number(raw)
          return Number.isFinite(n) && n > 0 ? n : null
        } catch (_) {
          return null
        }
      })()
      const durationMs = Math.max(0, (Number(preview.durationMinutes) || 0) * 60_000)
      const usedMs =
        durationMs > 0
          ? Math.max(0, durationMs - Math.max(0, Number(remainingMs) || 0))
          : (startedAtMs != null ? Math.max(0, Date.now() - startedAtMs) : 0)
      localStorage.setItem(
        finishKey,
        JSON.stringify({
          finishedAt: fAt,
          finalRemainingMs: remainingMs,
          aproveitamentoPercent: pct,
          startedAt: startedAtMs != null ? new Date(startedAtMs).toISOString() : null,
          usedMs,
          selectedIndices,
          questionStatuses,
          preview: {
            title: preview?.title || '',
            totalPoints: Number(preview?.totalPoints) || 0,
            attempts: Number(preview?.attempts) || 1,
            durationMinutes: Number(preview?.durationMinutes) || 0,
            questions: Array.isArray(preview?.questions) ? preview.questions : [],
          },
        })
      )
      localStorage.removeItem(pauseKey)
      try { localStorage.setItem(progressKey, '100') } catch (_) {}
      setFinishedAt(fAt)
      setFinalRemainingMs(remainingMs)
      setAproveitamentoPercent(pct)
    } catch (_) {}

    try {
      const url = new URL('/aluno/simulados/resultado', window.location.origin)
      url.searchParams.set('simId', String(params.simId || 'preview'))
      if (params.demo) url.searchParams.set('demo', '1')
      navigateTo(`${url.pathname}${url.search}`)
    } catch (_) {
      navigateTo(`/aluno/simulados/resultado?simId=${encodeURIComponent(String(params.simId || 'preview'))}${params.demo ? '&demo=1' : ''}`)
    }
  }

  const handleClick = (e) => {
    const t = e?.target
    const el =
      (t && typeof t.closest === 'function' ? t.closest('[data-action]') : null) ||
      (t?.parentElement && typeof t.parentElement.closest === 'function' ? t.parentElement.closest('[data-action]') : null)
    if (!el) return
    const action = el.getAttribute('data-action')
    const value = el.getAttribute('data-value')
    switch (action) {
      case 'select-option':
        {
          if (isFinished) break;
          interactedRef.current = true
          const idx = Number(value);
          const q = preview.questions?.[activeQuestion - 1];
          const choices = Array.isArray(q?.choices) ? q.choices : [];
          const isCorrect = !!choices[idx]?.is_correct;
          const nextSelected = [...selectedIndices];
          nextSelected[activeQuestion - 1] = idx;
          const nextStatuses = [...questionStatuses];
          nextStatuses[activeQuestion - 1] = isCorrect ? 'correct' : 'wrong';
          const nextCorrect = nextStatuses.filter((s) => s === 'correct').length;
          const nextWrong = nextStatuses.filter((s) => s === 'wrong').length;
          const nextAnswered = nextCorrect + nextWrong;
          const pct = totalQuestions > 0 ? Math.round((nextCorrect / totalQuestions) * 100) : 0;
          setSelectedIndices(nextSelected);
          setQuestionStatuses(nextStatuses);
          setAproveitamentoPercent(pct);
        }
        break;
      case 'open-question':
        setActiveQuestion(Number(value));
        break;
      case 'skip':
        // Pular para próxima questão
        setActiveQuestion((q) => Math.min(q + 1, Math.max(totalQuestions, 1)));
        break;
      case 'next':
        setActiveQuestion((q) => Math.min(q + 1, Math.max(totalQuestions, 1)))
        break
      case 'finish':
        if (isFinished) break
        finalizeSimulado()
        break
      case 'pause':
        if (!isAlunoView) break;
        if (isFinished) break;
        try {
          localStorage.setItem(
            pauseKey,
            JSON.stringify({
              pausedAt: new Date().toISOString(),
              remainingMs,
              activeQuestion,
              selectedIndices,
              questionStatuses,
              aproveitamentoPercent,
            })
          );
        } catch (_) {}
        try {
          const url = new URL('/aluno/simulados', window.location.origin);
          if (params.demo) url.searchParams.set('demo', '1');
          navigateTo(`${url.pathname}${url.search}`);
        } catch (_) {
            navigateTo(`/aluno/simulados${params.demo ? '?demo=1' : ''}`);
          }
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

  const isUrl = (v) => typeof v === 'string' && v.trim().length > 0;
  const normalize = (v) => (typeof v === 'string' ? v.trim() : '');
  const resolveSupabasePublicUrl = (rawValue) => {
    const u = normalize(rawValue);
    if (!u) return u;
    if (u.startsWith('data:') || u.startsWith('blob:')) return u;
    try {
      const parsed = new URL(u);
      const m = parsed.pathname.match(/\/storage\/v1\/object\/sign\/([^/]+)\/(.+)$/);
      if (m?.[1] && m?.[2]) {
        parsed.pathname = `/storage/v1/object/public/${m[1]}/${m[2]}`;
        parsed.search = '';
        parsed.hash = '';
        return parsed.toString();
      }
      return u;
    } catch {
      const base = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL)
        ? String(import.meta.env.VITE_SUPABASE_URL)
        : '';
      const bucket = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_QUESTION_IMAGES_BUCKET)
        ? String(import.meta.env.VITE_SUPABASE_QUESTION_IMAGES_BUCKET)
        : 'question-images';
      if (!base) return u;
      let p = u.replace(/^\/+/, '');
      if (p.startsWith(`${bucket}/`)) p = p.slice(bucket.length + 1);
      if (p.startsWith('question-images/')) p = p.slice('question-images/'.length);
      return `${base.replace(/\/+$/, '')}/storage/v1/object/public/${bucket}/${p}`;
    }
  };
  const getText = (v) => {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'number') return String(v);
    return '';
  };
  const toParagraphs = (text) => {
    const t = String(text || '').trim();
    if (!t) return [];
    return t.split(/\n{2,}/g).map((s) => s.trim()).filter(Boolean);
  };
  const extractYoutubeId = (url) => {
    const u = normalize(url);
    const m1 = u.match(/[?&]v=([^&]+)/);
    if (m1?.[1]) return m1[1];
    const m2 = u.match(/youtu\.be\/([^?&/]+)/);
    if (m2?.[1]) return m2[1];
    const m3 = u.match(/youtube\.com\/embed\/([^?&/]+)/);
    if (m3?.[1]) return m3[1];
    return null;
  };
  const extractVimeoId = (url) => {
    const u = normalize(url);
    const m1 = u.match(/vimeo\.com\/(\d+)/);
    if (m1?.[1]) return m1[1];
    const m2 = u.match(/player\.vimeo\.com\/video\/(\d+)/);
    if (m2?.[1]) return m2[1];
    return null;
  };
  const isVideoFile = (url) => /\.(mp4|webm|ogg)(\?|#|$)/i.test(normalize(url));

  const renderVideo = (url) => {
    if (!isUrl(url)) return null;
    const u = normalize(url);
    const yt = extractYoutubeId(u);
    if (yt) {
      return (
        <div className="w-full rounded-[4px] overflow-hidden border border-gray-200 bg-black">
          <iframe
            src={`https://www.youtube.com/embed/${yt}`}
            title="Vídeo"
            className="w-full aspect-video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
    }
    const vm = extractVimeoId(u);
    if (vm) {
      return (
        <div className="w-full rounded-[4px] overflow-hidden border border-gray-200 bg-black">
          <iframe
            src={`https://player.vimeo.com/video/${vm}`}
            title="Vídeo"
            className="w-full aspect-video"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
    }
    if (u.includes('vdocipher') || u.includes('player.vdocipher.com')) {
      return (
        <div className="w-full rounded-[4px] overflow-hidden border border-gray-200 bg-black">
          <iframe
            src={u}
            title="Vídeo"
            className="w-full aspect-video"
            allow="autoplay; fullscreen"
            allowFullScreen
          />
        </div>
      );
    }
    if (isVideoFile(u)) {
      const src = resolveSupabasePublicUrl(u);
      return (
        <InlineDeferredVideo src={src} />
      );
    }
    return (
      <a href={u} target="_blank" rel="noreferrer" className="text-[12px] text-[#0047BB] underline">
        Abrir vídeo
      </a>
    );
  };
  const renderImage = (url, alt) => {
    if (!isUrl(url)) return null;
    const u = normalize(url);
    const src = resolveSupabasePublicUrl(u);
    return (
      <a
        href={(u.startsWith('http://') || u.startsWith('https://')) ? u : src}
        target="_blank"
        rel="noreferrer"
        className="block w-full overflow-hidden rounded-lg border border-gray-200 bg-white"
      >
        <img
          src={src}
          alt={alt || 'Imagem'}
          className="w-full max-h-[420px] object-contain bg-white"
          loading="lazy"
          onError={(e) => {
            const img = e.currentTarget;
            if (img?.dataset?.fallbackUsed === '1') return;
            img.dataset.fallbackUsed = '1';
            if (u.startsWith('http://') || u.startsWith('https://')) img.src = u;
          }}
        />
      </a>
    );
  };

  const questionText =
    getText(qActive?.stem) ||
    getText(qActive?.body) ||
    getText(qActive?.text) ||
    getText(qActive?.statement) ||
    getText(qActive?.question) ||
    getText(qActive?.name) ||
    '';

  const questionImageUrl =
    qActive?.image_url || qActive?.imageUrl || qActive?.question_image_url || qActive?.questionImageUrl || null;
  const questionVideoUrl =
    qActive?.video_url || qActive?.videoUrl || qActive?.question_video_url || qActive?.questionVideoUrl || null;
  const resolutionText =
    getText(qActive?.resolutionText) ||
    getText(qActive?.resolution_text) ||
    getText(qActive?.resolucaoText) ||
    getText(qActive?.resolucao_text) ||
    getText(qActive?.resolution) ||
    getText(qActive?.resolucao) ||
    getText(qActive?.explanation) ||
    getText(qActive?.solution) ||
    getText(qActive?.commentary) ||
    '';
  const resolutionImageUrl =
    qActive?.resolutionImageUrl ||
    qActive?.resolution_image_url ||
    qActive?.resolution_image ||
    qActive?.resolutionImage ||
    null;
  const resolutionVideoUrl =
    qActive?.resolutionVideoUrl ||
    qActive?.resolution_video_url ||
    qActive?.resolution_video ||
    qActive?.resolutionVideo ||
    null;

  function formatTime(ms) {
    const totalSec = Math.floor((Number(ms) || 0) / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (v) => String(v).padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  return (
    <div className="min-h-screen bg-[#F8F9FB] overflow-x-hidden" onClick={handleClick}>
      <div className="mx-auto w-full max-w-[1400px] px-3 sm:px-4 py-4 sm:py-6">
        {isAlunoView ? (
          <div className="flex items-center justify-end mb-4">
            <button
              type="button"
              disabled={isFinished}
              onClick={() => setConfirmModal({ open: true, mode: 'pause' })}
              className="h-[36px] px-4 rounded-[4px] border border-[#E3E4E5] bg-white text-[12px] font-semibold text-[#22252B] hover:bg-[#F6F5FA] w-full sm:w-auto"
            >
              Pausar simulado
            </button>
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <aside className="lg:col-span-3 order-2 lg:order-none">
          <div className="rounded-lg bg-white p-4 sm:p-6 flex flex-col gap-6">
            <div className="flex flex-col items-center gap-2">
              <div className="h-16 w-16 overflow-hidden rounded-full bg-gray-100">
                <img src={isAlunoView ? studentAvatar : '/perfil rc.png'} alt="Avatar" className="h-full w-full object-cover" />
              </div>
              <div className="text-center">
                <p className="font-inter font-semibold text-[16px] leading-[24px] tracking-[0px] text-gray-800">{isAlunoView ? studentName : (preview.title || 'Simulado')}</p>
                <p className="font-inter font-normal text-[12px] leading-[20px] tracking-[0px] text-gray-500">{isAlunoView ? (preview.title || 'Simulado') : 'Preview'}</p>
              </div>
            </div>

            <div className={isFinished ? "grid grid-cols-3 gap-3 sm:flex sm:items-center sm:justify-between sm:gap-6" : "flex items-center justify-center"}>
              <StatItem
                label="Questões"
                value={totalQuestions}
                icon={<img src="/questoes.png" alt="Questões" className="w-[44px] h-[44px] object-contain" />}
                labelFirst
              />
              {isFinished ? (
                <StatItem
                  label="Certas"
                  value={correctCount}
                  color="text-green-600"
                  icon={<img src="/certas.png" alt="Certas" className="w-[44px] h-[44px] object-contain" />}
                  labelFirst
                />
              ) : null}
              {isFinished ? (
                <StatItem
                  label="Erradas"
                  value={wrongCount}
                  color="text-red-600"
                  icon={<img src="/erradas.png" alt="Erradas" className="w-[44px] h-[44px] object-contain" />}
                  labelFirst
                />
              ) : null}
            </div>

            <div className="rounded-md bg-[#F6F5FA] p-3 flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1 font-inter font-medium text-[12px] leading-[16px] tracking-[0px] text-[#22252B]">
                <img src="/pontos.png" alt="Pontos" className="w-[14px] h-[14px] rounded-[600px] p-[1px] object-contain" />
                Total de pontos
              </span>
              <span className="text-sm font-semibold text-gray-800">{preview.totalPoints}</span>
            </div>

            <div className="rounded-md bg-[#F6F5FA] p-3 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="font-inter font-medium text-[12px] leading-[16px] tracking-[0px] text-[#22252B] inline-flex items-center gap-1">
                  <img src="/Tempo.png" alt="Tempo" className="h-[14px] w-[14px] rounded-[600px] p-[1px] object-contain" />
                  {isFinished ? 'Tempo final' : 'Tempo restante'}
                </p>
              </div>
              <hr className="w-full border-t border-gray-200" />
              <p className="font-inter font-semibold text-[20px] sm:text-[24px] leading-[24px] tracking-[0px] text-center text-[#0047BB]">{formatTime(isFinished ? usedMs : remainingMs)}</p>
            </div>
          </div>
        </aside>

        <main className="lg:col-span-6 order-1 lg:order-none">
          <div className="rounded-lg bg-white p-4 sm:p-6 flex flex-col gap-6">
            {isFinished ? (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-200 pb-4">
                <div className="text-[16px] font-semibold text-[#22252B]">{resultTitle}</div>
                {isAlunoView ? (
                  <button
                    type="button"
                    className="h-[36px] px-4 rounded-[4px] border border-[#E3E4E5] bg-white text-[12px] font-semibold text-[#22252B] hover:bg-[#F6F5FA]"
                    onClick={() => {
                      setConfirmModal({ open: true, mode: 'exit' })
                    }}
                  >
                    Sair do simulado
                  </button>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-200 pb-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center h-[28px] min-w-[28px] rounded-[6px] bg-blue-600 px-2 text-[14px] leading-[16px] font-medium text-[#F6F5FA]">
                  {activeQuestion}
                </span>
                <span className="text-sm font-semibold text-gray-800">Questão</span>
              </div>
              <div className="flex items-center gap-3 flex-wrap w-full sm:w-auto justify-start sm:justify-end">
                <div className="flex items-center gap-2 rounded-md bg-[#F6F5FA] px-3 py-2">
                  <span className="text-sm font-semibold text-gray-800">{preview.totalPoints}</span>
                  <span className="text-[12px] text-[#22252B]">Pontos</span>
                  <img src="/pontos.png" alt="Pontos" className="h-[14px] w-[14px] rounded-[600px] p-[1px]" />
                </div>
                <div className="flex items-center gap-2 rounded-md bg-[#F6F5FA] px-3 py-2">
                  <span className="text-sm font-semibold text-gray-800">{preview.attempts}</span>
                  <span className="text-[12px] text-[#22252B]">Tentativas</span>
                  <img src="/Tentativas.png" alt="Tentativas" className="h-[14px] w-[14px] rounded-[600px] p-[1px]" />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {questionText ? (
                <div className="text-sm leading-[22px] text-gray-800">
                  {toParagraphs(questionText).length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {toParagraphs(questionText).map((p, idx) => (
                        <p key={idx} className="font-inter font-normal text-[14px] leading-[22px] tracking-[0px] text-[#22252B]">
                          {p}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="font-inter font-normal text-[14px] leading-[22px] tracking-[0px] text-[#22252B]">
                      {questionText}
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-sm leading-[22px] text-gray-800">
                  <p className="font-inter font-normal text-[14px] leading-[22px] tracking-[0px] text-[#22252B]">
                    Selecione questões no criador para visualizar aqui.
                  </p>
                </div>
              )}

              {questionVideoUrl ? renderVideo(questionVideoUrl) : null}
              {questionImageUrl ? renderImage(questionImageUrl, 'Imagem da questão') : null}
            </div>

            <div className="flex flex-col gap-3">
              {(() => {
                const choices = choicesActive;
                if (choices.length === 0) {
                  return <div className="text-virtualBlack text-sm">Nenhuma alternativa disponível para esta questão.</div>;
                }
                return (
                  <>
                    {choices.map((c, i) => {
                      const isSelected = selectedForActive === i;
                      const isCorrect = !!c?.is_correct;
                      const borderColor = isSelected ? (canRevealAnswer ? (isCorrect ? 'border-green-500' : 'border-red-500') : 'border-[#0047BB]') : 'border-transparent';
                      const bgColor = isSelected ? (canRevealAnswer ? (isCorrect ? 'bg-green-50' : 'bg-red-50') : 'bg-white') : 'bg-[#F6F5FA]';
                      const optionText =
                        getText(c?.label) ||
                        getText(c?.text) ||
                        getText(c?.name) ||
                        getText(c?.value) ||
                        '';
                      const optionImageUrl = c?.image_url || c?.imageUrl || c?.image || c?.img_url || c?.imgUrl || null;
                      const optionVideoUrl =
                        c?.video_url ||
                        c?.videoUrl ||
                        c?.video ||
                        c?.vimeo_url ||
                        c?.vimeoUrl ||
                        c?.youtube_url ||
                        c?.youtubeUrl ||
                        null;
                      return (
                        <div key={i} className="flex items-start gap-3">
                          <button
                            type="button"
                            data-action="select-option"
                            data-value={i}
                            className={`inline-flex items-center justify-center h-9 w-9 sm:h-10 sm:w-10 rounded-md border ${borderColor} ${bgColor} text-[#22252B] text-[13px] sm:text-[14px] leading-[20px] font-semibold shrink-0`}
                          >
                            {String.fromCharCode(65 + i)}
                          </button>
                          <div className="flex-1 flex flex-col gap-2">
                            <button
                              type="button"
                              data-action="select-option"
                              data-value={i}
                              className={`w-full rounded-md ${bgColor} px-3 py-2.5 sm:py-3 text-[#22252B] text-[13px] sm:text-[14px] leading-[20px] font-normal text-left border ${borderColor}`}
                            >
                              <span className="whitespace-pre-wrap break-words">{optionText}</span>
                            </button>
                            {optionImageUrl ? renderImage(optionImageUrl, `Imagem da alternativa ${String.fromCharCode(65 + i)}`) : null}
                            {optionVideoUrl ? renderVideo(optionVideoUrl) : null}
                          </div>
                        </div>
                      );
                    })}
                    {canRevealAnswer && typeof selectedForActive === 'number' && questionStatuses[activeQuestion - 1] === 'wrong' && correctIdxActive >= 0 && (
                      <div className="text-sm text-red-700">
                        Resposta correta: {String.fromCharCode(65 + correctIdxActive)} — {getText(choicesActive[correctIdxActive]?.label) || getText(choicesActive[correctIdxActive]?.text) || getText(choicesActive[correctIdxActive]?.name) || getText(choicesActive[correctIdxActive]?.value) || ''}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {canRevealAnswer && (resolutionText || resolutionImageUrl || resolutionVideoUrl) ? (
              <div className="rounded-lg bg-[#F6F5FA] p-3 sm:p-4 flex flex-col gap-3">
                <div className="font-inter font-semibold text-[14px] leading-[20px] tracking-[0px] text-[#22252B]">
                  Resolução
                </div>
                {resolutionText ? (
                  <div className="text-[13px] leading-[20px] text-[#22252B] whitespace-pre-wrap break-words">
                    {resolutionText}
                  </div>
                ) : null}
                {resolutionVideoUrl ? renderVideo(resolutionVideoUrl) : null}
                {resolutionImageUrl ? renderImage(resolutionImageUrl, 'Imagem da resolução') : null}
              </div>
            ) : null}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <span className="font-inter font-normal text-[12px] leading-[20px] tracking-[0px] text-[#737780]">
                Questão {activeQuestion} / {totalQuestions || 1}
              </span>
              {!isFinished ? (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    data-action="skip"
                    className="inline-flex items-center justify-center h-[36px] flex-1 sm:flex-none rounded-md border border-[#0047BB] bg-[#F6F5FA] px-5 font-inter text-center text-[#0047BB] text-[14px] leading-[20px] font-semibold"
                  >
                    Pular
                  </button>
                  {activeQuestion >= (totalQuestions || 1) ? (
                    <button
                      type="button"
                      data-action="finish"
                      className="inline-flex items-center justify-center h-[36px] flex-1 sm:flex-none rounded-md bg-[#0047BB] hover:bg-[#003a99] px-5 font-inter text-center text-white text-[14px] leading-[20px] font-semibold"
                    >
                      Finalizar simulado
                    </button>
                  ) : (
                    <button
                      type="button"
                      data-action="next"
                      className="inline-flex items-center justify-center h-[36px] flex-1 sm:flex-none rounded-md bg-[#0047BB] hover:bg-[#003a99] px-5 font-inter text-center text-white text-[14px] leading-[20px] font-semibold"
                    >
                      Próxima questão
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </main>

        <aside className="lg:col-span-3 order-3 lg:order-none">
          <div className="flex flex-col gap-6">
            <div className="rounded-lg bg-white p-4 text-center">
              <div className="mx-auto mt-2 relative w-[160px] h-[88px] sm:w-[180px] sm:h-[96px]">
                <AproveitamentoCircle percent={aproveitamentoPercent} />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="font-inter font-bold text-[32px] leading-[34px] tracking-[0px] text-center text-[#22252B]">{aproveitamentoPercent}%</span>
                </div>
              </div>
              <p className="font-inter font-medium text-[12px] leading-[16px] tracking-[0px] text-center text-[#22252B] mt-[10px]">Aproveitamento</p>
              <img src="/logo connekt.png" alt="Connekt" className="mx-auto mt-3 w-[99px] h-[30px]" />
            </div>

            <div className="rounded-lg bg-white p-3">
              <div className="flex flex-col gap-2">
                {(Array.isArray(preview?.questions) && preview.questions.length > 0
                  ? preview.questions
                  : Array.from({ length: Math.max(totalQuestions || 1, 1) }))
                  .map((_, i) => (
                    <QuestionListItem
                      key={i}
                      index={i + 1}
                      status={
                        canRevealAnswer
                          ? (questionStatuses[i] || 'neutral')
                          : (typeof selectedIndices?.[i] === 'number' ? 'answered' : 'neutral')
                      }
                    />
                  ))}
              </div>
            </div>
          </div>
        </aside>
        </div>
      </div>
      {confirmModal.open ? (
        <div className="fixed inset-0 z-[200]">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmModal({ open: false, mode: '' })} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-[420px] rounded-[10px] bg-white border border-[#E3E4E5] shadow-xl p-5">
              <div className="text-[14px] font-semibold text-[#22252B]">
                {confirmModal.mode === 'pause' ? 'Pausar simulado?' : 'Sair do simulado?'}
              </div>
              <div className="mt-2 text-[12px] text-[#737780] leading-relaxed">
                {confirmModal.mode === 'pause'
                  ? 'Você realmente quer pausar e voltar para a lista de simulados?'
                  : 'Você realmente quer sair e voltar para a lista de simulados?'}
              </div>
              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="h-9 px-4 rounded-[6px] border border-[#E3E4E5] bg-white text-[12px] font-semibold text-[#22252B] hover:bg-[#F6F5FA]"
                  onClick={() => setConfirmModal({ open: false, mode: '' })}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="h-9 px-4 rounded-[6px] bg-[#0047BB] text-white text-[12px] font-semibold hover:bg-[#003da0]"
                  onClick={() => {
                    const mode = confirmModal.mode
                    setConfirmModal({ open: false, mode: '' })
                    if (mode === 'pause') doPause()
                    if (mode === 'exit') doExit()
                  }}
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default RepostaCorretaSimuladoPage;
