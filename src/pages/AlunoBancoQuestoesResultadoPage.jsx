import React, { useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { ChevronLeft } from 'lucide-react'
import AlunoLayout from '@/components/AlunoLayout'

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
  const safeHtml = (html) => {
    const s = String(html || '')
    if (!s.trim()) return ''
    let out = s.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    out = out.replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
    out = out.replace(/\s(href|src)\s*=\s*(['"])\s*javascript:[^'"]*\2/gi, ' $1="#"')
    return out
  }
  const normalize = (list) => {
    const arr = Array.isArray(list) ? list : []
    return arr
      .map((v) => getText(v).trim())
      .filter(Boolean)
      .map((u) => resolveSupabasePublicUrl(u))
  }
  return raw
    .map((c, idx) => {
      if (typeof c === 'string') {
        const choiceHtml = safeHtml((meta?.choicesTextHtml && typeof meta.choicesTextHtml === 'object') ? meta.choicesTextHtml?.[idx] : '')
        const metaChoicesMedia = (meta?.choicesMedia && typeof meta.choicesMedia === 'object') ? meta.choicesMedia : {}
        const metaChoiceMedia = (metaChoicesMedia?.[idx] && typeof metaChoicesMedia[idx] === 'object') ? metaChoicesMedia[idx] : null
        const images = normalize([metaChoiceMedia?.imageUrl])
        const videos = normalize([metaChoiceMedia?.videoUrl])
        return { id: `opt-${idx}`, label: c, html: choiceHtml, images, videos, is_correct: false }
      }
      if (c && typeof c === 'object') {
        const label = String(c.label || c.text || c.title || '').trim()
        const choiceHtml = safeHtml((meta?.choicesTextHtml && typeof meta.choicesTextHtml === 'object') ? meta.choicesTextHtml?.[idx] : '')
        const metaChoicesMedia = (meta?.choicesMedia && typeof meta.choicesMedia === 'object') ? meta.choicesMedia : {}
        const metaChoiceMedia = (metaChoicesMedia?.[idx] && typeof metaChoicesMedia[idx] === 'object') ? metaChoicesMedia[idx] : null
        const images = normalize([metaChoiceMedia?.imageUrl])
        const videos = normalize([metaChoiceMedia?.videoUrl])
        return { id: String(c.id || `opt-${idx}`), label, html: choiceHtml, images, videos, is_correct: !!c.is_correct }
      }
      return { id: `opt-${idx}`, label: '', is_correct: false }
    })
    .filter((c) => String(c.label || '').trim().length > 0 || String(c.html || '').trim().length > 0)
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

function formatDuration(ms) {
  const totalSec = Math.max(0, Math.floor((Number(ms) || 0) / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  const pad = (v) => String(v).padStart(2, '0')
  return `${pad(m)}:${pad(s)}`
}

function PercentCircle({ percent }) {
  const p = Math.max(0, Math.min(100, Number(percent) || 0))
  return (
    <div className="w-[84px] h-[84px] rounded-full p-[6px]" style={{ background: `conic-gradient(#0047BB ${p}%, #E3E4E5 0)` }}>
      <div className="w-full h-full rounded-full bg-white border border-[#E3E4E5] flex flex-col items-center justify-center">
        <div className="text-[18px] font-bold text-[#1E1B39] leading-none">{p}%</div>
        <div className="mt-1 text-[10px] text-[#737780] leading-none">Aproveitamento</div>
      </div>
    </div>
  )
}

function ResultQuestionCard({ idx, question, selectedIndex, status }) {
  const choices = parseChoices(question)
  const correctIdx = choices.findIndex((c) => !!c.is_correct)
  const selected = typeof selectedIndex === 'number' ? selectedIndex : null
  const selectedLabel = selected != null ? getText(choices?.[selected]?.label) : ''
  const correctLabel = correctIdx >= 0 ? getText(choices?.[correctIdx]?.label) : ''
  const assets = extractQuestionAssets(question)
  const border = status === 'correct' ? 'border-[#86EFAC]' : status === 'wrong' ? 'border-[#FCA5A5]' : 'border-[#E3E4E5]'
  const pill = status === 'correct' ? 'bg-[#E9FFEF] text-[#166534]' : status === 'wrong' ? 'bg-[#FEF2F2] text-[#991B1B]' : 'bg-[#F6F5FA] text-[#22252B]'
  return (
    <div className={`rounded-[12px] bg-white border ${border} overflow-hidden`}>
      <div className="px-5 py-4 border-b border-[#E3E4E5] flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`inline-flex items-center h-[18px] px-3 text-[10px] rounded-[54px] leading-none font-medium ${pill}`}>
            {status === 'correct' ? 'Correta' : status === 'wrong' ? 'Errada' : 'Respondida'}
          </span>
          <span className="text-[12px] text-[#737780] truncate">Questão {idx + 1}</span>
        </div>
      </div>

      <div className="p-5">
        <div className="text-[14px] font-semibold text-[#22252B]">{assets.title || `Questão ${idx + 1}`}</div>
        {assets.questionText ? (
          <div className="mt-2 text-[12px] text-[#3A3D45] whitespace-pre-wrap leading-relaxed">{assets.questionText}</div>
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

        <div className="mt-4 grid grid-cols-1 gap-2">
          <div className="rounded-[10px] border border-[#E3E4E5] bg-[#F9FAFB] p-4">
            <div className="text-[11px] text-[#737780]">Sua resposta</div>
            <div className="mt-1 text-[12px] text-[#22252B]">{selectedLabel || '—'}</div>
          </div>
          {correctIdx >= 0 ? (
            <div className="rounded-[10px] border border-[#E3E4E5] bg-[#F9FAFB] p-4">
              <div className="text-[11px] text-[#737780]">Resposta correta</div>
              <div className="mt-1 text-[12px] text-[#22252B]">{correctLabel || '—'}</div>
            </div>
          ) : null}
        </div>

        {(assets.resolutionText || assets.resolutionImages.length || assets.resolutionVideos.length) ? (
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
      </div>
    </div>
  )
}

export default function AlunoBancoQuestoesResultadoPage() {
  const params = useMemo(() => {
    try {
      const sp = new URLSearchParams(window.location.search || '')
      return { sessionId: String(sp.get('sessionId') || '').trim() }
    } catch (_) {
      return { sessionId: '' }
    }
  }, [])

  const [data, setData] = useState(null)

  useEffect(() => {
    if (!params.sessionId) {
      setData(null)
      return
    }
    try {
      const raw = localStorage.getItem(`connekt_qb_exam:${params.sessionId}`)
      if (!raw) {
        setData(null)
        return
      }
      const parsed = JSON.parse(raw)
      setData(parsed || null)
    } catch (_) {
      setData(null)
    }
  }, [params.sessionId])

  const questions = Array.isArray(data?.questions) ? data.questions : []
  const selectedIndices = Array.isArray(data?.selectedIndices) ? data.selectedIndices : []
  const statuses = Array.isArray(data?.questionStatuses) ? data.questionStatuses : []
  const total = Number(data?.total || questions.length) || 0
  const correct = Number(data?.correctCount || statuses.filter((s) => s === 'correct').length) || 0
  const wrong = Number(data?.wrongCount || statuses.filter((s) => s === 'wrong').length) || Math.max(0, total - correct)
  const percent = Number(data?.percent || (total > 0 ? Math.round((correct / total) * 100) : 0)) || 0
  const subtitleParts = [getText(data?.filters?.category), getText(data?.filters?.subcategory), getText(data?.filters?.tag)].filter(Boolean)
  const subtitle = subtitleParts.length ? subtitleParts.join(' • ') : 'Banco de Questões'
  const durationMs = (Number(data?.finishedAt) && Number(data?.startedAt)) ? Math.max(0, Number(data.finishedAt) - Number(data.startedAt)) : 0

  return (
    <AlunoLayout>
      <Helmet>
        <title>Connekt - Resultado - Banco de Questões</title>
      </Helmet>

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
                <div className="text-[14px] font-semibold text-[#22252B] truncate">Resultado</div>
                <div className="text-[12px] text-[#737780] truncate">{subtitle}</div>
              </div>
            </div>
            <button
              type="button"
              className="h-9 px-4 rounded-[8px] bg-[#0047BB] text-white text-[12px] font-semibold"
              onClick={() => navigateTo('/aluno/banco-de-questoes')}
            >
              Voltar ao Banco
            </button>
          </div>
        </div>

        <div className="max-w-[1100px] mx-auto px-5 py-8">
          {!data ? (
            <div className="bg-white border border-[#E3E4E5] rounded-[12px] p-6">
              <div className="text-[14px] font-semibold text-[#22252B]">Resultado não encontrado</div>
              <div className="mt-1 text-[12px] text-[#737780]">Finalize uma sequência de questões para ver o resultado aqui.</div>
              <button
                type="button"
                className="mt-4 h-9 px-4 rounded-[8px] bg-[#0047BB] text-white text-[12px] font-semibold"
                onClick={() => navigateTo('/aluno/banco-de-questoes')}
              >
                Voltar
              </button>
            </div>
          ) : (
            <>
              <div className="bg-white border border-[#E3E4E5] rounded-[12px] p-6">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                  <div className="min-w-0">
                    <div className="text-[16px] font-semibold text-[#22252B]">Resultado final</div>
                    <div className="mt-1 text-[12px] text-[#737780]">
                      {total} questões • {correct} corretas • {wrong} erradas{durationMs ? ` • ${formatDuration(durationMs)}` : ''}
                    </div>
                  </div>
                  <PercentCircle percent={percent} />
                </div>

                <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-[10px] border border-[#E3E4E5] bg-[#F9FAFB] p-4">
                    <div className="text-[11px] text-[#737780]">Acertos</div>
                    <div className="mt-1 text-[18px] font-bold text-[#1E1B39]">{String(correct)}</div>
                  </div>
                  <div className="rounded-[10px] border border-[#E3E4E5] bg-[#F9FAFB] p-4">
                    <div className="text-[11px] text-[#737780]">Erros</div>
                    <div className="mt-1 text-[18px] font-bold text-[#1E1B39]">{String(wrong)}</div>
                  </div>
                  <div className="rounded-[10px] border border-[#E3E4E5] bg-[#F9FAFB] p-4">
                    <div className="text-[11px] text-[#737780]">Pontuação</div>
                    <div className="mt-1 text-[18px] font-bold text-[#1E1B39]">{String(correct)}/{String(total)}</div>
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {questions.map((q, idx) => (
                  <ResultQuestionCard
                    key={String(q?.id || idx)}
                    idx={idx}
                    question={q}
                    selectedIndex={selectedIndices[idx]}
                    status={statuses[idx]}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </AlunoLayout>
  )
}
