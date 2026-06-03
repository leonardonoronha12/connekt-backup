import React, { useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, ChevronLeft, ChevronRight, FileText, PlayCircle, Search, Star, Menu, X } from 'lucide-react'
import Header from '@/components/Header'
import BrandLogo from '@/components/BrandLogo'
import CourseFooter from '@/components/CourseFooter'
import ProgressRingIcon from '@/components/ProgressRingIcon.jsx'
import Skeleton from '@/components/ui/Skeleton.jsx'
import { supabase } from '@/lib/supabaseClient'
import { captureVideoFrameDataUrl } from '@/lib/videoThumb'
import { useAuth } from '@/contexts/SupabaseAuthContext'
import { useActiveProducerUserId } from '@/hooks/useActiveProducerUserId'
import { setActiveProducerUserId } from '@/services/producerScope'
import { ALUNO_NAV_SECTIONS } from '@/constants/alunoNavSections'

function navigateTo(path) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function parseJsonMaybe(value) {
  if (!value) return null
  if (typeof value === 'object') return value
  if (typeof value !== 'string') return null
  try { return JSON.parse(value) } catch (_) { return null }
}

function safeLsGet(key) {
  if (!key) return ''
  try { return String(localStorage.getItem(String(key)) || '') } catch (_) { return '' }
}

function getCourseMeta(row) {
  const fromData = parseJsonMaybe(row?.data) || null
  const parsedModules = parseJsonMaybe(row?.modules) || null
  const fromModulesMeta = parsedModules && typeof parsedModules === 'object' ? (parsedModules.meta || null) : null
  return { ...(fromModulesMeta || {}), ...(fromData || {}) }
}

function parsePriceNumber(value) {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    let s = String(value || '').trim()
    if (!s) return NaN
    s = s.replace(/\s+/g, '')
    s = s.replace(/^R\$\s*/i, '')
    s = s.replace(/[^\d,.-]/g, '')
    if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.')
    else if (s.includes(',') && !s.includes('.')) s = s.replace(',', '.')
    return parseFloat(s)
  }
  return Number(value)
}

function resolveCoursePriceNumber(courseRow) {
  const meta = getCourseMeta(courseRow)
  const candidates = [
    courseRow?.price,
    courseRow?.course_price,
    meta?.price,
    meta?.preco,
    meta?.valor,
    meta?.value,
    meta?.coursePrice,
    meta?.course_price,
    meta?.productPrice,
    meta?.product_price,
    meta?.checkoutPrice,
    meta?.checkout_price,
    meta?.checkoutValue,
    meta?.checkout_value,
    meta?.paymentValue,
    meta?.payment_value,
  ]
  for (const c of candidates) {
    const n = parsePriceNumber(c)
    if (Number.isFinite(n) && n > 0) return n
  }
  const centsCandidates = [
    courseRow?.price_cents,
    courseRow?.priceCents,
    courseRow?.course_price_cents,
    courseRow?.coursePriceCents,
    meta?.price_cents,
    meta?.priceCents,
    meta?.course_price_cents,
    meta?.coursePriceCents,
  ]
  for (const c of centsCandidates) {
    const n = Number(c)
    if (Number.isFinite(n) && n > 0) return n / 100
  }
  return 0
}

function isPaidCourseFromMeta(courseRow) {
  const meta = getCourseMeta(courseRow)
  const boolCandidates = [
    meta?.is_paid,
    meta?.isPaid,
    meta?.paid,
    meta?.pago,
    meta?.course_is_paid,
    meta?.courseIsPaid,
    meta?.isPaidCourse,
  ]
  for (const c of boolCandidates) {
    if (typeof c === 'boolean') return c
    const s = String(c ?? '').trim().toLowerCase()
    if (s === 'true' || s === '1' || s === 'paid' || s === 'pago' || s === 'sim') return true
  }
  return false
}

function getCourseModules(row) {
  const parsed = parseJsonMaybe(row?.modules)
  if (Array.isArray(parsed)) return parsed
  if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed.modules)) return parsed.modules
    if (Array.isArray(parsed.items)) return parsed.items
  }
  const fromData = parseJsonMaybe(row?.data)
  if (fromData && typeof fromData === 'object' && Array.isArray(fromData.modules)) return fromData.modules
  return []
}

function getModuleLessons(mod) {
  if (!mod) return []
  if (Array.isArray(mod.lessons)) return mod.lessons
  if (Array.isArray(mod.aulas)) return mod.aulas
  if (Array.isArray(mod.items)) return mod.items
  if (mod && typeof mod === 'object' && Array.isArray(mod.module_lessons)) return mod.module_lessons
  return []
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0
}

function resolveLessonCoverCandidate(lesson, toPublicCoursesMediaUrl) {
  const l = lesson && typeof lesson === 'object' ? lesson : {}
  const meta = (l.metadata && typeof l.metadata === 'object') ? l.metadata : ((l.meta && typeof l.meta === 'object') ? l.meta : null)
  const media = (l.media && typeof l.media === 'object') ? l.media : null
  const raw = [
    l.cover_image_url,
    l.coverImageUrl,
    l.thumbnail_url,
    l.thumbnailUrl,
    l.poster,
    l.poster_url,
    meta?.cover_image_url,
    meta?.coverImageUrl,
    meta?.thumbnail_url,
    meta?.thumbnailUrl,
    meta?.poster,
    meta?.poster_url,
    media?.cover_image_url,
    media?.coverImageUrl,
    media?.thumbnail_url,
    media?.thumbnailUrl,
    media?.poster,
    media?.poster_url,
  ].find((v) => isNonEmptyString(v))
  if (!raw) return ''
  const map = typeof toPublicCoursesMediaUrl === 'function' ? toPublicCoursesMediaUrl : ((x) => x)
  return String(map(raw) || raw || '').trim()
}

function resolveLessonPlayableVideoUrl(lesson, toPublicCoursesMediaUrl) {
  const l = lesson && typeof lesson === 'object' ? lesson : {}
  const mediaObj = (l.media && typeof l.media === 'object') ? l.media : ((l.metadata && typeof l.metadata === 'object') ? l.metadata : null)
  const raw = [
    l.video_url,
    l.videoUrl,
    l.video_src,
    l.videoSrc,
    l.media_url,
    l.mediaUrl,
    l.video_path,
    l.videoPath,
    l.url,
    mediaObj?.video_url,
    mediaObj?.videoUrl,
    mediaObj?.video_path,
    mediaObj?.videoPath,
  ].find((v) => isNonEmptyString(v))
  if (!raw) return ''
  const map = typeof toPublicCoursesMediaUrl === 'function' ? toPublicCoursesMediaUrl : ((x) => x)
  const u = String(map(raw) || raw || '').trim()
  if (!u) return ''
  const isMp4Like = /\.(mp4|webm|ogg)(\?.*)?$/i.test(u)
  const isHlsLike = /\.(m3u8)(\?.*)?$/i.test(u)
  if (!isMp4Like && !isHlsLike) return ''
  return u
}

function getFirstLessonInfo(row, toPublicCoursesMediaUrl) {
  const modules = getCourseModules(row)
  const list = []
  let first = null
  for (const mod of (Array.isArray(modules) ? modules : [])) {
    const lessons = getModuleLessons(mod)
    for (const lesson of lessons) {
      const title = String(lesson?.title || lesson?.name || '').trim()
      const moduleId = String(mod?.id || mod?.module_id || mod?.moduleId || '').trim()
      const lessonId = String(lesson?.id || lesson?.lesson_id || lesson?.lessonId || '').trim()
      const coverCandidate = resolveLessonCoverCandidate(lesson, toPublicCoursesMediaUrl)
      const playableVideoUrl = resolveLessonPlayableVideoUrl(lesson, toPublicCoursesMediaUrl)
      const item = { title, moduleId, lessonId, coverCandidate, playableVideoUrl }
      list.push(item)
      if (!first && title) first = item
    }
  }
  if (!first) first = list[0] || null
  return {
    title: (first && first.title) ? first.title : 'Aula',
    lessonsTotal: list.length || null,
    moduleId: first?.moduleId || '',
    lessonId: first?.lessonId || '',
    coverCandidate: first?.coverCandidate || '',
    playableVideoUrl: first?.playableVideoUrl || '',
  }
}

function safeJsonParse(value) {
  try { return JSON.parse(String(value || '')) } catch (_) { return null }
}

function getContinueLessonInfo(courseRow, continueInfo, toPublicCoursesMediaUrl) {
  const base = getFirstLessonInfo(courseRow, toPublicCoursesMediaUrl)
  const modules = getCourseModules(courseRow)
  const list = Array.isArray(modules) ? modules : []
  const midWanted = String(continueInfo?.moduleId || '').trim()
  const lidWanted = String(continueInfo?.lessonId || '').trim()
  const mIdxWanted = Number.isFinite(Number(continueInfo?.moduleIndex)) ? Number(continueInfo.moduleIndex) : null
  const lIdxWanted = Number.isFinite(Number(continueInfo?.lessonIndex)) ? Number(continueInfo.lessonIndex) : null
  if ((!midWanted || !lidWanted) && (mIdxWanted == null || lIdxWanted == null)) return base

  let chosenLesson = null
  let chosenModuleId = ''
  let chosenLessonId = ''
  let lessonsTotal = null

  for (let i = 0; i < list.length; i += 1) {
    const mod = list[i]
    const mid = String(mod?.id || mod?.module_id || mod?.moduleId || '').trim()
    const lessons = getModuleLessons(mod)
    const lessonsList = Array.isArray(lessons) ? lessons : []
    if (lessonsList.length > 0) lessonsTotal = (lessonsTotal == null ? 0 : lessonsTotal) + lessonsList.length
    if (midWanted && mid && midWanted !== mid) continue
    if (mIdxWanted != null && i !== mIdxWanted && (!midWanted || !mid)) continue
    if (lidWanted) {
      const l = lessonsList.find((x) => String(x?.id || x?.lesson_id || x?.lessonId || '').trim() === lidWanted) || null
      if (l) {
        chosenLesson = l
        chosenModuleId = mid
        chosenLessonId = String(lidWanted)
        break
      }
    }
    if (!lidWanted && lIdxWanted != null && lessonsList[lIdxWanted]) {
      const l = lessonsList[lIdxWanted]
      const lid = String(l?.id || l?.lesson_id || l?.lessonId || '').trim()
      if (lid) {
        chosenLesson = l
        chosenModuleId = mid
        chosenLessonId = lid
        break
      }
    }
  }

  if (!chosenLesson) return base
  const title = String(chosenLesson?.title || chosenLesson?.name || '').trim() || base?.title || 'Aula'
  const coverCandidate = resolveLessonCoverCandidate(chosenLesson, toPublicCoursesMediaUrl) || ''
  const playableVideoUrl = resolveLessonPlayableVideoUrl(chosenLesson, toPublicCoursesMediaUrl) || ''
  return {
    title,
    moduleId: chosenModuleId || base?.moduleId || '',
    lessonId: chosenLessonId || base?.lessonId || '',
    coverCandidate: coverCandidate || base?.coverCandidate || '',
    playableVideoUrl: playableVideoUrl || base?.playableVideoUrl || '',
    lessonsTotal: lessonsTotal == null ? base?.lessonsTotal : lessonsTotal,
  }
}

