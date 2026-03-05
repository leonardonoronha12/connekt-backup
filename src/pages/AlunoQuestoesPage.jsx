import React, { useEffect, useMemo, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { toast } from '@/components/ui/use-toast'
import AlunoLayout from '@/components/AlunoLayout'
import questionBankService from '@/services/questionBankService'

function navigateTo(path) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function getText(v) {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  return ''
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

function parseChoices(question) {
  const meta = (question?.metadata && typeof question.metadata === 'object') ? question.metadata : {}
  const raw = Array.isArray(question?.choices)
    ? question.choices
    : (Array.isArray(meta.choices)
      ? meta.choices
      : (Array.isArray(meta.alternatives) ? meta.alternatives : (Array.isArray(meta.options) ? meta.options : [])))
  const normalize = (list) => {
    const arr = Array.isArray(list) ? list : []
    return arr
      .map((v) => getText(v).trim())
      .filter(Boolean)
      .map((u) => resolveSupabasePublicUrl(u))
  }
  const safeHtml = (html) => {
    const s = String(html || '')
    if (!s.trim()) return ''
    let out = s.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    out = out.replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
    out = out.replace(/\s(href|src)\s*=\s*(['"])\s*javascript:[^'"]*\2/gi, ' $1="#"')
    return out
  }
  const attachmentUrls = (input, kind) => {
    const arr = Array.isArray(input) ? input : []
    return arr
      .filter((a) => a && typeof a === 'object')
      .filter((a) => {
        const t = String(a.type || a.kind || a.mediaType || a.mime || '').toLowerCase()
        if (!t) return false
        if (kind === 'image') return t.includes('image')
        if (kind === 'video') return t.includes('video')
        return t.includes('pdf') || t.includes('doc') || t.includes('document')
      })
      .map((a) => a.url || a.href || a.path || a.src || '')
  }
  return raw
    .map((c, idx) => {
      if (typeof c === 'string') {
        const choiceHtml = safeHtml((meta?.choicesTextHtml && typeof meta.choicesTextHtml === 'object') ? meta.choicesTextHtml?.[idx] : '')
        const metaChoicesMedia = (meta?.choicesMedia && typeof meta.choicesMedia === 'object') ? meta.choicesMedia : {}
        const metaChoiceMedia = (metaChoicesMedia?.[idx] && typeof metaChoicesMedia[idx] === 'object') ? metaChoicesMedia[idx] : null
        const images = normalize([metaChoiceMedia?.imageUrl])
        const videos = normalize([metaChoiceMedia?.videoUrl])
        return { id: `opt-${idx}`, label: c, html: choiceHtml, is_correct: false, images, videos, docs: [] }
      }
      if (c && typeof c === 'object') {
        const label = String(c.label || c.text || c.title || '').trim()
        const choiceHtml = safeHtml((meta?.choicesTextHtml && typeof meta.choicesTextHtml === 'object') ? meta.choicesTextHtml?.[idx] : '')
        const metaChoicesMedia = (meta?.choicesMedia && typeof meta.choicesMedia === 'object') ? meta.choicesMedia : {}
        const metaChoiceMedia = (metaChoicesMedia?.[idx] && typeof metaChoicesMedia[idx] === 'object') ? metaChoicesMedia[idx] : null
        const images = normalize([
          c.image_url,
          c.imageUrl,
          c.image,
          c.image_path,
          c.imagePath,
          metaChoiceMedia?.imageUrl,
          ...(Array.isArray(c.images) ? c.images : []),
          ...(Array.isArray(c.image_urls) ? c.image_urls : []),
          ...(Array.isArray(c.imageUrls) ? c.imageUrls : []),
          ...(Array.isArray(c.image_paths) ? c.image_paths : []),
          ...(Array.isArray(c.imagePaths) ? c.imagePaths : []),
          ...(Array.isArray(c.attachments) ? attachmentUrls(c.attachments, 'image') : []),
          ...(c.media && typeof c.media === 'object' ? [
            c.media.image_url,
            c.media.imageUrl,
            ...(Array.isArray(c.media.images) ? c.media.images : []),
          ] : []),
        ])
        const videos = normalize([
          c.video_url,
          c.videoUrl,
          c.video,
          c.video_path,
          c.videoPath,
          metaChoiceMedia?.videoUrl,
          ...(Array.isArray(c.videos) ? c.videos : []),
          ...(Array.isArray(c.video_urls) ? c.video_urls : []),
          ...(Array.isArray(c.videoUrls) ? c.videoUrls : []),
          ...(Array.isArray(c.video_paths) ? c.video_paths : []),
          ...(Array.isArray(c.videoPaths) ? c.videoPaths : []),
          ...(Array.isArray(c.attachments) ? attachmentUrls(c.attachments, 'video') : []),
          ...(c.media && typeof c.media === 'object' ? [
            c.media.video_url,
            c.media.videoUrl,
            ...(Array.isArray(c.media.videos) ? c.media.videos : []),
          ] : []),
        ])
        const docs = normalize([
          c.doc_url,
          c.docUrl,
          c.document_url,
          c.documentUrl,
          ...(Array.isArray(c.docs) ? c.docs : []),
          ...(Array.isArray(c.doc_urls) ? c.doc_urls : []),
          ...(Array.isArray(c.docUrls) ? c.docUrls : []),
          ...(Array.isArray(c.attachments) ? attachmentUrls(c.attachments, 'doc') : []),
          ...(c.media && typeof c.media === 'object' ? [
            ...(Array.isArray(c.media.docs) ? c.media.docs : []),
            ...(Array.isArray(c.media.docUrls) ? c.media.docUrls : []),
          ] : []),
        ])
        return { id: String(c.id || `opt-${idx}`), label, html: choiceHtml, is_correct: !!c.is_correct, images, videos, docs }
      }
      const label = getText(c).trim()
      const choiceHtml = safeHtml((meta?.choicesTextHtml && typeof meta.choicesTextHtml === 'object') ? meta.choicesTextHtml?.[idx] : '')
      const metaChoicesMedia = (meta?.choicesMedia && typeof meta.choicesMedia === 'object') ? meta.choicesMedia : {}
      const metaChoiceMedia = (metaChoicesMedia?.[idx] && typeof metaChoicesMedia[idx] === 'object') ? metaChoicesMedia[idx] : null
      const images = normalize([metaChoiceMedia?.imageUrl])
      const videos = normalize([metaChoiceMedia?.videoUrl])
      return { id: `opt-${idx}`, label, html: choiceHtml, is_correct: false, images, videos, docs: [] }
    })
    .filter((c) => String(c.label || '').trim().length > 0 || String(c.html || '').trim().length > 0)
}

function isCorrectChoice(question, choiceIndex) {
  const meta = (question?.metadata && typeof question.metadata === 'object') ? question.metadata : {}
  const correctIdx =
    (typeof question?.correctChoiceIndex === 'number' ? question.correctChoiceIndex : null) ??
    (typeof meta.correctChoiceIndex === 'number' ? meta.correctChoiceIndex : null)
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

function normalizeUrlList(list) {
  const arr = Array.isArray(list) ? list : []
  return arr
    .map((v) => getText(v).trim())
    .filter(Boolean)
    .map((u) => resolveSupabasePublicUrl(u))
}

function extractQuestionAssets(question) {
  const meta = (question?.metadata && typeof question.metadata === 'object') ? question.metadata : {}
  const questionText = getText(question?.body) || getText(meta?.stem) || getText(meta?.question) || ''
  const title = getText(question?.title) || getText(meta?.title) || ''

  const questionImages = [
    meta?.image_url,
    meta?.imageUrl,
    meta?.question_image_url,
    meta?.questionImageUrl,
    ...(Array.isArray(meta?.images) ? meta.images : []),
    ...(Array.isArray(meta?.image_urls) ? meta.image_urls : []),
    ...(Array.isArray(meta?.imageUrls) ? meta.imageUrls : []),
    ...(Array.isArray(meta?.questionImages) ? meta.questionImages : []),
  ]

  const resolutionText =
    getText(meta?.resolutionText) ||
    getText(meta?.resolution_text) ||
    getText(meta?.resolucaoText) ||
    getText(meta?.resolucao_text) ||
    getText(meta?.resolution) ||
    getText(meta?.resolucao) ||
    getText(meta?.explanation) ||
    getText(meta?.solution) ||
    getText(meta?.commentary) ||
    ''

  const resolutionImages = [
    ...(Array.isArray(meta?.resolutionImages) ? meta.resolutionImages : []),
    ...(Array.isArray(meta?.resolution_images) ? meta.resolution_images : []),
    ...(Array.isArray(meta?.explanationImages) ? meta.explanationImages : []),
    ...(Array.isArray(meta?.explanation_images) ? meta.explanation_images : []),
  ]

  const resolutionVideos = [
    meta?.resolutionVideoUrl,
    meta?.resolution_video_url,
    meta?.explanationVideoUrl,
    meta?.explanation_video_url,
    meta?.video_url,
    meta?.videoUrl,
    ...(Array.isArray(meta?.videos) ? meta.videos : []),
    ...(Array.isArray(meta?.video_urls) ? meta.video_urls : []),
    ...(Array.isArray(meta?.videoUrls) ? meta.videoUrls : []),
  ]

  const resolutionDocs = [
    ...(Array.isArray(meta?.docs) ? meta.docs : []),
    ...(Array.isArray(meta?.doc_urls) ? meta.doc_urls : []),
    ...(Array.isArray(meta?.docUrls) ? meta.docUrls : []),
  ]

  return {
    title,
    questionText,
    questionImages: normalizeUrlList(questionImages),
    resolutionText: resolutionText.trim(),
    resolutionImages: normalizeUrlList(resolutionImages),
    resolutionVideos: normalizeUrlList(resolutionVideos),
    resolutionDocs: normalizeUrlList(resolutionDocs),
  }
}

function isVideoFile(url) {
  const u = String(url || '').toLowerCase()
  return u.endsWith('.mp4') || u.endsWith('.webm') || u.endsWith('.ogg') || u.includes('.mp4?') || u.includes('.webm?') || u.includes('.ogg?')
}

function getEmbedUrl(url) {
  const u = String(url || '').trim()
  if (!u) return ''
  try {
    const parsed = new URL(u)
    const host = parsed.hostname.toLowerCase()
    if (host.includes('youtu.be')) {
      const id = parsed.pathname.replace('/', '').trim()
      return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : ''
    }
    if (host.includes('youtube.com')) {
      const id = parsed.searchParams.get('v') || ''
      return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : ''
    }
    if (host.includes('vimeo.com')) {
      const id = parsed.pathname.split('/').filter(Boolean).pop() || ''
      return id ? `https://player.vimeo.com/video/${encodeURIComponent(id)}` : ''
    }
  } catch (_) {}
  return ''
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
  const [selectedIndices, setSelectedIndices] = useState([])
  const [questionStatuses, setQuestionStatuses] = useState([])
  const [sessionId, setSessionId] = useState('')
  const [startedAt, setStartedAt] = useState(null)

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
        const sid = `qb_${Date.now()}_${Math.random().toString(16).slice(2)}`
        setQuestions(shuffled)
        setIndex(0)
        setSelected(null)
        setSubmitted(false)
        setScore(0)
        setSelectedIndices(Array(shuffled.length).fill(null))
        setQuestionStatuses(Array(shuffled.length).fill(null))
        setSessionId(sid)
        setStartedAt(Date.now())
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
  const assets = useMemo(() => extractQuestionAssets(current), [current])
  const status = useMemo(() => (Array.isArray(questionStatuses) ? questionStatuses[index] : null), [index, questionStatuses])

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
    setSelectedIndices((prev) => {
      const next = Array.isArray(prev) ? [...prev] : []
      next[index] = selected
      return next
    })
    setQuestionStatuses((prev) => {
      const next = Array.isArray(prev) ? [...prev] : []
      next[index] = ok ? 'correct' : 'wrong'
      return next
    })
  }

  const next = () => {
    if (index >= total - 1) {
      const correctCount = Array.isArray(questionStatuses) ? questionStatuses.filter((s) => s === 'correct').length : Number(score) || 0
      const wrongCount = Array.isArray(questionStatuses) ? questionStatuses.filter((s) => s === 'wrong').length : Math.max(0, total - correctCount)
      const percent = total > 0 ? Math.round((correctCount / total) * 100) : 0
      const payload = {
        version: 1,
        sessionId,
        filters: { category: params.category, subcategory: params.subcategory, tag: params.tag },
        bankIds: params.bankIds,
        startedAt: startedAt || Date.now(),
        finishedAt: Date.now(),
        score: correctCount,
        total,
        percent,
        correctCount,
        wrongCount,
        selectedIndices,
        questionStatuses,
        questions,
      }
      try {
        if (sessionId) localStorage.setItem(`connekt_qb_exam:${sessionId}`, JSON.stringify(payload))
      } catch (_) {}
      const qs = new URLSearchParams()
      if (sessionId) qs.set('sessionId', sessionId)
      navigateTo(`/aluno/banco-de-questoes/resultado?${qs.toString()}`)
      return
    }
    setIndex((i) => i + 1)
    setSelected(null)
    setSubmitted(false)
  }

  return (
    <AlunoLayout>
      <div className="w-full">
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
              <div className="text-[14px] font-semibold text-[#22252B]">{assets.title || 'Questão'}</div>
              {assets.questionText ? (
                <div className="mt-2 text-[12px] text-[#3A3D45] whitespace-pre-wrap">{assets.questionText}</div>
              ) : null}

              {assets.questionImages.length ? (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {assets.questionImages.map((src) => (
                    <a key={src} href={src} target="_blank" rel="noreferrer" className="block rounded-[10px] overflow-hidden border border-[#E3E4E5] bg-white">
                      <img src={src} alt="" className="w-full h-[180px] object-cover" />
                    </a>
                  ))}
                </div>
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
                  const images = Array.isArray(c?.images) ? c.images : []
                  const videos = Array.isArray(c?.videos) ? c.videos : []
                  const docs = Array.isArray(c?.docs) ? c.docs : []
                  const hasMedia = images.length || videos.length || docs.length
                  return (
                    <div key={c.id || i} className={`rounded-[10px] border ${cls} overflow-hidden`}>
                      <button
                        type="button"
                        className="w-full text-left px-4 py-3"
                        disabled={submitted}
                        onClick={() => setSelected(i)}
                      >
                        {String(c?.html || '').trim() ? (
                          <div className="text-[12px] text-[#22252B] leading-relaxed" dangerouslySetInnerHTML={{ __html: c.html }} />
                        ) : (
                          <div className="text-[12px] text-[#22252B]">{c.label}</div>
                        )}
                      </button>
                      {hasMedia ? (
                        <div className="px-4 pb-3">
                          {images.length ? (
                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {images.map((src) => (
                                <a key={src} href={src} target="_blank" rel="noreferrer" className="block rounded-[10px] overflow-hidden border border-[#E3E4E5] bg-white">
                                  <img src={src} alt="" className="w-full h-[180px] object-cover" />
                                </a>
                              ))}
                            </div>
                          ) : null}

                          {videos.length ? (
                            <div className="mt-3 space-y-3">
                              {videos.map((url) => {
                                const embed = getEmbedUrl(url)
                                if (embed) {
                                  return (
                                    <div key={url} className="rounded-[10px] overflow-hidden border border-[#E3E4E5] bg-white">
                                      <iframe
                                        title="Vídeo"
                                        src={embed}
                                        className="w-full h-[240px]"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                      />
                                    </div>
                                  )
                                }
                                if (isVideoFile(url)) {
                                  return (
                                    <div key={url} className="rounded-[10px] overflow-hidden border border-[#E3E4E5] bg-white">
                                      <video src={url} controls className="w-full h-[240px] bg-black" />
                                    </div>
                                  )
                                }
                                return (
                                  <a key={url} href={url} target="_blank" rel="noreferrer" className="inline-flex text-[12px] font-semibold text-[#0047BB]">
                                    Abrir vídeo
                                  </a>
                                )
                              })}
                            </div>
                          ) : null}

                          {docs.length ? (
                            <div className="mt-3 flex flex-wrap gap-3">
                              {docs.map((url) => (
                                <a key={url} href={url} target="_blank" rel="noreferrer" className="inline-flex text-[12px] font-semibold text-[#0047BB]">
                                  Abrir arquivo
                                </a>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>

              {submitted && (assets.resolutionText || assets.resolutionImages.length || assets.resolutionVideos.length || assets.resolutionDocs.length) ? (
                <div className="mt-5 rounded-[12px] border border-[#BFDBFE] bg-[#EFF6FF] p-5">
                  <div className="text-[12px] font-semibold text-[#0047BB]">Resolução</div>
                  {assets.resolutionText ? (
                    <div className="mt-2 text-[12px] text-[#1E1B39] leading-relaxed whitespace-pre-wrap">{assets.resolutionText}</div>
                  ) : null}

                  {assets.resolutionImages.length ? (
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {assets.resolutionImages.map((src) => (
                        <a key={src} href={src} target="_blank" rel="noreferrer" className="block rounded-[10px] overflow-hidden border border-[#E3E4E5] bg-white">
                          <img src={src} alt="" className="w-full h-[180px] object-cover" />
                        </a>
                      ))}
                    </div>
                  ) : null}

                  {assets.resolutionVideos.length ? (
                    <div className="mt-4 space-y-3">
                      {assets.resolutionVideos.map((url) => {
                        const embed = getEmbedUrl(url)
                        if (embed) {
                          return (
                            <div key={url} className="rounded-[10px] overflow-hidden border border-[#E3E4E5] bg-white">
                              <iframe
                                title="Vídeo explicativo"
                                src={embed}
                                className="w-full h-[240px]"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              />
                            </div>
                          )
                        }
                        if (isVideoFile(url)) {
                          return (
                            <div key={url} className="rounded-[10px] overflow-hidden border border-[#E3E4E5] bg-white">
                              <video src={url} controls className="w-full h-[240px] bg-black" />
                            </div>
                          )
                        }
                        return (
                          <a key={url} href={url} target="_blank" rel="noreferrer" className="inline-flex text-[12px] font-semibold text-[#0047BB]">
                            Abrir vídeo
                          </a>
                        )
                      })}
                    </div>
                  ) : null}

                  {assets.resolutionDocs.length ? (
                    <div className="mt-4 flex flex-col gap-2">
                      {assets.resolutionDocs.map((url) => (
                        <a key={url} href={url} target="_blank" rel="noreferrer" className="text-[12px] font-semibold text-[#0047BB]">
                          Abrir material
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

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
    </AlunoLayout>
  )
}
