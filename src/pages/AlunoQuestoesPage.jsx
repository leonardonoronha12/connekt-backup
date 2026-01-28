import React, { useEffect, useMemo, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { toast } from '@/components/ui/use-toast'
import questionBankService from '@/services/questionBankService'

function navigateTo(path) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function parseChoices(question) {
  const meta = (question?.metadata && typeof question.metadata === 'object') ? question.metadata : {}
  const raw = Array.isArray(meta.choices)
    ? meta.choices
    : (Array.isArray(meta.alternatives) ? meta.alternatives : (Array.isArray(meta.options) ? meta.options : []))
  return raw
    .map((c, idx) => {
      if (typeof c === 'string') return { id: `opt-${idx}`, label: c, is_correct: false }
      if (c && typeof c === 'object') {
        const label = String(c.label || c.text || c.title || '').trim()
        return { id: String(c.id || `opt-${idx}`), label, is_correct: !!c.is_correct }
      }
      return { id: `opt-${idx}`, label: '', is_correct: false }
    })
    .filter((c) => String(c.label || '').trim().length > 0)
}

function isCorrectChoice(question, choiceIndex) {
  const meta = (question?.metadata && typeof question.metadata === 'object') ? question.metadata : {}
  const correctIdx = typeof meta.correctChoiceIndex === 'number' ? meta.correctChoiceIndex : null
  if (typeof correctIdx === 'number') return choiceIndex === correctIdx
  const choices = parseChoices(question)
  const c = choices[choiceIndex]
  if (!c) return false
  return !!c.is_correct
}

function shuffle(arr) {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const t = out[i]
    out[i] = out[j]
    out[j] = t
  }
  return out
}