function SectionTitle({ title, onMore, showMoreInline = false, icon: Icon = null }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-[6px] bg-[#EEF2FF] flex items-center justify-center">
          {Icon ? <Icon className="w-4 h-4 text-[#0047BB]" /> : <div className="w-2.5 h-2.5 rounded-[3px] bg-[#0047BB]" />}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-[14px] font-semibold text-[#22252B]">{title}</div>
          {onMore && showMoreInline ? (
            <button
              type="button"
              className="inline-flex items-center gap-2 h-8 px-4 rounded-[8px] bg-[#EEF2FF] text-[#0047BB] text-[12px] font-semibold"
              onClick={onMore}
            >
              <span className="text-[16px] leading-none">+</span>
              Ver mais
            </button>
          ) : null}
        </div>
      </div>
      {onMore && !showMoreInline ? (
        <button
          type="button"
          className="text-[12px] font-semibold text-[#0047BB] hover:underline"
          onClick={onMore}
        >
          Ver mais
        </button>
      ) : (
        <div className="w-16" />
      )}
    </div>
  )
}

function CourseCard({ cover, title, progress, locked, onClick }) {
  const p = Math.max(0, Math.min(100, Number(progress || 0)))
  return (
    <div className="w-[252px] flex-shrink-0">
      <button
        type="button"
        disabled={!onClick}
        onClick={onClick}
        className={`relative w-[252px] h-[326px] rounded-[12px] overflow-hidden border border-[#E3E4E5] bg-[#F8FAFC] text-left ${
          !onClick ? 'cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        <img
          src={cover}
          alt=""
          className={`absolute inset-0 w-full h-full object-cover ${locked ? 'grayscale opacity-70' : ''}`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        {locked ? (
          <div className="absolute top-3 right-3 text-[10px] font-semibold bg-black/55 text-white px-2 py-1 rounded-full">
            BLOQUEADO
          </div>
        ) : null}
        <div className="absolute inset-0 px-3 pb-5 flex flex-col items-center justify-end text-center pointer-events-none">
          <img src="/logo-expanded.svg" alt="" className="w-[110px] h-auto" />
          <div className="mt-2 h-[2px] w-10 bg-white/70 rounded" />
          <div className="mt-3 text-[14px] font-semibold text-white truncate w-full">{title}</div>
        </div>
      </button>
      {locked ? null : (
        <div className="mt-2">
          <div className="h-1.5 w-full rounded-full bg-[#EEF2FF] overflow-hidden">
            <div className="h-full bg-[#0047BB]" style={{ width: `${p}%` }} />
          </div>
        </div>
      )}
    </div>
  )
}

function ContinueCard({ cover, category, title, progress, lessonsDone, lessonsTotal, onClick }) {
  const p = Math.max(0, Math.min(100, Number(progress || 0)))
  const hasLessons = Number.isFinite(Number(lessonsDone)) && Number.isFinite(Number(lessonsTotal)) && Number(lessonsTotal) > 0
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`w-[300px] flex-shrink-0 rounded-[12px] border border-[#E3E4E5] bg-white overflow-hidden shadow-sm text-left ${
        onClick ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
      }`}
    >
      <div className="relative h-[170px] bg-[#F8FAFC]">
        <img src={cover} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/10" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
            <div className="w-0 h-0 border-t-[7px] border-t-transparent border-b-[7px] border-b-transparent border-l-[12px] border-l-[#0047BB] ml-1" />
          </div>
        </div>
      </div>

      <div className="px-5 pt-4 pb-3">
        <div className="text-[16px] font-medium text-[#22252B]">{category}</div>
        <div className="mt-1 text-[16px] text-[#22252B] line-clamp-1">{title}</div>

        <div className="mt-4 flex items-center justify-between text-[12px] text-[#737780]">
          <div>{p}%</div>
          {hasLessons ? <div>{Number(lessonsDone)}/{Number(lessonsTotal)} aulas</div> : <div />}
        </div>

        <div className="mt-2 h-1.5 w-full rounded-full bg-[#E3E4E5] overflow-hidden">
          <div className="h-full bg-[#0047BB]" style={{ width: `${p}%` }} />
        </div>

        <div className="mt-4 flex items-center justify-center gap-3 text-[#0047BB]">
          <span className="text-[14px] font-semibold">Continuar</span>
          <div className="w-6 h-6 rounded-full border border-[#0047BB] flex items-center justify-center">
            <div className="w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-l-[7px] border-l-[#0047BB] ml-[1px]" />
          </div>
        </div>
      </div>
    </button>
  )
}

function SimuladoCard({ title, progress, isPaid, price, onClick }) {
  const p = Math.max(0, Math.min(100, Number(progress || 0)))
  const paid =
    typeof isPaid === 'boolean'
      ? isPaid
      : Math.max(0, Number(price || 0)) > 0
  const renderApprovalIcon = () => <ProgressRingIcon value={p} />
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`bg-white border border-[#E3E4E5] rounded-[4px] p-4 w-[252px] h-[230px] flex flex-col flex-shrink-0 text-left ${
        onClick ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <img src="/t simulados 1.png" alt="Simulado" className="w-[85px] h-[85px] rounded-md object-cover" />
        </div>
        <div className="flex flex-col items-end gap-4">
          <span className="inline-flex items-center justify-center w-[80px] h-[18px] px-3 text-[10px] rounded-[54px] leading-none font-medium bg-[#E9FFEF] text-[#06C270]">
            Publicado
          </span>
          {!paid ? (
            <span className="inline-flex items-center justify-center w-[80px] h-[18px] px-3 text-[10px] rounded-[54px] leading-none font-medium bg-[#EEF2FF] text-[#0047BB]">
              Gratuito
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-0">
        <div className="flex items-center justify-between">
          <h4 className="text-[12px] font-medium text-[#1E1B39] font-inter">{title}</h4>
        </div>
        <p className="text-[10px] text-[#9291A5] font-inter font-[400] mt-1">Simulado criado por você</p>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1 text-[12px] font-normal h-[20px] px-2 py-0 rounded-[4px]"
          style={{ backgroundColor: 'rgba(173,137,247,0.1)', color: '#22252B' }}
        >
          <span className="leading-none text-[7px] text-[#AD89F7]">🟪</span>
          <span className="text-[10px] text-[#22252B] font-normal not-italic">Categoria</span>
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex flex-col w-full">
          <span className="text-[12px] text-[#1E1B39] font-inter font-bold">Aprovação (%)</span>
        </div>
        <div className="flex items-center gap-1 text-[#0047BB]">
          {renderApprovalIcon()}
          <span className="text-[12px] font-bold text-[#0047BB]">{p}%</span>
        </div>
      </div>
    </button>
  )
}

function ProducerSimuladosModal({ open, onClose, simulados, onSelectSimulado, ownershipTick }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  const list = useMemo(() => {
    const q = String(query || '').trim().toLowerCase()
    const base = Array.isArray(simulados) ? simulados : []
    const withFlags = base.map((s) => {
      const id = String(s?.id || '').trim()
      const paid = typeof (s?.is_paid ?? s?.isPaid) === 'boolean'
        ? (s.is_paid ?? s.isPaid)
        : Math.max(0, Number(s?.price || 0)) > 0
      const owned = id ? safeLsGet(`connekt_simulado_owned:${id}`) === '1' : false
      return { ...s, __paid: paid, __owned: owned }
    })
    const filtered = withFlags.filter((s) => {
      if (filter === 'free') return !s.__paid
      if (filter === 'paid') return !!s.__paid
      if (filter === 'owned') return !!s.__paid && !!s.__owned
      if (filter === 'not_owned') return !!s.__paid && !s.__owned
      return true
    })
    if (!q) return filtered
    return filtered.filter((s) => String(s?.title || '').toLowerCase().includes(q))
  }, [filter, query, simulados, ownershipTick])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80]">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Fechar" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="absolute left-1/2 top-1/2 w-[calc(100%-24px)] max-w-[980px] -translate-x-1/2 -translate-y-1/2 rounded-[14px] bg-white border border-[#E3E4E5] shadow-xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-[#E3E4E5] flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-[#22252B] truncate">Simulados do produtor</div>
            <div className="text-[12px] text-[#737780]">Todos os simulados disponíveis</div>
          </div>
          <button
            type="button"
            className="h-9 w-9 rounded-full border border-[#E3E4E5] bg-white flex items-center justify-center"
            aria-label="Fechar"
            onClick={onClose}
          >
            <X className="w-4 h-4 text-[#22252B]" />
          </button>
        </div>

        <div className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 w-full" style={{ height: '36px', padding: '0 12px', borderRadius: '8px', border: '1px solid rgb(227, 228, 229)', backgroundColor: 'rgb(249, 250, 251)' }}>
                <Search className="w-4 h-4 text-[#737780]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-[12px] text-[#22252B]"
                  placeholder="Buscar simulado"
                />
              </div>
            </div>
            <div className="text-[12px] text-[#737780] whitespace-nowrap">{list.length}</div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {[
              { k: 'all', l: 'Todos' },
              { k: 'free', l: 'Gratuitos' },
              { k: 'paid', l: 'Pagos' },
              { k: 'owned', l: 'Adquiridos' },
              { k: 'not_owned', l: 'Não adquiridos' },
            ].map((it) => {
              const active = filter === it.k
              return (
                <button
                  key={it.k}
                  type="button"
                  onClick={() => setFilter(it.k)}
                  className={`h-7 px-3 rounded-full text-[11px] font-semibold border transition-colors ${active ? 'bg-[#0047BB] border-[#0047BB] text-white' : 'bg-white border-[#E3E4E5] text-[#22252B] hover:bg-[#F9FAFB]'}`}
                >
                  {it.l}
                </button>
              )
            })}
          </div>

          <div className="mt-4 max-h-[60vh] overflow-auto pr-1">
            {list.length === 0 ? (
              <div className="text-[12px] text-[#737780] py-10 text-center">Nenhum simulado encontrado</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {list.map((s) => {
                  const paid = !!s.__paid
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onSelectSimulado?.(s)}
                      className="bg-white border border-[#E3E4E5] rounded-[12px] p-4 w-full text-left hover:bg-[#F9FAFB] transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-[10px] bg-[#EEF2FF] flex items-center justify-center flex-shrink-0">
                            <FileText className="w-5 h-5 text-[#0047BB]" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[12px] font-semibold text-[#1E1B39] font-inter truncate">{s.title}</div>
                            <div className="text-[10px] text-[#9291A5] font-inter">Simulado criado por você</div>
                          </div>
                        </div>
                        {!paid ? (
                          <span className="inline-flex items-center justify-center h-[18px] px-3 text-[10px] rounded-[54px] leading-none font-medium bg-[#EEF2FF] text-[#0047BB]">
                            Gratuito
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-4 flex items-center justify-between text-[12px] text-[#737780]">
                        <div>Aprovação</div>
                        <div className="flex items-center gap-1 text-[#0047BB]">
                          <span className="text-[12px] font-bold text-[#0047BB]">{Math.max(0, Math.min(100, Number(s.progress || 0)))}%</span>
                        </div>
                      </div>
                      <div className="mt-2 h-1.5 w-full rounded-full bg-[#E3E4E5] overflow-hidden">
                        <div className="h-full bg-[#0047BB]" style={{ width: `${Math.max(0, Math.min(100, Number(s.progress || 0)))}%` }} />
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function FeaturedCoursesModal({ open, onClose, courses, onSelectCourse, ownershipTick }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  const list = useMemo(() => {
    const q = String(query || '').trim().toLowerCase()
    const base = Array.isArray(courses) ? courses : []
    const filtered = base.filter((c) => {
      const cid = String(c?.courseId || c?.course_id || c?.id || '').trim()
      const owned = cid ? safeLsGet(`connekt_course_owned:${cid}`) === '1' : false
      const paid = !!c?.isPaid || !!c?.is_paid || Math.max(0, Number(c?.price || c?.coursePrice || 0)) > 0 || !!c?.locked
      const blocked = paid && !owned
      if (filter === 'blocked') return blocked
      if (filter === 'unlocked') return !blocked
      return true
    })
    if (!q) return filtered
    return filtered.filter((c) => String(c?.title || '').toLowerCase().includes(q))
  }, [courses, filter, query, ownershipTick])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80]">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Fechar" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="absolute left-1/2 top-1/2 w-[calc(100%-24px)] max-w-[980px] -translate-x-1/2 -translate-y-1/2 rounded-[14px] bg-white border border-[#E3E4E5] shadow-xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-[#E3E4E5] flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-[#22252B] truncate">Cursos em destaque</div>
            <div className="text-[12px] text-[#737780]">Veja todos os cursos em destaque</div>
          </div>
          <button
            type="button"
            className="h-9 w-9 rounded-full border border-[#E3E4E5] bg-white flex items-center justify-center"
            aria-label="Fechar"
            onClick={onClose}
          >
            <X className="w-4 h-4 text-[#22252B]" />
          </button>
        </div>

        <div className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 w-full" style={{ height: '36px', padding: '0 12px', borderRadius: '8px', border: '1px solid rgb(227, 228, 229)', backgroundColor: 'rgb(249, 250, 251)' }}>
                <Search className="w-4 h-4 text-[#737780]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-[12px] text-[#22252B]"
                  placeholder="Buscar curso"
                />
              </div>
            </div>
            <div className="text-[12px] text-[#737780] whitespace-nowrap">{list.length}</div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {[
              { k: 'all', l: 'Todos' },
              { k: 'blocked', l: 'Bloqueados' },
              { k: 'unlocked', l: 'Liberados' },
            ].map((it) => {
              const active = filter === it.k
              return (
                <button
                  key={it.k}
                  type="button"
                  onClick={() => setFilter(it.k)}
                  className={`h-7 px-3 rounded-full text-[11px] font-semibold border transition-colors ${active ? 'bg-[#0047BB] border-[#0047BB] text-white' : 'bg-white border-[#E3E4E5] text-[#22252B] hover:bg-[#F9FAFB]'}`}
                >
                  {it.l}
                </button>
              )
            })}
          </div>

          <div className="mt-4 max-h-[60vh] overflow-auto pr-1">
            {list.length === 0 ? (
              <div className="text-[12px] text-[#737780] py-10 text-center">Nenhum curso encontrado</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {list.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onSelectCourse?.(c)}
                    className="bg-white border border-[#E3E4E5] rounded-[12px] overflow-hidden w-full text-left hover:bg-[#F9FAFB] transition-colors"
                  >
                    <div className="relative h-[130px] w-full bg-[#EEF2FF]">
                      {c.cover ? (
                        <img src={c.cover} alt={c.title || 'Curso'} className="w-full h-full object-cover" />
                      ) : null}
                      <div className="absolute left-3 top-3 inline-flex items-center gap-2 h-[22px] px-2 rounded-[54px] bg-white/90 border border-[#E3E4E5] text-[10px] font-semibold text-[#22252B]">
                        <Star className="w-3.5 h-3.5 text-[#0047BB]" />
                        Destaque
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="text-[12px] font-semibold text-[#1E1B39] font-inter truncate">{c.title || 'Nome do curso'}</div>
                      <div className="mt-3 flex items-center justify-between text-[12px] text-[#737780]">
                        <div>Progresso</div>
                        <div className="text-[12px] font-bold text-[#0047BB]">{Math.max(0, Math.min(100, Number(c.progress || 0)))}%</div>
                      </div>
                      <div className="mt-2 h-1.5 w-full rounded-full bg-[#E3E4E5] overflow-hidden">
                        <div className="h-full bg-[#0047BB]" style={{ width: `${Math.max(0, Math.min(100, Number(c.progress || 0)))}%` }} />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function MyCoursesModal({ open, onClose, courses, onSelectCourse }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  const list = useMemo(() => {
    const q = String(query || '').trim().toLowerCase()
    const base = Array.isArray(courses) ? courses : []
    const filtered = base.filter((c) => {
      const p = Math.max(0, Math.min(100, Number(c?.progress || 0)))
      if (filter === 'not_started') return p <= 0
      if (filter === 'in_progress') return p > 0 && p < 100
      if (filter === 'completed') return p >= 100
      return true
    })
    if (!q) return filtered
    return filtered.filter((c) => String(c?.title || '').toLowerCase().includes(q))
  }, [courses, filter, query])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80]">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Fechar" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="absolute left-1/2 top-1/2 w-[calc(100%-24px)] max-w-[980px] -translate-x-1/2 -translate-y-1/2 rounded-[14px] bg-white border border-[#E3E4E5] shadow-xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-[#E3E4E5] flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-[#22252B] truncate">Meus cursos</div>
            <div className="text-[12px] text-[#737780]">Veja todos os seus cursos</div>
          </div>
          <button
            type="button"
            className="h-9 w-9 rounded-full border border-[#E3E4E5] bg-white flex items-center justify-center"
            aria-label="Fechar"
            onClick={onClose}
          >
            <X className="w-4 h-4 text-[#22252B]" />
          </button>
        </div>

        <div className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 w-full" style={{ height: '36px', padding: '0 12px', borderRadius: '8px', border: '1px solid rgb(227, 228, 229)', backgroundColor: 'rgb(249, 250, 251)' }}>
                <Search className="w-4 h-4 text-[#737780]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-[12px] text-[#22252B]"
                  placeholder="Buscar curso"
                />
              </div>
            </div>
            <div className="text-[12px] text-[#737780] whitespace-nowrap">{list.length}</div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {[
              { k: 'all', l: 'Todos' },
              { k: 'not_started', l: 'Não iniciado' },
              { k: 'in_progress', l: 'Em andamento' },
              { k: 'completed', l: 'Concluído' },
            ].map((it) => {
              const active = filter === it.k
              return (
                <button
                  key={it.k}
                  type="button"
                  onClick={() => setFilter(it.k)}
                  className={`h-7 px-3 rounded-full text-[11px] font-semibold border transition-colors ${active ? 'bg-[#0047BB] border-[#0047BB] text-white' : 'bg-white border-[#E3E4E5] text-[#22252B] hover:bg-[#F9FAFB]'}`}
                >
                  {it.l}
                </button>
              )
            })}
          </div>

          <div className="mt-4 max-h-[60vh] overflow-auto pr-1">
            {list.length === 0 ? (
              <div className="text-[12px] text-[#737780] py-10 text-center">Nenhum curso encontrado</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {list.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onSelectCourse?.(c)}
                    className="bg-white border border-[#E3E4E5] rounded-[12px] overflow-hidden w-full text-left hover:bg-[#F9FAFB] transition-colors"
                  >
                    <div className="relative h-[130px] w-full bg-[#EEF2FF]">
                      {c.cover ? (
                        <img src={c.cover} alt={c.title || 'Curso'} className="w-full h-full object-cover" />
                      ) : null}
                    </div>
                    <div className="p-4">
                      <div className="text-[12px] font-semibold text-[#1E1B39] font-inter truncate">{c.title || 'Nome do curso'}</div>
                      <div className="mt-3 flex items-center justify-between text-[12px] text-[#737780]">
                        <div>Progresso</div>
                        <div className="text-[12px] font-bold text-[#0047BB]">{Math.max(0, Math.min(100, Number(c.progress || 0)))}%</div>
                      </div>
                      <div className="mt-2 h-1.5 w-full rounded-full bg-[#E3E4E5] overflow-hidden">
                        <div className="h-full bg-[#0047BB]" style={{ width: `${Math.max(0, Math.min(100, Number(c.progress || 0)))}%` }} />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AlunoDashboardPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [student, setStudent] = useState(null)
  const [producerCourses, setProducerCourses] = useState([])
  const [producerSimulados, setProducerSimulados] = useState([])
  const [producerSimuladosLoading, setProducerSimuladosLoading] = useState(false)
  const [ownershipTick, setOwnershipTick] = useState(0)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [simuladosModalOpen, setSimuladosModalOpen] = useState(false)
  const [myCoursesModalOpen, setMyCoursesModalOpen] = useState(false)
  const [featuredModalOpen, setFeaturedModalOpen] = useState(false)
  const continueScrollRef = useRef(null)
  const [canScrollContinueLeft, setCanScrollContinueLeft] = useState(false)
  const [canScrollContinueRight, setCanScrollContinueRight] = useState(false)
  const myCoursesScrollRef = useRef(null)
  const [canScrollMyCoursesLeft, setCanScrollMyCoursesLeft] = useState(false)
  const [canScrollMyCoursesRight, setCanScrollMyCoursesRight] = useState(false)
  const featuredScrollRef = useRef(null)
  const [canScrollFeaturedLeft, setCanScrollFeaturedLeft] = useState(false)
  const [canScrollFeaturedRight, setCanScrollFeaturedRight] = useState(false)
  const courseIdCacheRef = useRef(new Map())
  const lessonThumbTickRef = useRef(0)
  const [lessonThumbTick, setLessonThumbTick] = useState(0)
  const lessonThumbCacheRef = useRef(new Map())
  const lessonThumbInFlightRef = useRef(new Set())
  const simuladosScrollRef = useRef(null)
  const [canScrollSimuladosLeft, setCanScrollSimuladosLeft] = useState(false)
  const [canScrollSimuladosRight, setCanScrollSimuladosRight] = useState(false)
  const [producerCoversByTitle, setProducerCoversByTitle] = useState({})
  const isDemoStudent = useMemo(() => {
    try {
      const host = String(window.location.hostname || '').toLowerCase()
      const allowed = host === 'localhost' || host === '127.0.0.1'
      if (!allowed) return false
      const params = new URLSearchParams(window.location.search || '')
      if (params.get('demo') === '1') return true
      return String(localStorage.getItem('connekt_demo_student') || '') === '1'
    } catch (_) {
      return false
    }
  }, [])

  useEffect(() => {
    const bump = () => setOwnershipTick((v) => v + 1)
    const onStorage = (e) => {
      const key = String(e?.key || '')
      if (
        key.startsWith('connekt_course_owned:') ||
        key.startsWith('connekt_simulado_owned:') ||
        key.startsWith('connekt_continue_course:') ||
        key === 'connekt_continue_updated_at'
      ) bump()
    }
    const onContinueUpdated = () => bump()
    window.addEventListener('storage', onStorage)
    window.addEventListener('connekt_continue_updated', onContinueUpdated)
    window.addEventListener('focus', bump)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('connekt_continue_updated', onContinueUpdated)
      window.removeEventListener('focus', bump)
    }
  }, [])

  const email = useMemo(() => String(user?.email || '').trim().toLowerCase(), [user?.email])
  const activeProducerUserId = useActiveProducerUserId()
  const loginMode = useMemo(() => {
    try {
      return String(sessionStorage.getItem('connekt_login_mode') || localStorage.getItem('connekt_login_mode') || '')
    } catch (_) {
      return ''
    }
  }, [])

  useEffect(() => {
    let active = true
    const run = async () => {
      const pid = String(activeProducerUserId || '').trim()
      if (pid) return
      if (isDemoStudent) return
      const uid = String(user?.id || '').trim()
      if (!uid) return
      const mode = String(loginMode || '').trim().toLowerCase()
      if (mode === 'aluno') return
      const path = String(window.location.pathname || '')
      if (!(path === '/aluno' || path.startsWith('/aluno/'))) return

      try {
        const { data, error } = await supabase
          .from('producers')
          .select('id')
          .or(`user_id.eq.${uid},id.eq.${uid},external_id.eq.${uid}`)
          .maybeSingle()
        if (!active) return
        if (error || !data?.id) return
        setActiveProducerUserId(uid)
      } catch (_) {}
    }
    run()
    return () => { active = false }
  }, [activeProducerUserId, isDemoStudent, user?.id, loginMode])

  const isBlockedRead = (e) => {
    const msg = String(e?.message || e || '').toLowerCase()
    const sc = String(e?.status || e?.statusCode || '')
    return sc === '401' || sc === '403' || msg.includes('row-level security') || msg.includes('permission denied') || msg.includes('not allowed')
  }

  const getAccessToken = async () => {
    try {
      const { data } = await supabase.auth.getSession()
      return data?.session?.access_token || ''
    } catch (_) {
      return ''
    }
  }

  useEffect(() => {
    let active = true
    const run = async () => {
      const pid = String(activeProducerUserId || '').trim()
      if (!pid || isDemoStudent) {
        if (active) setProducerCourses([])
        return
      }
      try {
        const { data, error } = await supabase
          .from('courses')
          .select('id,title,cover_image_url,promo_video_url,module_layout_image_url,modules,data,user_id,created_at,status')
          .eq('user_id', pid)
          .order('created_at', { ascending: false })
          .limit(200)
        if (!active) return
        if (error) throw error
        const list = Array.isArray(data) ? data : []
        if (list.length === 0) {
          try {
            const token = await getAccessToken()
            const r = await fetch(`/api/producer?type=courses&producerId=${encodeURIComponent(pid)}`, {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            })
            const body = await r.json().catch(() => ({}))
            if (!active) return
            if (r.ok && Array.isArray(body?.data) && body.data.length > 0) {
              setProducerCourses(body.data)
              return
            }
          } catch (_) {}
        }
        setProducerCourses(list)
      } catch (e) {
        if (!active) return
        if (!isBlockedRead(e)) {
          setProducerCourses([])
          return
        }
        try {
          const token = await getAccessToken()
          const r = await fetch(`/api/producer?type=courses&producerId=${encodeURIComponent(pid)}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          })
          const body = await r.json().catch(() => ({}))
          if (!active) return
          if (!r.ok) {
            setProducerCourses([])
            return
          }
          setProducerCourses(Array.isArray(body?.data) ? body.data : [])
        } catch (_) {
          if (!active) return
          setProducerCourses([])
        }
      }
    }
    run()
    return () => { active = false }
  }, [activeProducerUserId, isDemoStudent])

  useEffect(() => {
    let active = true
    const run = async () => {
      const pid = String(activeProducerUserId || '').trim()
      if (!pid || isDemoStudent) {
        if (active) setProducerSimulados([])
        return
      }
      setProducerSimuladosLoading(true)
      try {
        const { data, error } = await supabase
          .from('simulados')
          .select('id,title,is_paid,price,created_at,user_id')
          .eq('user_id', pid)
          .order('created_at', { ascending: false })
          .limit(200)
        if (!active) return
        if (error) throw error
        const list = Array.isArray(data) ? data : []
        if (list.length === 0) {
          try {
            const token = await getAccessToken()
            const r = await fetch(`/api/producer?type=simulados&producerId=${encodeURIComponent(pid)}`, {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            })
            const body = await r.json().catch(() => ({}))
            if (!active) return
            if (r.ok && Array.isArray(body?.data) && body.data.length > 0) {
              setProducerSimulados(body.data)
            } else {
              setProducerSimulados(list)
            }
          } catch (_) {
            if (!active) return
            setProducerSimulados(list)
          }
        } else {
          setProducerSimulados(list)
        }
      } catch (e) {
        if (!active) return
        if (!isBlockedRead(e)) {
          setProducerSimulados([])
          return
        }
        try {
          const token = await getAccessToken()
          const r = await fetch(`/api/producer?type=simulados&producerId=${encodeURIComponent(pid)}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          })
          const body = await r.json().catch(() => ({}))
          if (!active) return
          if (!r.ok) {
            setProducerSimulados([])
            return
          }
          setProducerSimulados(Array.isArray(body?.data) ? body.data : [])
        } catch (_) {
          if (!active) return
          setProducerSimulados([])
        }
      } finally {
        if (active) setProducerSimuladosLoading(false)
      }
    }
    run()
    return () => { active = false }
  }, [activeProducerUserId, isDemoStudent])

  const resolveCourseIdByTitle = async (title) => {
    const key = String(title || '').trim().toLowerCase()
    if (!key) return null

    const cache = courseIdCacheRef.current
    if (cache.has(key)) return cache.get(key)

    let foundId = null
    try {
      let q = supabase.from('courses').select('id,title').eq('title', String(title || '')).limit(1)
      if (activeProducerUserId) q = q.eq('user_id', activeProducerUserId)
      const { data, error } = await q
      if (!error && Array.isArray(data) && data[0]?.id) foundId = data[0].id
    } catch (_) {}

    if (!foundId) {
      try {
        let q = supabase.from('courses').select('id,title').ilike('title', String(title || '')).limit(1)
        if (activeProducerUserId) q = q.eq('user_id', activeProducerUserId)
        const { data, error } = await q
        if (!error && Array.isArray(data) && data[0]?.id) foundId = data[0].id
      } catch (_) {}
    }

    cache.set(key, foundId)
    return foundId
  }

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!user?.id && isDemoStudent) {
        setLoading(false)
        setStudent({
          id: 'demo',
          name: 'Aluno Demo',
          email: 'demo@connektco.com',
          avatar_url: null,
          courses: [
            { course_name: 'Cardiologia', progress: 62, cover_image_url: '/Preview.png' },
            { course_name: 'Cardiologia', progress: 62, cover_image_url: '/Preview.png' },
            { course_name: 'Cardiologia', progress: 62, cover_image_url: '/Preview.png' },
            { course_name: 'Nome do curso', progress: 0, cover_image_url: '/Preview.png' },
          ],
        })
        return
      }
      if (!user?.id) return
      setLoading(true)
      setStudent(null)
      try {
        const attempts = [
          () =>
            supabase
              .from('students')
              .select('id,name,email,avatar_url,courses:student_courses(course_name,progress,tag,cover_image_url)')
              .eq('email', email)
              .maybeSingle(),
          () =>
            supabase
              .from('students')
              .select('id,name,email,avatar_url,courses:student_courses(course_name,progress,tag,cover_image_url)')
              .eq('user_id', user.id)
              .maybeSingle(),
        ]
        let found = null
        for (const fn of attempts) {
          const { data } = await fn()
          if (data) {
            found = data
            break
          }
        }
        if (cancelled) return
        setStudent(found)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [user?.id, email, isDemoStudent])

  useEffect(() => {
    let active = true
    const run = async () => {
      if (isDemoStudent) return
      if (!user?.id) return
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('type,entity_type,entity_id,data,created_at')
          .eq('type', 'purchase_confirmed')
          .order('created_at', { ascending: false })
          .limit(500)
        if (!active) return
        if (error) throw error
        const isExpired = (expiresAtIso) => {
          const v = String(expiresAtIso || '').trim()
          if (!v) return false
          const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/)
          if (!m) return false
          const endMs = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999)
          return Date.now() > endMs
        }
        for (const row of Array.isArray(data) ? data : []) {
          const entityType = String(row?.entity_type || '').trim().toLowerCase()
          const entityId = String(row?.entity_id || '').trim()
          const dataObj = row?.data && typeof row.data === 'object' ? row.data : null
          const dataType = String(dataObj?.type || '').trim().toLowerCase()
          const expiresAt = String(dataObj?.expires_at || dataObj?.expiresAt || '').trim()
          const expired = expiresAt ? isExpired(expiresAt) : false
          if (entityType === 'course' || dataType === 'course') {
            const cid = entityId || String(dataObj?.courseId || dataObj?.course_id || '').trim()
            if (cid) {
              try {
                if (expired) localStorage.removeItem(`connekt_course_owned:${cid}`)
                else localStorage.setItem(`connekt_course_owned:${cid}`, '1')
              } catch (_) {}
            }
          }
          if (entityType === 'module' || dataType === 'module') {
            const cid = String(dataObj?.courseId || dataObj?.course_id || '').trim()
            const mid = entityId || String(dataObj?.moduleId || dataObj?.module_id || '').trim()
            if (cid && mid) {
              try {
                if (expired) localStorage.removeItem(`connekt_module_owned:${cid}:${mid}`)
                else localStorage.setItem(`connekt_module_owned:${cid}:${mid}`, '1')
              } catch (_) {}
            }
          }
          if (entityType === 'simulado' || dataType === 'simulado') {
            const sid = entityId || String(dataObj?.simId || dataObj?.sim_id || '').trim()
            if (sid) {
              try {
                if (expired) localStorage.removeItem(`connekt_simulado_owned:${sid}`)
                else localStorage.setItem(`connekt_simulado_owned:${sid}`, '1')
              } catch (_) {}
            }
          }
        }
        setOwnershipTick((v) => v + 1)
      } catch (_) {}
    }
    run()
    return () => { active = false }
  }, [user?.id, isDemoStudent])

  const updateContinueScrollState = () => {
    const el = continueScrollRef.current
    if (!el) return
    const left = el.scrollLeft || 0
    const maxLeft = Math.max(0, (el.scrollWidth || 0) - (el.clientWidth || 0))
    setCanScrollContinueLeft(left > 2)
    setCanScrollContinueRight(left < maxLeft - 2)
  }

  const updateMyCoursesScrollState = () => {
    const el = myCoursesScrollRef.current
    if (!el) return
    const left = el.scrollLeft || 0
    const maxLeft = Math.max(0, (el.scrollWidth || 0) - (el.clientWidth || 0))
    setCanScrollMyCoursesLeft(left > 2)
    setCanScrollMyCoursesRight(left < maxLeft - 2)
  }

  const updateFeaturedScrollState = () => {
    const el = featuredScrollRef.current
    if (!el) return
    const left = el.scrollLeft || 0
    const maxLeft = Math.max(0, (el.scrollWidth || 0) - (el.clientWidth || 0))
    setCanScrollFeaturedLeft(left > 2)
    setCanScrollFeaturedRight(left < maxLeft - 2)
  }

  const updateSimuladosScrollState = () => {
    const el = simuladosScrollRef.current
    if (!el) return
    const left = el.scrollLeft || 0
    const maxLeft = Math.max(0, (el.scrollWidth || 0) - (el.clientWidth || 0))
    setCanScrollSimuladosLeft(left > 2)
    setCanScrollSimuladosRight(left < maxLeft - 2)
  }

  useEffect(() => {
    updateContinueScrollState()
    updateMyCoursesScrollState()
    updateFeaturedScrollState()
    updateSimuladosScrollState()
    const onResize = () => {
      updateContinueScrollState()
      updateMyCoursesScrollState()
      updateFeaturedScrollState()
      updateSimuladosScrollState()
    }
    window.addEventListener('resize', onResize)
    const t = window.setTimeout(() => {
      updateContinueScrollState()
      updateMyCoursesScrollState()
      updateFeaturedScrollState()
      updateSimuladosScrollState()
    }, 0)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('resize', onResize)
    }
  }, [student, loading])

  const scrollContinueBy = (dir) => {
    const el = continueScrollRef.current
    if (!el) return
    const amount = 340
    const delta = dir * amount
    const nextLeft = Math.max(0, Math.round((el.scrollLeft || 0) + delta))
    try {
      if (typeof el.scrollTo === 'function') {
        el.scrollTo({ left: nextLeft, behavior: 'smooth' })
      } else if (typeof el.scrollBy === 'function') {
        el.scrollBy({ left: delta, behavior: 'smooth' })
      } else {
        el.scrollLeft = nextLeft
      }
    } catch (_) {
      try { el.scrollLeft = nextLeft } catch (_) {}
    }
    window.setTimeout(updateContinueScrollState, 150)
  }

  const scrollMyCoursesBy = (dir) => {
    const el = myCoursesScrollRef.current
    if (!el) return
    const amount = 220
    const delta = dir * amount
    const nextLeft = Math.max(0, Math.round((el.scrollLeft || 0) + delta))
    try {
      if (typeof el.scrollTo === 'function') {
        el.scrollTo({ left: nextLeft, behavior: 'smooth' })
      } else if (typeof el.scrollBy === 'function') {
        el.scrollBy({ left: delta, behavior: 'smooth' })
      } else {
        el.scrollLeft = nextLeft
      }
    } catch (_) {
      try { el.scrollLeft = nextLeft } catch (_) {}
    }
    window.setTimeout(updateMyCoursesScrollState, 150)
  }

  const scrollFeaturedBy = (dir) => {
    const el = featuredScrollRef.current
    if (!el) return
    const amount = 220
    const delta = dir * amount
    const nextLeft = Math.max(0, Math.round((el.scrollLeft || 0) + delta))
    try {
      if (typeof el.scrollTo === 'function') {
        el.scrollTo({ left: nextLeft, behavior: 'smooth' })
      } else if (typeof el.scrollBy === 'function') {
        el.scrollBy({ left: delta, behavior: 'smooth' })
      } else {
        el.scrollLeft = nextLeft
      }
    } catch (_) {
      try { el.scrollLeft = nextLeft } catch (_) {}
    }
    window.setTimeout(updateFeaturedScrollState, 150)
  }

  const scrollSimuladosBy = (dir) => {
    const el = simuladosScrollRef.current
    if (!el) return
    const amount = 360
    const delta = dir * amount
    const nextLeft = Math.max(0, Math.round((el.scrollLeft || 0) + delta))
    try {
      if (typeof el.scrollTo === 'function') {
        el.scrollTo({ left: nextLeft, behavior: 'smooth' })
      } else if (typeof el.scrollBy === 'function') {
        el.scrollBy({ left: delta, behavior: 'smooth' })
      } else {
        el.scrollLeft = nextLeft
      }
    } catch (_) {
      try { el.scrollLeft = nextLeft } catch (_) {}
    }
    window.setTimeout(updateSimuladosScrollState, 150)
  }

  const toPublicCoursesMediaUrl = (value) => {
    const raw = value == null ? '' : String(value)
    if (!raw) return null
    if (raw.startsWith('data:')) return raw
    const marker = '/storage/v1/object/sign/courses-media/'
    const idx = raw.indexOf(marker)
    if (idx >= 0) {
      const withoutQuery = raw.split('?')[0] || ''
      const path = withoutQuery.slice(idx + marker.length)
      const { data } = supabase.storage.from('courses-media').getPublicUrl(path)
      return data?.publicUrl || null
    }
    return raw
  }

  const getLessonCoverForKey = (k) => {
    const key = String(k || '').trim()
    if (!key) return ''
    return lessonThumbCacheRef.current.get(key) || ''
  }

  const ensureLessonCover = async (k, coverCandidate, playableUrl) => {
    const key = String(k || '').trim()
    if (!key) return
    const normalizedCandidate = (() => {
      const raw = String(coverCandidate || '').trim()
      if (!raw) return ''
      const lower = raw.toLowerCase()
      if (lower.endsWith('/preview.png') || lower.includes('/preview.png?') || lower === 'preview.png') return ''
      return raw
    })()
    if (isNonEmptyString(normalizedCandidate)) {
      if (!lessonThumbCacheRef.current.get(key)) {
        lessonThumbCacheRef.current.set(key, String(normalizedCandidate))
        lessonThumbTickRef.current += 1
        setLessonThumbTick(lessonThumbTickRef.current)
      }
      return
    }
    if (!isNonEmptyString(playableUrl)) return
    if (lessonThumbCacheRef.current.get(key)) return
    if (lessonThumbInFlightRef.current.has(key)) return
    lessonThumbInFlightRef.current.add(key)
    const dataUrl = await captureVideoFrameDataUrl(playableUrl, 0.35)
    lessonThumbInFlightRef.current.delete(key)
    if (!dataUrl) return
    lessonThumbCacheRef.current.set(key, dataUrl)
    lessonThumbTickRef.current += 1
    setLessonThumbTick(lessonThumbTickRef.current)
  }

  const mergeMeta = (row) => {
    let dataMeta = null
    try { dataMeta = typeof row?.data === 'string' ? JSON.parse(row.data) : row?.data || null } catch (_) {}
    let modulesMeta = null
    if (row?.modules) {
      try {
        const parsed = typeof row.modules === 'string' ? JSON.parse(row.modules) : row.modules
        modulesMeta = parsed && typeof parsed === 'object' ? (parsed.meta || null) : null
      } catch (_) {}
    }
    return { ...(modulesMeta || {}), ...(dataMeta || {}) }
  }

  const deriveCourseCoverUrl = (row) => {
    const meta = mergeMeta(row)
    let cover =
      row?.cover_image_url ||
      meta?.cover_image_url ||
      meta?.coverImageUrl ||
      meta?.cover_url ||
      meta?.coverUrl ||
      null
    cover = toPublicCoursesMediaUrl(cover) || cover
    const coverPath =
      meta?.cover_image_path ||
      meta?.coverImagePath ||
      meta?.cover_path ||
      meta?.coverPath ||
      null
    if (!cover && coverPath) {
      const { data } = supabase.storage.from('courses-media').getPublicUrl(String(coverPath))
      return data?.publicUrl || null
    }
    return cover
  }

  useEffect(() => {
    let active = true
    const run = async () => {
      try {
        let q = supabase
          .from('courses')
          .select('id,title,cover_image_url,data,modules,module_layout_image_url,user_id')
          .limit(200)
        if (activeProducerUserId) q = q.eq('user_id', activeProducerUserId)
        const { data, error } = await q
        const list = !error && Array.isArray(data) ? data : []
        let rows = list
        if (rows.length === 0 && activeProducerUserId) {
          try {
            const token = await getAccessToken()
            const r = await fetch(`/api/producer?type=courses&producerId=${encodeURIComponent(String(activeProducerUserId))}`, {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            })
            const body = await r.json().catch(() => ({}))
            if (active && r.ok && Array.isArray(body?.data) && body.data.length > 0) rows = body.data
          } catch (_) {}
        }
        const map = {}
        for (const row of Array.isArray(rows) ? rows : []) {
          const t = String(row?.title || '').trim().toLowerCase()
          if (!t) continue
          const url = deriveCourseCoverUrl(row)
          if (url) map[t] = url
        }
        if (active) setProducerCoversByTitle(map)
      } catch (_) {}
    }
    run()
    return () => { active = false }
  }, [activeProducerUserId])

  const connektCourseCoverOptions = useMemo(() => {
    const svgToDataUrl = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    const base = (opts) =>
      svgToDataUrl(`
        <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600" viewBox="0 0 1200 600">
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="${opts.a}"/>
              <stop offset="0.55" stop-color="${opts.b}"/>
              <stop offset="1" stop-color="${opts.c}"/>
            </linearGradient>
            <radialGradient id="r" cx="0.2" cy="0.25" r="0.9">
              <stop offset="0" stop-color="#ffffff" stop-opacity="0.22"/>
              <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
            </radialGradient>
          </defs>
          <rect width="1200" height="600" fill="url(#g)"/>
          <rect width="1200" height="600" fill="url(#r)"/>
          <g opacity="0.16" fill="#fff">
            <circle cx="140" cy="120" r="82"/>
            <circle cx="310" cy="270" r="52"/>
            <circle cx="980" cy="130" r="110"/>
            <circle cx="1030" cy="390" r="75"/>
            <circle cx="760" cy="480" r="46"/>
          </g>
          <g opacity="0.22" stroke="#fff" stroke-width="18" fill="none" stroke-linecap="round" stroke-linejoin="round">
            ${opts.icon}
          </g>
        </svg>
      `)
    return [
      { id: 'med-1', label: 'Cardiologia', src: base({ a: '#0EA5E9', b: '#1D4ED8', c: '#0F172A', icon: '<path d="M280 350c80-120 160 20 240-90 70-95 185-40 190 55 4 78-65 145-150 200-85-55-170-120-210-165-35-41-55-84-70-100z"/>' }) },
      { id: 'med-2', label: 'Neurologia', src: base({ a: '#7C3AED', b: '#2563EB', c: '#0F172A', icon: '<path d="M420 360c0-85 70-155 155-155 95 0 175 80 175 175 0 70-45 130-110 160"/><path d="M520 250c20 25 20 55 0 80"/><path d="M610 230c25 35 25 75 0 110"/><path d="M700 250c20 25 20 55 0 80"/>' }) },
      { id: 'med-3', label: 'Radiologia', src: base({ a: '#06B6D4', b: '#0EA5E9', c: '#0B1220', icon: '<rect x="410" y="210" width="380" height="250" rx="22"/><path d="M520 280h160"/><path d="M600 250v220"/><circle cx="520" cy="360" r="32"/><circle cx="680" cy="360" r="32"/>' }) },
      { id: 'med-4', label: 'Emergência', src: base({ a: '#EF4444', b: '#F97316', c: '#111827', icon: '<path d="M560 230h80v80h80v80h-80v80h-80v-80h-80v-80h80z"/>' }) },
      { id: 'med-5', label: 'Pediatria', src: base({ a: '#22C55E', b: '#0EA5E9', c: '#0F172A', icon: '<path d="M520 430c35 35 125 35 160 0"/><circle cx="560" cy="320" r="18"/><circle cx="680" cy="320" r="18"/><path d="M600 210c-60 0-110 50-110 110 0 35 18 68 45 88"/><path d="M600 210c60 0 110 50 110 110 0 35-18 68-45 88"/>' }) },
      { id: 'med-6', label: 'Ortopedia', src: base({ a: '#64748B', b: '#334155', c: '#0F172A', icon: '<path d="M520 220c35-15 70 15 55 50l-28 66c-10 24 6 52 32 52h42c26 0 42 28 32 52l-20 48c-10 24-38 40-62 34"/><path d="M670 220c-35-15-70 15-55 50l28 66c10 24-6 52-32 52h-42c-26 0-42 28-32 52l20 48c10 24 38 40 62 34"/>' }) },
      { id: 'med-7', label: 'Cirurgia', src: base({ a: '#14B8A6', b: '#0EA5E9', c: '#0B1220', icon: '<path d="M520 250l160 160"/><path d="M680 250L520 410"/><path d="M500 230l-60-60"/><path d="M700 230l60-60"/>' }) },
      { id: 'med-8', label: 'Dermatologia', src: base({ a: '#F59E0B', b: '#EF4444', c: '#0F172A', icon: '<path d="M600 210c70 60 130 140 130 220 0 85-60 140-130 140s-130-55-130-140c0-80 60-160 130-220z"/><path d="M600 330c0 40 30 70 70 70"/>' }) },
      { id: 'med-9', label: 'Farmacologia', src: base({ a: '#A78BFA', b: '#38BDF8', c: '#0B1220', icon: '<path d="M520 260l160 160"/><path d="M560 220l-40 40"/><path d="M720 380l-40 40"/><rect x="470" y="310" width="260" height="120" rx="60"/><path d="M600 310v120"/>' }) },
      { id: 'med-10', label: 'Odontologia', src: base({ a: '#60A5FA', b: '#22C55E', c: '#0F172A', icon: '<path d="M520 230c-40 30-50 95-30 150 25 70 10 160 60 160 25 0 30-55 50-55s25 55 50 55c50 0 35-90 60-160 20-55 10-120-30-150-25-20-60-10-80 10-20-20-55-30-80-10z"/>' }) },
    ]
  }, [])

  const courses = useMemo(() => {
    if (activeProducerUserId) {
      const list = Array.isArray(producerCourses) ? producerCourses : []
      const out = []
      const seen = new Set()
      for (const row of list) {
        const cid = String(row?.id || '').trim()
        if (!cid || seen.has(cid)) continue
        seen.add(cid)
        out.push({
        course_id: row?.id || null,
        courseId: row?.id || null,
        course_name: row?.title || 'Curso',
        cover_image_url: deriveCourseCoverUrl(row) || null,
        progress: 0,
        courseRow: row,
        isPaid: resolveCoursePriceNumber(row) > 0 || isPaidCourseFromMeta(row),
        isOwned: (() => {
          const cid = String(row?.id || '').trim()
          if (!cid) return false
          if (isDemoStudent) return true
          const isPaid = resolveCoursePriceNumber(row) > 0 || isPaidCourseFromMeta(row)
          if (!isPaid) return true
          return safeLsGet(`connekt_course_owned:${cid}`) === '1'
        })(),
        })
      }
      return out
    }
    return (Array.isArray(student?.courses) ? student.courses : []).map((c) => ({
      ...c,
      isPaid: false,
      isOwned: true,
    }))
  }, [activeProducerUserId, isDemoStudent, producerCourses, student?.courses])
  const name = student?.name || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'Aluno'
  const coverFallback = connektCourseCoverOptions[0]?.src || '/Preview.png'
  const pickCoverForCourse = (titleValue, idx) => {
    const options = connektCourseCoverOptions
    if (!Array.isArray(options) || options.length === 0) return coverFallback
    const t = String(titleValue || '').trim()
    let hash = 0
    for (let i = 0; i < t.length; i += 1) hash = (hash * 31 + t.charCodeAt(i)) >>> 0
    const pos = (hash + Number(idx || 0)) % options.length
    return options[pos]?.src || coverFallback
  }

  const continueItems = useMemo(() => {
    const allowed = courses.filter((c) => !c?.isPaid || !!c?.isOwned)
    const list = allowed.slice(0, 6).map((c, idx) => {
      const cid = String(c?.course_id || c?.courseId || c?.id || '').trim()
      const continueRaw = cid ? safeLsGet(`connekt_continue_course:${cid}`) : ''
      const continueInfo = continueRaw ? safeJsonParse(continueRaw) : null
      const info = c?.courseRow ? getContinueLessonInfo(c.courseRow, continueInfo, toPublicCoursesMediaUrl) : null
      const thumbKey = `continue:${cid || `idx:${idx}`}:${String(info?.moduleId || '').trim()}:${String(info?.lessonId || '').trim()}`
      return {
        id: `${c?.course_name || 'curso'}-${idx}`,
        courseId: c?.course_id || c?.courseId || c?.id || null,
        courseTitle: c?.course_name || '',
        category: c?.course_name || 'Cardiologia',
        title: info?.title || 'Aula',
        moduleId: info?.moduleId || '',
        lessonId: info?.lessonId || '',
        thumbKey,
        coverCandidate: info?.coverCandidate || '',
        playableVideoUrl: info?.playableVideoUrl || '',
        cover: (() => {
          const t = String(c?.course_name || '').trim().toLowerCase()
          return (
            getLessonCoverForKey(thumbKey) ||
            (info?.coverCandidate ? String(info.coverCandidate) : '') ||
            producerCoversByTitle[t] ||
            c?.cover_image_url ||
            coverFallback
          )
        })(),
        progress: c?.progress || 0,
        lessonsDone: 0,
        lessonsTotal: info?.lessonsTotal || null,
      }
    })
    if (list.length > 0) return list
    const fromStorage = (() => {
      try {
        const keys = Object.keys(localStorage || {})
        const ids = keys
          .filter((k) => String(k || '').startsWith('connekt_continue_course:'))
          .map((k) => String(k).slice('connekt_continue_course:'.length).trim())
          .filter(Boolean)
        return Array.from(new Set(ids)).slice(0, 6)
      } catch (_) {
        return []
      }
    })()
    if (fromStorage.length > 0) {
      return fromStorage.map((cid, idx) => {
        const continueRaw = safeLsGet(`connekt_continue_course:${cid}`)
        const continueInfo = continueRaw ? safeJsonParse(continueRaw) : null
        const courseMatch = allowed.find((c) => String(c?.course_id || c?.courseId || c?.id || '').trim() === cid) || null
        const info = courseMatch?.courseRow ? getContinueLessonInfo(courseMatch.courseRow, continueInfo, toPublicCoursesMediaUrl) : null
        const thumbKey = `continue:${cid || `idx:${idx}`}:${String(info?.moduleId || continueInfo?.moduleId || '').trim()}:${String(info?.lessonId || continueInfo?.lessonId || '').trim()}`
        const courseTitle = courseMatch?.course_name || courseMatch?.courseTitle || 'Curso'
        const t = String(courseTitle || '').trim().toLowerCase()
        return {
          id: `continue-storage-${cid}-${idx}`,
          courseId: cid,
          courseTitle,
          category: courseTitle,
          title: info?.title || 'Aula',
          moduleId: String(info?.moduleId || continueInfo?.moduleId || ''),
          lessonId: String(info?.lessonId || continueInfo?.lessonId || ''),
          thumbKey,
          coverCandidate: info?.coverCandidate || '',
          playableVideoUrl: info?.playableVideoUrl || '',
          cover: getLessonCoverForKey(thumbKey) || producerCoversByTitle[t] || courseMatch?.cover_image_url || coverFallback,
          progress: courseMatch?.progress || 0,
          lessonsDone: 0,
          lessonsTotal: info?.lessonsTotal || null,
        }
      })
    }
    if (activeProducerUserId) return []
    return [
      { id: 'c1', courseId: null, courseTitle: 'Cardiologia', category: 'Cardiologia', title: 'Nome da aula aqui....', cover: coverFallback, progress: 67, lessonsDone: 20, lessonsTotal: 45 },
      { id: 'c2', courseId: null, courseTitle: 'Cardiologia', category: 'Cardiologia', title: 'Nome da aula aqui....', cover: coverFallback, progress: 67, lessonsDone: 20, lessonsTotal: 45 },
      { id: 'c3', courseId: null, courseTitle: 'Cardiologia', category: 'Cardiologia', title: 'Nome da aula aqui....', cover: coverFallback, progress: 67, lessonsDone: 20, lessonsTotal: 45 },
    ]
  }, [activeProducerUserId, courses, coverFallback, producerCoversByTitle, lessonThumbTick, ownershipTick])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      for (const item of Array.isArray(continueItems) ? continueItems : []) {
        if (cancelled) return
        await ensureLessonCover(item?.thumbKey, item?.coverCandidate, item?.playableVideoUrl)
      }
    })()
    return () => { cancelled = true }
  }, [continueItems])

  const myCoursesAll = useMemo(() => {
    const list = courses
      .filter((c) => !c?.isPaid || !!c?.isOwned)
      .map((c, idx) => ({
        id: `all-${c?.course_name || 'curso'}-${idx}`,
        courseId: c?.course_id || c?.courseId || c?.id || null,
        title: c?.course_name || 'Nome do curso',
        cover: (() => {
          const t = String(c?.course_name || '').trim().toLowerCase()
          return producerCoversByTitle[t] || c?.cover_image_url || pickCoverForCourse(c?.course_name || 'Nome do curso', idx)
        })(),
        progress: c?.progress || 0,
      }))
    if (list.length > 0) return list
    if (activeProducerUserId) return []
    return [
      { id: 'm1', title: 'Nome do curso', cover: pickCoverForCourse('Nome do curso', 0), progress: 0 },
      { id: 'm2', title: 'Nome do curso', cover: pickCoverForCourse('Nome do curso', 1), progress: 0 },
      { id: 'm3', title: 'Nome do curso', cover: pickCoverForCourse('Nome do curso', 2), progress: 0 },
      { id: 'm4', title: 'Nome do curso', cover: pickCoverForCourse('Nome do curso', 3), progress: 0 },
    ]
  }, [activeProducerUserId, courses, coverFallback, connektCourseCoverOptions, producerCoversByTitle])

  const myCourses = useMemo(() => {
    return (Array.isArray(myCoursesAll) ? myCoursesAll : []).slice(0, 8)
  }, [myCoursesAll])

  const featuredCourses = useMemo(() => {
    const base = courses
      .filter((c) => !!c?.isPaid && !c?.isOwned)
      .slice(0, 6)
      .map((c, idx) => ({
        id: `blocked-${c?.course_name || 'curso'}-${idx}`,
        courseId: c?.course_id || c?.courseId || c?.id || null,
        title: c?.course_name || 'Nome do curso',
        cover: (() => {
          const t = String(c?.course_name || '').trim().toLowerCase()
          return producerCoversByTitle[t] || c?.cover_image_url || pickCoverForCourse(c?.course_name || 'Nome do curso', idx + 10)
        })(),
        progress: c?.progress || 0,
      }))
    if (base.length > 0) return base
    if (activeProducerUserId) return []
    return [
      { id: 'f1', title: 'Nome do curso', cover: pickCoverForCourse('Nome do curso', 10), progress: 0 },
      { id: 'f2', title: 'Nome do curso', cover: pickCoverForCourse('Nome do curso', 11), progress: 0 },
      { id: 'f3', title: 'Nome do curso', cover: pickCoverForCourse('Nome do curso', 12), progress: 0 },
      { id: 'f4', title: 'Nome do curso', cover: pickCoverForCourse('Nome do curso', 13), progress: 0 },
    ]
  }, [activeProducerUserId, courses, producerCoversByTitle, coverFallback, connektCourseCoverOptions])

  const featuredCoursesAll = useMemo(() => {
    const list = courses
      .filter((c) => !!c?.isPaid && !c?.isOwned)
      .map((c, idx) => ({
        id: `blocked-all-${c?.course_name || 'curso'}-${idx}`,
        courseId: c?.course_id || c?.courseId || c?.id || null,
        title: c?.course_name || 'Nome do curso',
        cover: (() => {
          const t = String(c?.course_name || '').trim().toLowerCase()
          return producerCoversByTitle[t] || c?.cover_image_url || pickCoverForCourse(c?.course_name || 'Nome do curso', idx + 10)
        })(),
        progress: c?.progress || 0,
      }))
    if (list.length > 0) return list
    if (activeProducerUserId) return []
    return featuredCourses
  }, [activeProducerUserId, courses, featuredCourses, producerCoversByTitle, coverFallback, connektCourseCoverOptions])

  const simulados = useMemo(() => {
    if (producerSimuladosLoading) return []
    if (activeProducerUserId && Array.isArray(producerSimulados)) {
      return producerSimulados.slice(0, 6).map((s) => ({
        ...s,
        progress: 0,
      }))
    }
    return [
      { id: 's1', title: 'Nome do simulado', progress: 60, is_paid: false, price: 0 },
      { id: 's2', title: 'Nome do simulado', progress: 60, is_paid: true, price: 49.9 },
      { id: 's3', title: 'Nome do simulado', progress: 60, is_paid: false, price: 0 },
      { id: 's4', title: 'Nome do simulado', progress: 60, is_paid: true, price: 29.9 },
    ]
  }, [activeProducerUserId, producerSimulados, producerSimuladosLoading])

  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/aluno'

  useEffect(() => {
    if (!mobileNavOpen && !simuladosModalOpen && !myCoursesModalOpen && !featuredModalOpen) return
    const prev = document?.body?.style?.overflow
    if (document?.body?.style) document.body.style.overflow = 'hidden'
    return () => {
      if (document?.body?.style) document.body.style.overflow = prev || ''
    }
  }, [mobileNavOpen, simuladosModalOpen, myCoursesModalOpen, featuredModalOpen])

  return (
    <div className="min-h-screen lg:h-screen w-full bg-[#EEF2FF] flex lg:overflow-hidden">
      {mobileNavOpen ? (
        <div className="lg:hidden fixed inset-0 z-[70]">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Fechar menu"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-[280px] max-w-[86vw] flex flex-col" style={{ background: 'linear-gradient(180deg, var(--brand-sidebar-from) 0%, var(--brand-sidebar-to) 100%)' }}>
            <div className="flex items-center justify-between px-4 py-5">
              <BrandLogo variant="sidebar" className="w-[110px] h-auto" />
              <button
                type="button"
                className="h-10 w-10 rounded-full bg-white/10 text-white flex items-center justify-center"
                aria-label="Fechar"
                onClick={() => setMobileNavOpen(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="h-px mx-6" style={{ backgroundColor: 'rgb(47, 58, 86)' }} />
            <nav className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
              {ALUNO_NAV_SECTIONS.map((section, idx) => (
                <div key={`${section.title}-${idx}`}>
                  <div className="text-[11px] font-semibold text-white/50 uppercase tracking-wider px-2 mb-3">
                    {section.title}
                  </div>
                  <div className="space-y-1">
                    {section.items.map((item) => {
                      const itemPathname = String(item.path || '').split('?')[0] || '/'
                      const isActive = itemPathname === '/aluno'
                        ? (currentPath === '/aluno' || currentPath.startsWith('/aluno/aula') || currentPath.startsWith('/aluno/curso'))
                        : (itemPathname === '/aluno/simulados' ? currentPath.startsWith('/aluno/simulados') || currentPath === '/aluno/reposta-correta-simulado' : currentPath === itemPathname)
                      return (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => {
                            setMobileNavOpen(false)
                            navigateTo(item.path)
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[13px] font-semibold transition-colors ${
                            isActive ? 'brand-bg text-white' : 'text-white/80 hover:bg-white/10'
                          }`}
                        >
                          <item.Icon className="w-5 h-5" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </div>
        </div>
      ) : null}
      <ProducerSimuladosModal
        open={simuladosModalOpen}
        onClose={() => setSimuladosModalOpen(false)}
        simulados={simulados}
        ownershipTick={ownershipTick}
        onSelectSimulado={(s) => {
          setSimuladosModalOpen(false)
          const demoSuffix = isDemoStudent ? '&demo=1' : ''
          navigateTo(`/aluno/simulados/acesso?simId=${encodeURIComponent(String(s.id))}${demoSuffix}`)
        }}
      />

      <MyCoursesModal
        open={myCoursesModalOpen}
        onClose={() => setMyCoursesModalOpen(false)}
        courses={myCoursesAll}
        onSelectCourse={async (c) => {
          setMyCoursesModalOpen(false)
          let cid = c?.courseId || null
          if (!cid) cid = isDemoStudent ? 'demo' : await resolveCourseIdByTitle(c?.title)
          if (!cid) return
          const base = `/aluno/curso/${encodeURIComponent(String(cid))}`
          navigateTo(isDemoStudent ? `${base}?demo=1` : base)
        }}
      />

      <FeaturedCoursesModal
        open={featuredModalOpen}
        onClose={() => setFeaturedModalOpen(false)}
        courses={featuredCoursesAll}
        ownershipTick={ownershipTick}
        onSelectCourse={async (c) => {
          setFeaturedModalOpen(false)
          let cid = c?.courseId || null
          if (!cid) cid = isDemoStudent ? 'demo' : await resolveCourseIdByTitle(c?.title)
          if (!cid) return
          const base = `/aluno/curso/${encodeURIComponent(String(cid))}`
          navigateTo(isDemoStudent ? `${base}?demo=1` : base)
        }}
      />

      <aside
        className="hidden lg:flex w-[260px] h-screen flex-col"
        style={{ background: 'linear-gradient(180deg, var(--brand-sidebar-from) 0%, var(--brand-sidebar-to) 100%)' }}
      >
        <div className="flex justify-center py-5">
          <BrandLogo variant="sidebar" className="w-[119px] h-[35px]" />
        </div>
        <div
          className="h-px mx-10"
          style={{
            backgroundColor: 'rgb(47, 58, 86)',
          }}
        />
        <nav className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
          {ALUNO_NAV_SECTIONS.map((section, idx) => (
            <div key={`${section.title}-${idx}`}>
              <div className="text-[11px] font-semibold text-white/50 uppercase tracking-wider px-2 mb-3">
                {section.title}
              </div>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const itemPathname = String(item.path || '').split('?')[0] || '/'
                  const isActive = itemPathname === '/aluno'
                    ? (currentPath === '/aluno' || currentPath.startsWith('/aluno/aula') || currentPath.startsWith('/aluno/curso'))
                    : (itemPathname === '/aluno/simulados' ? currentPath.startsWith('/aluno/simulados') || currentPath === '/aluno/reposta-correta-simulado' : currentPath === itemPathname)
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => navigateTo(item.path)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[13px] font-semibold transition-colors ${
                        isActive ? 'brand-bg text-white' : 'text-white/80 hover:bg-white/10'
                      }`}
                    >
                      <item.Icon className="w-5 h-5" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex-1 min-h-screen lg:h-screen flex flex-col overflow-hidden">
        <button
          type="button"
          className="lg:hidden fixed top-3 left-3 z-[60] h-10 w-10 rounded-full bg-white border border-[#E3E4E5] flex items-center justify-center shadow-sm"
          aria-label="Abrir menu"
          onClick={() => setMobileNavOpen(true)}
        >
          <Menu className="w-5 h-5 text-[#22252B]" />
        </button>
        <Header />

        <main className="flex-1 overflow-y-auto">
          <div className="pb-6">
            <div className="px-6 max-[1250px]:px-0">
              <div className="max-w-[1180px] mx-auto max-[1250px]:max-w-none max-[1250px]:mx-0">
                <div className="w-full h-[220px] overflow-hidden bg-white relative">
                  <img src="/DSC06289%201.png" alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="px-6">
              <div className="max-w-[1180px] mx-auto">
                <div className="mt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-[6px] bg-[#EEF2FF] flex items-center justify-center">
                        <PlayCircle className="w-4 h-4 text-[#0047BB]" />
                      </div>
                      <div className="text-[14px] font-semibold text-[#22252B]">Continue assistindo</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="w-9 h-9 rounded-full border border-[#22252B] bg-transparent flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => scrollContinueBy(-1)}
                        aria-label="Anterior"
                      >
                        <ChevronLeft className="w-4 h-4 text-[#22252B]" />
                      </button>
                      <button
                        type="button"
                        className="w-9 h-9 rounded-full border border-[#22252B] bg-transparent flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => scrollContinueBy(1)}
                        aria-label="Próximo"
                      >
                        <ChevronRight className="w-4 h-4 text-[#22252B]" />
                      </button>
                    </div>
                  </div>
                  <div
                    ref={continueScrollRef}
                    onScroll={updateContinueScrollState}
                    className="mt-3 flex gap-4 overflow-x-auto pb-2 scrollbar-hide"
                  >
                    {continueItems.map((it) => (
                      <ContinueCard
                        key={it.id}
                        cover={it.cover}
                        category={it.category}
                        title={it.title}
                        progress={it.progress}
                        lessonsDone={it.lessonsDone}
                        lessonsTotal={it.lessonsTotal}
                        onClick={async () => {
                          let cid = it.courseId || null
                          if (!cid) cid = isDemoStudent ? 'demo' : await resolveCourseIdByTitle(it.courseTitle || it.category)
                          if (!cid) return
                          const qs = new URLSearchParams()
                          qs.set('courseId', String(cid))
                          if (it.moduleId) qs.set('moduleId', String(it.moduleId))
                          if (it.lessonId) qs.set('lessonId', String(it.lessonId))
                          if (isDemoStudent) qs.set('demo', '1')
                          navigateTo(`/aluno/aula?${qs.toString()}`)
                        }}
                      />
                    ))}
                  </div>
                  {activeProducerUserId && continueItems.length === 0 ? (
                    <div className="mt-3 text-[12px] text-[#737780]">Nenhum curso encontrado para este produtor.</div>
                  ) : null}
                </div>

                <div className="mt-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-[6px] bg-[#EEF2FF] flex items-center justify-center">
                        <BookOpen className="w-4 h-4 text-[#0047BB]" />
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-[14px] font-semibold text-[#22252B]">Meus cursos</div>
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 h-8 px-4 rounded-[8px] bg-[#EEF2FF] text-[#0047BB] text-[12px] font-semibold"
                          onClick={() => setMyCoursesModalOpen(true)}
                        >
                          <span className="text-[16px] leading-none">+</span>
                          Ver mais
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="w-9 h-9 rounded-full border border-[#22252B] bg-transparent flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => scrollMyCoursesBy(-1)}
                        aria-label="Anterior"
                      >
                        <ChevronLeft className="w-4 h-4 text-[#22252B]" />
                      </button>
                      <button
                        type="button"
                        className="w-9 h-9 rounded-full border border-[#22252B] bg-transparent flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => scrollMyCoursesBy(1)}
                        aria-label="Próximo"
                      >
                        <ChevronRight className="w-4 h-4 text-[#22252B]" />
                      </button>
                    </div>
                  </div>
                  <div
                    ref={myCoursesScrollRef}
                    onScroll={updateMyCoursesScrollState}
                    className="mt-3 flex gap-4 overflow-x-auto pb-2 scrollbar-hide"
                  >
                    {myCourses.map((c) => (
                      <CourseCard
                        key={c.id}
                        cover={c.cover}
                        title={c.title}
                        progress={c.progress}
                        onClick={async () => {
                          let cid = c.courseId || null
                          if (!cid) cid = isDemoStudent ? 'demo' : await resolveCourseIdByTitle(c.title)
                          if (!cid) return
                          const base = `/aluno/curso/${encodeURIComponent(String(cid))}`
                          navigateTo(isDemoStudent ? `${base}?demo=1` : base)
                        }}
                      />
                    ))}
                  </div>
                  {activeProducerUserId && myCourses.length === 0 ? (
                    <div className="mt-3 text-[12px] text-[#737780]">Nenhum curso encontrado para este produtor.</div>
                  ) : null}
                </div>

                <div className="mt-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-[6px] bg-[#EEF2FF] flex items-center justify-center">
                        <Star className="w-4 h-4 text-[#0047BB]" />
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          className="text-[14px] font-semibold text-[#22252B] hover:underline"
                          onClick={() => setFeaturedModalOpen(true)}
                        >
                          Cursos em destaque
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="w-9 h-9 rounded-full border border-[#22252B] bg-transparent flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => scrollFeaturedBy(-1)}
                        aria-label="Anterior"
                      >
                        <ChevronLeft className="w-4 h-4 text-[#22252B]" />
                      </button>
                      <button
                        type="button"
                        className="w-9 h-9 rounded-full border border-[#22252B] bg-transparent flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => scrollFeaturedBy(1)}
                        aria-label="Próximo"
                      >
                        <ChevronRight className="w-4 h-4 text-[#22252B]" />
                      </button>
                    </div>
                  </div>
                  <div
                    ref={featuredScrollRef}
                    onScroll={updateFeaturedScrollState}
                    className="mt-3 flex gap-4 overflow-x-auto pb-2 scrollbar-hide"
                  >
                    {featuredCourses.map((c) => (
                      <CourseCard
                        key={c.id}
                        cover={c.cover}
                        title={c.title}
                        progress={c.progress}
                        locked
                        onClick={async () => {
                          let cid = c.courseId || null
                          if (!cid) cid = isDemoStudent ? 'demo' : await resolveCourseIdByTitle(c.title)
                          if (!cid) return
                          const base = `/aluno/curso/${encodeURIComponent(String(cid))}`
                          navigateTo(isDemoStudent ? `${base}?demo=1` : base)
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div className="mt-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-[6px] bg-[#EEF2FF] flex items-center justify-center">
                        <FileText className="w-4 h-4 text-[#0047BB]" />
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-[14px] font-semibold text-[#22252B]">Simulados</div>
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 h-8 px-4 rounded-[8px] bg-[#EEF2FF] text-[#0047BB] text-[12px] font-semibold"
                          onClick={() => setSimuladosModalOpen(true)}
                        >
                          <span className="text-[16px] leading-none">+</span>
                          Ver mais
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="w-9 h-9 rounded-full border border-[#22252B] bg-transparent flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => scrollSimuladosBy(-1)}
                        aria-label="Anterior"
                      >
                        <ChevronLeft className="w-4 h-4 text-[#22252B]" />
                      </button>
                      <button
                        type="button"
                        className="w-9 h-9 rounded-full border border-[#22252B] bg-transparent flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => scrollSimuladosBy(1)}
                        aria-label="Próximo"
                      >
                        <ChevronRight className="w-4 h-4 text-[#22252B]" />
                      </button>
                    </div>
                  </div>
                  <div
                    ref={simuladosScrollRef}
                    onScroll={updateSimuladosScrollState}
                    className="mt-3 flex gap-4 overflow-x-auto pb-2 scrollbar-hide"
                  >
                    {producerSimuladosLoading ? (
                      Array.from({ length: 4 }).map((_, idx) => (
                        <div key={`sim-skel-${idx}`} className="w-[252px] h-[230px] flex-shrink-0 rounded-[4px] border border-[#E3E4E5] bg-white p-4">
                          <div className="flex items-start justify-between">
                            <Skeleton className="w-[85px] h-[85px] rounded-md" />
                            <div className="flex flex-col items-end gap-4">
                              <Skeleton className="w-[80px] h-[18px] rounded-[54px]" />
                              <Skeleton className="w-[80px] h-[18px] rounded-[54px]" />
                            </div>
                          </div>
                          <div className="mt-3 space-y-2">
                            <Skeleton className="h-[14px] w-[170px] rounded" />
                            <Skeleton className="h-[10px] w-[120px] rounded" />
                          </div>
                          <div className="mt-auto pt-6 flex items-center justify-between">
                            <Skeleton className="h-[10px] w-[120px] rounded" />
                            <Skeleton className="w-[36px] h-[36px] rounded-full" />
                          </div>
                        </div>
                      ))
                    ) : (
                      simulados.map((s) => (
                        <SimuladoCard
                          key={s.id}
                          title={s.title}
                          progress={s.progress}
                          isPaid={s.is_paid ?? s.isPaid}
                          price={s.price}
                          onClick={() => {
                            const demoSuffix = isDemoStudent ? '&demo=1' : ''
                            navigateTo(`/aluno/simulados/acesso?simId=${encodeURIComponent(String(s.id))}${demoSuffix}`)
                          }}
                        />
                      ))
                    )}
                  </div>
                  {activeProducerUserId && simulados.length === 0 ? (
                    <div className="mt-3 text-[12px] text-[#737780]">
                      {producerSimuladosLoading ? '' : 'Nenhum simulado encontrado para este produtor.'}
                    </div>
                  ) : null}
                </div>

                {loading ? (
                  <div className="pb-6 text-[12px] text-[#737780]">Carregando...</div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-10">
            <CourseFooter />
          </div>
        </main>
      </div>
    </div>
  )
}
