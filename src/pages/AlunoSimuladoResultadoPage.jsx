import React, { useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '@/contexts/SupabaseAuthContext.jsx'

function navigateTo(path) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function formatTime(ms) {
  const totalSec = Math.floor((Number(ms) || 0) / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const pad = (v) => String(v).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

function AproveitamentoCircle({ percent = 0 }) {
  const p = Math.max(0, Math.min(100, Number(percent) || 0))
  const radius = 44
  const circumference = 2 * Math.PI * radius
  const dash = (p / 100) * circumference
  const angle = (p / 100) * 360 - 90
  const cx = 50 + radius * Math.cos((angle * Math.PI) / 180)
  const cy = 50 + radius * Math.sin((angle * Math.PI) / 180)
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
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
      <circle cx={cx} cy={cy} r="4" fill="#0047BB" />
    </svg>
  )
}

function resolveSupabasePublicUrl(rawValue) {
  const u = typeof rawValue === 'string' ? rawValue.trim() : ''
  if (!u) return ''
  if (u.startsWith('data:') || u.startsWith('blob:')) return u
  try {
    const parsed = new URL(u)
    const m = parsed.pathname.match(/\/storage\/v1\/object\/sign\/([^/]+)\/(.+)$/)
    if (m?.[1] && m?.[2]) {
      parsed.pathname = `/storage/v1/object/public/${m[1]}/${m[2]}`
      parsed.search = ''
      parsed.hash = ''
      return parsed.toString()
    }
    return u
  } catch (_) {
    const base = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL)
      ? String(import.meta.env.VITE_SUPABASE_URL)
      : ''
    const bucket = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_QUESTION_IMAGES_BUCKET)
      ? String(import.meta.env.VITE_SUPABASE_QUESTION_IMAGES_BUCKET)
      : 'question-images'
    if (!base) return u
    let p = u.replace(/^\/+/, '')
    if (p.startsWith(`${bucket}/`)) p = p.slice(bucket.length + 1)
    if (p.startsWith('question-images/')) p = p.slice('question-images/'.length)
    return `${base.replace(/\/+$/, '')}/storage/v1/object/public/${bucket}/${p}`
  }
}

function getText(v) {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  return ''
}