export default function AlunoQuestoesPage() {
  const params = useMemo(() => {
    try {
      const p = new URLSearchParams(window.location.search || '')
      const bankIds = String(p.get('bankIds') || '').trim()
      const list = bankIds ? bankIds.split(',').map((s) => String(s || '').trim()).filter(Boolean) : []
      return {
        bankIds: list,
        category: String(p.get('category') || '').trim(),
        subcategory: String(p.get('subcategory') || '').trim(),
        tag: String(p.get('tag') || '').trim(),
      }
    } catch (_) {
      return { bankIds: [], category: '', subcategory: '', tag: '' }
    }
  }, [])

  const [loading, setLoading] = useState(false)
  const [questions, setQuestions] = useState([])
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState(0)

  useEffect(() => {
    let active = true
    const run = async () => {
      if (!params.bankIds || params.bankIds.length === 0) {
        setQuestions([])
        return
      }
      setLoading(true)
      try {
        const batches = await Promise.all(params.bankIds.map((id) => questionBankService.getQuestionsByBankId(id)))
        const merged = []
        for (const b of batches) {
          const list = Array.isArray(b?.data) ? b.data : []
          for (const q of list) merged.push(q)
        }
        const usable = merged.filter((q) => parseChoices(q).length > 0)
        const shuffled = shuffle(usable)
        if (!active) return
        setQuestions(shuffled)
        setIndex(0)
        setSelected(null)
        setSubmitted(false)
        setScore(0)
      } catch (e) {
        if (!active) return
        setQuestions([])
        toast({ description: String(e?.message || 'Erro ao carregar questões'), variant: 'destructive' })
      } finally {
        if (active) setLoading(false)
      }
    }
    run()
    return () => { active = false }
  }, [params.bankIds])

  const current = questions[index] || null
  const choices = useMemo(() => parseChoices(current), [current])
  const total = questions.length
  const progressPct = total > 0 ? Math.round(((index + 1) / total) * 100) : 0

  const headerSubtitle = useMemo(() => {
    const parts = [params.category, params.subcategory, params.tag].filter(Boolean)
    return parts.length ? parts.join(' • ') : 'Banco de Questões'
  }, [params.category, params.subcategory, params.tag])

  const submit = () => {
    if (selected === null) return
    if (submitted) return
    const ok = isCorrectChoice(current, selected)
    setSubmitted(true)
    if (ok) setScore((s) => s + 1)
  }

  const next = () => {
    if (index >= total - 1) {
      toast({ description: `Você finalizou: ${score}/${total}`, })
      navigateTo('/aluno/banco-de-questoes')
      return
    }
    setIndex((i) => i + 1)
    setSelected(null)
    setSubmitted(false)
  }

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <div className="border-b border-[#E3E4E5] bg-white">
        <div className="max-w-[1100px] mx-auto px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              className="h-9 w-9 rounded-full border border-[#E3E4E5] bg-white flex items-center justify-center"
              onClick={() => navigateTo('/aluno/banco-de-questoes')}
              aria-label="Voltar"
            >
              <ChevronLeft className="w-5 h-5 text-[#22252B]" />
            </button>
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-[#22252B] truncate">Questões</div>
              <div className="text-[12px] text-[#737780] truncate">{headerSubtitle}</div>
            </div>
          </div>
          <div className="text-[12px] text-[#737780] whitespace-nowrap">
            {total > 0 ? `${index + 1}/${total}` : '0/0'}
          </div>
        </div>
        <div className="max-w-[1100px] mx-auto px-5 pb-4">
          <div className="h-2 w-full rounded-full bg-[#EEF2FF] overflow-hidden">
            <div className="h-full bg-[#0047BB]" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      </div>

      <div className="max-w-[1100px] mx-auto px-5 py-8">
        {loading ? (
          <div className="text-[12px] text-[#737780]">Carregando questões…</div>
        ) : !current ? (
          <div className="bg-white border border-[#E3E4E5] rounded-[12px] p-6">
            <div className="text-[14px] font-semibold text-[#22252B]">Nenhuma questão disponível</div>
            <div className="mt-1 text-[12px] text-[#737780]">Crie questões nesse banco para aparecerem aqui.</div>
            <button
              type="button"
              className="mt-4 h-9 px-4 rounded-[8px] bg-[#0047BB] text-white text-[12px] font-semibold"
              onClick={() => navigateTo('/aluno/banco-de-questoes')}
            >
              Voltar
            </button>
          </div>
        ) : (
          <div className="bg-white border border-[#E3E4E5] rounded-[12px] p-6">
            <div className="text-[14px] font-semibold text-[#22252B]">{String(current?.title || 'Questão')}</div>
            {current?.body ? (
              <div className="mt-2 text-[12px] text-[#3A3D45] whitespace-pre-wrap">{String(current.body)}</div>
            ) : null}

            <div className="mt-5 space-y-2">
              {choices.map((c, i) => {
                const isSelected = selected === i
                const isCorrect = submitted ? isCorrectChoice(current, i) : false
                const showWrong = submitted && isSelected && !isCorrect
                const cls = (() => {
                  if (!submitted) {
                    return isSelected
                      ? 'border-[#0047BB] bg-[#EEF2FF]'
                      : 'border-[#E3E4E5] bg-white hover:bg-[#F9FAFB]'
                  }
                  if (isCorrect) return 'border-[#06C270] bg-[#E9FFEF]'
                  if (showWrong) return 'border-[#EF4444] bg-[#FEF2F2]'
                  return 'border-[#E3E4E5] bg-white opacity-80'
                })()
                return (
                  <button
                    key={c.id || i}
                    type="button"
                    className={`w-full text-left px-4 py-3 rounded-[10px] border ${cls}`}
                    disabled={submitted}
                    onClick={() => setSelected(i)}
                  >
                    <div className="text-[12px] text-[#22252B]">{c.label}</div>
                  </button>
                )
              })}
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <div className="text-[12px] text-[#737780]">
                Pontuação: {score}
              </div>
              <div className="flex items-center gap-2">
                {!submitted ? (
                  <button
                    type="button"
                    className="h-9 px-4 rounded-[8px] bg-[#0047BB] text-white text-[12px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={selected === null}
                    onClick={submit}
                  >
                    Confirmar
                  </button>
                ) : (
                  <button
                    type="button"
                    className="h-9 px-4 rounded-[8px] bg-[#0047BB] text-white text-[12px] font-semibold"
                    onClick={next}
                  >
                    Próxima
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