function QuestionResultCard({ index, q, selectedIndex, status, points }) {
  const choices = Array.isArray(q?.choices) ? q.choices : []
  const correctIdx = choices.findIndex((c) => !!c?.is_correct)
  const selected = typeof selectedIndex === 'number' ? selectedIndex : null
  const selectedChoice = selected != null ? choices[selected] : null
  const selectedText =
    getText(selectedChoice?.label) ||
    getText(selectedChoice?.text) ||
    getText(selectedChoice?.name) ||
    getText(selectedChoice?.value) ||
    ''
  const questionText =
    getText(q?.stem) ||
    getText(q?.body) ||
    getText(q?.text) ||
    getText(q?.statement) ||
    getText(q?.question) ||
    getText(q?.name) ||
    ''
  const resolutionText =
    getText(q?.resolutionText) ||
    getText(q?.resolution_text) ||
    getText(q?.resolucaoText) ||
    getText(q?.resolucao_text) ||
    getText(q?.resolution) ||
    getText(q?.resolucao) ||
    getText(q?.explanation) ||
    getText(q?.solution) ||
    getText(q?.commentary) ||
    ''
  const questionImageUrl = q?.image_url || q?.imageUrl || q?.question_image_url || q?.questionImageUrl || null
  const border = status === 'correct' ? 'border-green-200' : status === 'wrong' ? 'border-red-200' : 'border-[#E3E4E5]'
  const pillBg = status === 'correct' ? 'bg-green-50 text-green-700' : status === 'wrong' ? 'bg-red-50 text-red-700' : 'bg-[#F6F5FA] text-[#22252B]'
  const optionBg = status === 'correct' ? 'bg-green-50 border-green-300' : status === 'wrong' ? 'bg-red-50 border-red-300' : 'bg-white border-[#E3E4E5]'
  const optionBadgeBg = status === 'correct' ? 'bg-green-600' : status === 'wrong' ? 'bg-red-600' : 'bg-[#737780]'
  const optionLetter = selected != null ? String.fromCharCode(65 + selected) : '-'
  const correctLetter = correctIdx >= 0 ? String.fromCharCode(65 + correctIdx) : ''
  const imgSrc = questionImageUrl ? resolveSupabasePublicUrl(String(questionImageUrl)) : ''
  return (
    <div className={`rounded-[10px] bg-white border ${border} overflow-hidden`}>
      <div className="px-5 py-4 border-b border-[#E3E4E5] flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`inline-flex items-center h-[18px] px-3 text-[10px] rounded-[54px] leading-none font-medium ${pillBg}`}>
            Questão de múltipla escolha
          </span>
          <span className="text-[12px] text-[#737780] truncate">Questão {index}</span>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-[#22252B] whitespace-nowrap">
          <span className="font-semibold">{Number(points || 0)}</span>
          <span>Pontos</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#FFD400]" />
        </div>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-5 items-start">
          <div className="rounded-[8px] overflow-hidden border border-[#E3E4E5] bg-white">
            <img src={imgSrc || '/simulado-cover.svg'} alt="" className="w-full h-[140px] object-cover" />
          </div>
          <div className="min-w-0">
            <div className="text-[12px] font-semibold text-[#0047BB]">Questão</div>
            <div className="mt-2 text-[12px] text-[#22252B] leading-relaxed">{questionText || '—'}</div>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-3">
          <div className={`w-9 h-9 rounded-[6px] flex items-center justify-center text-white text-[12px] font-bold ${optionBadgeBg}`}>
            {optionLetter}
          </div>
          <div className={`flex-1 rounded-[6px] border px-4 py-3 text-[12px] text-[#22252B] ${optionBg}`}>
            {selectedText || 'Nenhuma alternativa selecionada'}
          </div>
        </div>

        <div className="mt-3 rounded-[8px] bg-[#EFF6FF] border border-[#BFDBFE] p-4">
          <div className="text-[12px] font-semibold text-[#0047BB]">Resolução</div>
          <div className="mt-2 text-[12px] text-[#1E1B39] leading-relaxed">
            {resolutionText
              ? resolutionText
              : (status === 'wrong' && correctLetter
                ? `Resposta correta: ${correctLetter}.`
                : '—')}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AlunoSimuladoResultadoPage() {
  const { user } = useAuth()
  const params = useMemo(() => {
    try {
      const sp = new URLSearchParams(window.location.search || '')
      return { simId: sp.get('simId') || 'preview', demo: sp.get('demo') === '1' }
    } catch (_) {
      return { simId: 'preview', demo: false }
    }
  }, [])

  const [preview, setPreview] = useState({ title: '', totalPoints: 0, durationMinutes: 0, questions: [] })
  const [finish, setFinish] = useState({ finishedAt: null, finalRemainingMs: null, aproveitamentoPercent: 0, selectedIndices: [], questionStatuses: [] })

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`connekt_simulationPreview:${params.simId}`) || localStorage.getItem('simulationPreview')
      if (raw) {
        const parsed = JSON.parse(raw)
        setPreview({
          title: parsed?.title || '',
          totalPoints: Number(parsed?.totalPoints) || 0,
          durationMinutes: Number(parsed?.durationMinutes) || 0,
          questions: Array.isArray(parsed?.questions) ? parsed.questions : [],
        })
      }
    } catch (_) {}
    try {
      const rawFinish = localStorage.getItem(`connekt_simulado_finish_${params.simId}`)
      if (rawFinish) {
        const parsed = JSON.parse(rawFinish)
        setFinish({
          finishedAt: parsed?.finishedAt ? String(parsed.finishedAt) : null,
          finalRemainingMs: Number.isFinite(Number(parsed?.finalRemainingMs)) ? Number(parsed.finalRemainingMs) : null,
          aproveitamentoPercent: Math.max(0, Math.min(100, Number(parsed?.aproveitamentoPercent) || 0)),
          selectedIndices: Array.isArray(parsed?.selectedIndices) ? parsed.selectedIndices : [],
          questionStatuses: Array.isArray(parsed?.questionStatuses) ? parsed.questionStatuses : [],
        })
      }
    } catch (_) {}
  }, [params.simId])

  const title = preview?.title || 'Simulado'
  const questions = Array.isArray(preview?.questions) ? preview.questions : []
  const totalQuestions = questions.length
  const correctCount = Array.isArray(finish?.questionStatuses) ? finish.questionStatuses.filter((s) => s === 'correct').length : 0
  const wrongCount = Array.isArray(finish?.questionStatuses) ? finish.questionStatuses.filter((s) => s === 'wrong').length : 0
  const percent = Number(finish?.aproveitamentoPercent || 0) || 0
  const totalPoints = Number(preview?.totalPoints || 0) || 0
  const pointsEarned = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * totalPoints) : 0
  const durationMs = Math.max(0, (Number(preview?.durationMinutes) || 0) * 60_000)
  const usedMs = (durationMs && finish?.finalRemainingMs != null) ? Math.max(0, durationMs - Math.max(0, Number(finish.finalRemainingMs))) : 0
  const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'Aluno'
  const userEmail = user?.email || ''
  const userAvatar = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || ''
  const perQuestionPoints = totalQuestions > 0 ? Math.round(totalPoints / totalQuestions) : 0

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <Helmet>
        <title>{`Connekt - Resultado - ${title}`}</title>
      </Helmet>

      <div className="w-full bg-white border-b border-[#E3E4E5]">
        <div className="max-w-[1180px] mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="text-[12px] text-[#22252B] font-semibold truncate">
            Simulado: {title}
          </div>
          <button
            type="button"
            className="h-[36px] px-4 rounded-[4px] border border-[#E3E4E5] bg-white text-[12px] font-semibold text-[#22252B] hover:bg-[#F6F5FA]"
            onClick={() => {
              const url = new URL('/aluno/simulados', window.location.origin)
              if (params.demo) url.searchParams.set('demo', '1')
              navigateTo(`${url.pathname}${url.search}`)
            }}
          >
            Sair do simulado
          </button>
        </div>
      </div>

      <div className="max-w-[1180px] mx-auto px-6 py-6">
        <div className="rounded-[12px] bg-white border border-[#E3E4E5] p-6">
          <div className="text-center text-[16px] font-semibold text-[#22252B]">Resultado final</div>

          <div className="mt-5 grid grid-cols-1 lg:grid-cols-[260px_1fr_220px] gap-6 items-center">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-[#F6F5FA] overflow-hidden border border-[#E3E4E5]">
                <img src={userAvatar || '/perfil rc.png'} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0">
                <div className="text-[12px] font-semibold text-[#22252B] truncate">{userName}</div>
                <div className="text-[11px] text-[#737780] truncate">{userEmail}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[170px_1fr] gap-4 items-center">
              <div className="rounded-[8px] bg-[#F6F5FA] p-4 text-center">
                <div className="text-[11px] text-[#737780]">Tempo final</div>
                <div className="mt-1 text-[18px] font-bold text-[#0047BB]">{usedMs ? formatTime(usedMs) : '—'}</div>
              </div>
              <div className="rounded-[8px] bg-[#F6F5FA] p-4">
                <div className="flex items-center justify-between text-[11px] text-[#737780]">
                  <span>Total de pontos</span>
                  <span className="font-semibold text-[#22252B]">{totalPoints}</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3">
                  <div className="bg-white border border-[#E3E4E5] rounded-[6px] p-3 text-center">
                    <div className="text-[10px] text-[#737780]">Questões</div>
                    <div className="text-[14px] font-bold text-[#22252B]">{totalQuestions}</div>
                  </div>
                  <div className="bg-white border border-[#E3E4E5] rounded-[6px] p-3 text-center">
                    <div className="text-[10px] text-[#737780]">Certas</div>
                    <div className="text-[14px] font-bold text-[#16A34A]">{correctCount}</div>
                  </div>
                  <div className="bg-white border border-[#E3E4E5] rounded-[6px] p-3 text-center">
                    <div className="text-[10px] text-[#737780]">Erradas</div>
                    <div className="text-[14px] font-bold text-[#DC2626]">{wrongCount}</div>
                  </div>
                </div>
                <div className="mt-3 text-[11px] text-[#737780]">
                  Pontos obtidos: <span className="font-semibold text-[#22252B]">{pointsEarned}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center">
              <div className="relative w-[140px] h-[140px]">
                <AproveitamentoCircle percent={percent} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-[26px] font-bold text-[#22252B]">{percent}%</div>
                  <div className="text-[10px] text-[#737780]">Aproveitamento final</div>
                </div>
              </div>
              <img src="/logo connekt.png" alt="Connekt" className="mt-3 w-[86px] h-auto" />
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-5">
          {questions.map((q, idx) => (
            <QuestionResultCard
              key={q?.id || `q-${idx}`}
              index={idx + 1}
              q={q}
              selectedIndex={finish?.selectedIndices?.[idx]}
              status={finish?.questionStatuses?.[idx] || 'neutral'}
              points={q?.points || q?.pontos || q?.score || perQuestionPoints}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
