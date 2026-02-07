import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext'
import { useActiveProducerUserId } from '@/hooks/useActiveProducerUserId'
import { X, Play, ChevronLeft, ChevronRight, ArrowLeft, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CourseFooter from '@/components/CourseFooter'
import BrandLogo from '@/components/BrandLogo'
import AlunoInboxThread from '@/components/AlunoInboxThread'

const DEMO_DESCRIPTION = 'Aprenda na prática com módulos organizados, aulas objetivas e conteúdos atualizados para o dia a dia no consultório.';
const DEMO_PROMO_VIDEO_URL = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';
const DEMO_MODULE_COVERS = [
  '/Artes.png',
  '/Artes%20%202.png',
  '/Artes%203.png',
  '/Preview.png',
  '/login-background.jpg',
  '/Artes%20%202.png',
];
const DEMO_MODULES = [
  { id: 'demo-1', name: 'Introdução' },
  { id: 'demo-2', name: 'Anamnese' },
  { id: 'demo-3', name: 'Exame físico' },
  { id: 'demo-4', name: 'Condutas' },
  { id: 'demo-5', name: 'Casos clínicos' },
  { id: 'demo-6', name: 'Revisão final' },
];

const parseJsonMaybe = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return null;
  try { return JSON.parse(value); } catch (_) { return null; }
};

const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;

const getCourseModules = (row) => {
  const parsed = parseJsonMaybe(row?.modules);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed.modules)) return parsed.modules;
    if (Array.isArray(parsed.items)) return parsed.items;
  }
  return [];
};

const getCourseMeta = (row) => {
  const fromData = parseJsonMaybe(row?.data) || null;
  const parsedModules = parseJsonMaybe(row?.modules) || null;
  const fromModulesMeta = parsedModules && typeof parsedModules === 'object' ? (parsedModules.meta || null) : null;
  const merged = { ...(fromModulesMeta || {}), ...(fromData || {}) };
  return merged;
};

const resolveCourseMedia = (row) => {
  const meta = getCourseMeta(row);
  const coverUrl = row?.cover_image_url || meta?.cover_image_url || meta?.coverImageUrl || null;
  const promoUrl = row?.promo_video_url || meta?.promo_video_url || meta?.promoVideoUrl || null;
  const moduleLayoutUrl = row?.module_layout_image_url || meta?.module_layout_image_url || meta?.moduleLayoutImageUrl || null;
  return { coverUrl, promoUrl, moduleLayoutUrl, meta };
};

export default function CursoPreviewAlunoPage() {
  const courseId = useMemo(() => {
    const path = window.location.pathname || '';
    const parts = path.split('/').filter(Boolean);
    const idx = parts.findIndex((p) => p === 'curso' || p === 'cursos' || p === 'curso-preview');
    if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
    if (parts[0] === 'cursos' && parts[1] === 'preview' && parts[2]) return parts[2];
    const params = new URLSearchParams(window.location.search || '');
    return params.get('id') || params.get('courseId') || '';
  }, []);

  const isAlunoView = useMemo(() => {
    try {
      return String(window.location.pathname || '').startsWith('/aluno/')
    } catch (_) {
      return false
    }
  }, [])

  const { user } = useAuth()

  const activeProducerUserId = useActiveProducerUserId()

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

  const navigateTo = (path) => {
    window.history.pushState({}, '', path)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  const isDemoAluno = useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search || '')
      return params.get('demo') === '1'
    } catch (_) {
      return false
    }
  }, [])

  const [loading, setLoading] = useState(true);
  const [courseRow, setCourseRow] = useState(null);
  const [error, setError] = useState(null);
  const [videoOpen, setVideoOpen] = useState(false);
  const [signedCover, setSignedCover] = useState(null);
  const [signedPromo, setSignedPromo] = useState(null);
  const [studentName, setStudentName] = useState('Aluno')
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [ownershipTick, setOwnershipTick] = useState(0)
  const [moduleCheckoutLoading, setModuleCheckoutLoading] = useState(false)
  const [moduleCheckoutError, setModuleCheckoutError] = useState('')
  const [moduleVerifyLoading, setModuleVerifyLoading] = useState(false)
  const [moduleBuyOpen, setModuleBuyOpen] = useState(false)
  const [selectedModule, setSelectedModule] = useState(null)

  const modulesScrollRef = useRef(null);

  const { coverUrl, promoUrl, moduleLayoutUrl, meta } = useMemo(() => resolveCourseMedia(courseRow), [courseRow]);
  const modules = useMemo(() => getCourseModules(courseRow), [courseRow]);
  const showDemo = Boolean(error) || !courseRow;

  const theme = useMemo(() => {
    const tText = meta?.theme_text_color || '#1E1B39';
    const tPrimary = meta?.theme_button_primary_color || '#0047BB';
    const tSecondary = meta?.theme_button_secondary_color || '#0047BB';
    const tBg = meta?.theme_page_background_color || '#F8FAFC';
    return {
      textColor: String(tText),
      buttonPrimary: String(tPrimary),
      buttonSecondary: String(tSecondary),
      pageBg: String(tBg),
    };
  }, [meta]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!courseId) {
        setError('Curso não encontrado.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase.from('courses').select('*').eq('id', courseId).single();
        if (!active) return;
        if (error) throw error;
        setCourseRow(data || null);
      } catch (e) {
        if (!active) return;
        const pid = String(activeProducerUserId || '').trim()
        if (isAlunoView && pid && isBlockedRead(e)) {
          try {
            const token = await getAccessToken()
            const r = await fetch(`/api/producer?type=course&courseId=${encodeURIComponent(String(courseId))}&producerId=${encodeURIComponent(pid)}`, {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            })
            const body = await r.json().catch(() => ({}))
            if (!active) return
            if (r.ok && body?.data) {
              setCourseRow(body.data)
              setError(null)
              return
            }
          } catch (_) {}
        }
        setError(e?.message || 'Erro ao carregar curso.');
        setCourseRow(null);
      } finally {
        if (active) setLoading(false);
      }
    };
    run();
    return () => { active = false; };
  }, [courseId, activeProducerUserId, isAlunoView]);

  useEffect(() => {
    const trySign = async () => {
      if (!courseRow) return;
      const meta = getCourseMeta(courseRow);
      const coverPath = meta?.cover_image_path || meta?.coverImagePath || null;
      const promoPath = meta?.promo_video_path || meta?.promoVideoPath || null;
      if (isNonEmptyString(coverPath)) {
        try {
          const { data } = supabase.storage.from('courses-media').getPublicUrl(String(coverPath));
          if (data?.publicUrl) setSignedCover(data.publicUrl);
        } catch (_) {}
      }
      if (isNonEmptyString(promoPath)) {
        try {
          const { data } = supabase.storage.from('courses-media').getPublicUrl(String(promoPath));
          if (data?.publicUrl) setSignedPromo(data.publicUrl);
        } catch (_) {}
      }
    };
    trySign();
  }, [courseRow]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setVideoOpen(false);
        setModuleBuyOpen(false);
      }
    };
    if (videoOpen || moduleBuyOpen) {
      document.addEventListener('keydown', onKeyDown);
      const prevOverflow = document?.body?.style?.overflow;
      if (document?.body?.style) document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', onKeyDown);
        if (document?.body?.style) document.body.style.overflow = prevOverflow || '';
      };
    }
  }, [videoOpen, moduleBuyOpen]);

  useEffect(() => {
    const name = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'Aluno'
    setStudentName(String(name))
  }, [user])

  const heroBg = signedCover || coverUrl || moduleLayoutUrl || (showDemo ? '/Preview.png' : null);
  const heroTitle = courseRow?.title || meta?.title || meta?.course_title || 'Nome do curso';
  const heroDescription = courseRow?.description || meta?.description || meta?.course_description || (showDemo ? DEMO_DESCRIPTION : '');

  const mediaPromo = signedPromo || promoUrl || (showDemo ? DEMO_PROMO_VIDEO_URL : null);

  const safeLsGet = (key) => {
    try { return String(localStorage.getItem(String(key || '')) || '') } catch (_) { return '' }
  }
  const safeLsSet = (key, value) => {
    try { localStorage.setItem(String(key || ''), String(value)) } catch (_) {}
  }
  const safeLsRemove = (key) => {
    try { localStorage.removeItem(String(key || '')) } catch (_) {}
  }
  const formatCentsBRL = (cents) => {
    const n = Number(cents || 0)
    const v = Number.isFinite(n) ? n / 100 : 0
    try { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) } catch (_) { return `R$ ${v.toFixed(2)}` }
  }

  const coursePrice = useMemo(() => {
    const candidates = [
      courseRow?.price,
      courseRow?.course_price,
      meta?.price,
      meta?.preco,
      meta?.coursePrice,
      meta?.course_price,
      meta?.productPrice,
      meta?.product_price,
      meta?.checkoutPrice,
      meta?.checkout_price,
    ]
    for (const c of candidates) {
      const n = Number(c)
      if (Number.isFinite(n) && n > 0) return n
    }
    return 0
  }, [courseRow, meta])

  const isPaidCourse = useMemo(() => {
    const candidates = [meta?.is_paid, meta?.isPaid, meta?.paid, meta?.pago, meta?.isPaidCourse]
    for (const c of candidates) {
      if (typeof c === 'boolean') return c || coursePrice > 0
    }
    return coursePrice > 0
  }, [meta, coursePrice])

  const ownedKey = courseId ? `connekt_course_owned:${String(courseId)}` : ''
  const isOwnedCourse = useMemo(() => {
    if (!courseId) return false
    if (!isPaidCourse) return true
    return safeLsGet(ownedKey) === '1'
  }, [courseId, ownedKey, isPaidCourse, ownershipTick])

  const startCourseCheckout = async () => {
    if (!courseId) return
    setCheckoutError('')
    setCheckoutLoading(true)
    try {
      const token = await getAccessToken()
      if (!token) {
        setCheckoutError('Faça login para comprar.')
        return
      }
      const r = await fetch('/api/simulado-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: 'course', courseId: String(courseId) }),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) {
        const msg = String(body?.message || body?.error || '').trim()
        setCheckoutError(msg || 'Não foi possível abrir o checkout.')
        return
      }
      const checkoutUrl = String(body?.checkout_url || '').trim()
      const linkId = String(body?.link_id || '').trim()
      if (linkId) safeLsSet(`connekt_course_pending_link:${String(courseId)}`, linkId)
      if (!checkoutUrl) {
        setCheckoutError('Checkout indisponível.')
        return
      }
      const w = window.open(checkoutUrl, '_blank', 'noopener')
      if (!w) setCheckoutError('Seu navegador bloqueou a abertura do checkout. Permita pop-ups e tente novamente.')
    } catch (_) {
      setCheckoutError('Erro ao abrir checkout.')
    } finally {
      setCheckoutLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    const run = async () => {
      if (!isAlunoView) return
      if (isDemoAluno) return
      if (!courseId) return
      if (!isPaidCourse) return
      if (isOwnedCourse) return

      const params = new URLSearchParams(window.location.search || '')
      const linkId = String(params.get('linkId') || params.get('paymentLinkId') || safeLsGet(`connekt_course_pending_link:${String(courseId)}`) || '').trim()
      if (!linkId) return

      setVerifyLoading(true)
      try {
        const token = await getAccessToken()
        if (!token) return
        const r = await fetch(`/api/simulado-checkout-verify?type=course&courseId=${encodeURIComponent(String(courseId))}&linkId=${encodeURIComponent(linkId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const body = await r.json().catch(() => ({}))
        if (!active) return
        if (!r.ok) return
        if (body?.paid) {
          safeLsSet(ownedKey, '1')
          safeLsRemove(`connekt_course_pending_link:${String(courseId)}`)
          setOwnershipTick((v) => v + 1)
          setCheckoutError('')
        }
      } catch (_) {
      } finally {
        if (active) setVerifyLoading(false)
      }
    }
    run()
    return () => { active = false }
  }, [isAlunoView, isDemoAluno, courseId, isPaidCourse, isOwnedCourse])

  useEffect(() => {
    const onStorage = (e) => {
      const k = String(e?.key || '')
      if (!k) return
      if (k.startsWith('connekt_course_owned:') || k.startsWith('connekt_module_owned:')) {
        setOwnershipTick((v) => v + 1)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const findModuleById = (mid) => {
    const id = String(mid || '').trim()
    if (!id) return null
    return (Array.isArray(modules) ? modules : []).find((m) => String(m?.id || m?.module_id || m?.moduleId || '').trim() === id) || null
  }
  const moduleOwnedKey = (mid) => {
    const id = String(mid || '').trim()
    return courseId && id ? `connekt_module_owned:${String(courseId)}:${id}` : ''
  }
  const isPaidModule = (mid) => {
    const m = findModuleById(mid)
    if (!m) return false
    const vis = String(m?.visibility || '').trim()
    const cents = Number(m?.priceCents || 0)
    return vis === 'Paga' || (Number.isFinite(cents) && cents > 0)
  }
  const modulePriceCents = (mid) => {
    const m = findModuleById(mid)
    const cents = Number(m?.priceCents || 0)
    return Number.isFinite(cents) ? cents : 0
  }
  const isOwnedModule = (mid) => {
    if (!courseId) return false
    if (isOwnedCourse) return true
    if (!isPaidModule(mid)) return true
    const k = moduleOwnedKey(mid)
    return k ? safeLsGet(k) === '1' : false
  }

  const startModuleCheckout = async (mid) => {
    const id = String(mid || '').trim()
    if (!courseId || !id) return
    setModuleCheckoutError('')
    setModuleCheckoutLoading(true)
    try {
      const token = await getAccessToken()
      if (!token) {
        setModuleCheckoutError('Faça login para comprar.')
        return
      }
      const r = await fetch('/api/simulado-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: 'module', courseId: String(courseId), moduleId: id }),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) {
        const msg = String(body?.message || body?.error || '').trim()
        setModuleCheckoutError(msg || 'Não foi possível abrir o checkout.')
        return
      }
      const checkoutUrl = String(body?.checkout_url || '').trim()
      const linkId = String(body?.link_id || '').trim()
      if (linkId) safeLsSet(`connekt_module_pending_link:${String(courseId)}:${id}`, linkId)
      if (!checkoutUrl) {
        setModuleCheckoutError('Checkout indisponível.')
        return
      }
      const w = window.open(checkoutUrl, '_blank', 'noopener')
      if (!w) setModuleCheckoutError('Seu navegador bloqueou a abertura do checkout. Permita pop-ups e tente novamente.')
    } catch (_) {
      setModuleCheckoutError('Erro ao abrir checkout.')
    } finally {
      setModuleCheckoutLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    const run = async () => {
      if (!isAlunoView) return
      if (isDemoAluno) return
      if (!courseId) return
      const params = new URLSearchParams(window.location.search || '')
      const mid = String(params.get('moduleId') || '').trim()
      if (!mid) return
      if (!isPaidModule(mid)) return
      if (isOwnedModule(mid)) return
      const linkId = String(params.get('linkId') || params.get('paymentLinkId') || safeLsGet(`connekt_module_pending_link:${String(courseId)}:${mid}`) || '').trim()
      if (!linkId) return
      setModuleVerifyLoading(true)
      try {
        const token = await getAccessToken()
        if (!token) return
        const r = await fetch(`/api/simulado-checkout-verify?type=module&courseId=${encodeURIComponent(String(courseId))}&moduleId=${encodeURIComponent(mid)}&linkId=${encodeURIComponent(linkId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const body = await r.json().catch(() => ({}))
        if (!active) return
        if (!r.ok) return
        if (body?.paid) {
          const k = moduleOwnedKey(mid)
          if (k) safeLsSet(k, '1')
          safeLsRemove(`connekt_module_pending_link:${String(courseId)}:${mid}`)
          setOwnershipTick((v) => v + 1)
          setModuleCheckoutError('')
          setModuleBuyOpen(false)
          setSelectedModule(null)
        }
      } catch (_) {
      } finally {
        if (active) setModuleVerifyLoading(false)
      }
    }
    run()
    return () => { active = false }
  }, [isAlunoView, isDemoAluno, courseId, modules, isOwnedCourse, ownershipTick])

  useEffect(() => {
    if (!isAlunoView) return
    if (isDemoAluno) return
    if (!courseId) return
    const params = new URLSearchParams(window.location.search || '')
    const mid = String(params.get('moduleId') || '').trim()
    if (!mid) return
    if (!isPaidModule(mid)) return
    if (isOwnedModule(mid)) return
    const m = findModuleById(mid)
    if (!m) return
    setSelectedModule(m)
    setModuleBuyOpen(true)
  }, [isAlunoView, isDemoAluno, courseId, modules, ownershipTick])

  const primaryCtaLabel = (() => {
    if (loading) return 'Carregando...'
    if (checkoutLoading) return 'Abrindo checkout...'
    if (verifyLoading) return 'Verificando pagamento...'
    if (!isAlunoView) return 'Comprar curso'
    if (!courseId) return 'Curso indisponível'
    if (!isPaidCourse) return 'Acessar curso'
    if (isOwnedCourse) return 'Acessar curso'
    return 'Comprar curso'
  })()
  const primaryCtaDisabled = loading || checkoutLoading || verifyLoading || (isAlunoView && !courseId) || (!isAlunoView && true)

  useEffect(() => {
    const t = String(heroTitle || '').trim()
    if (!t) return
    document.title = `Connekt - ${t}`
  }, [heroTitle])

  const handleScrollModules = (dir) => {
    const el = modulesScrollRef.current;
    if (!el) return;
    const delta = Math.round(el.clientWidth * 0.8) * (dir === 'left' ? -1 : 1);
    el.scrollBy({ left: delta, behavior: 'smooth' });
  };

  const moduleCardBg = (m, idx) => {
    const possible = [
      m?.cover_image_url,
      m?.coverImageUrl,
      m?.thumbnail_url,
      m?.thumbnailUrl,
      m?.image_url,
      m?.imageUrl,
      (showDemo ? DEMO_MODULE_COVERS[idx % DEMO_MODULE_COVERS.length] : null),
      moduleLayoutUrl,
      heroBg,
    ];
    return possible.find(isNonEmptyString) || null;
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center" style={{ backgroundColor: theme.pageBg }}>
        <div className="text-[13px] text-[#737780] font-inter">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col" style={{ backgroundColor: theme.pageBg, color: theme.textColor }}>
      <div className="w-full flex-1">
        <div className="relative w-full">
          <div
            className="w-full"
            style={{
              backgroundColor: theme.pageBg,
              backgroundImage: heroBg ? `url(${heroBg})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <div className="w-full bg-white/80 backdrop-blur-[2px]">
              <div className="mx-auto w-full max-w-[1200px] px-6 py-10">
                <div className="grid grid-cols-12 gap-8 items-center">
                  <div className="col-span-12 lg:col-span-5">
                    <div className="flex items-center gap-2 text-[12px] text-[#737780]">
                      <button
                        type="button"
                        className="hover:text-[#22252B]"
                        onClick={() => navigateTo(isAlunoView ? '/aluno' : '/cursos')}
                      >
                        {isAlunoView ? 'Meus cursos' : 'Cursos'}
                      </button>
                      <span>{'>'}</span>
                      <div className="truncate">{heroTitle}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <BrandLogo variant="compact" className="h-9 w-auto" />
                    </div>
                    <div className="mt-6 text-[28px] font-semibold leading-[34px]">{heroTitle}</div>
                    {heroDescription ? (
                      <div className="mt-3 text-[12px] leading-[18px] text-[#737780] max-w-[420px]">
                        {heroDescription}
                      </div>
                    ) : null}
                    <div className="mt-5">
                      <Button
                        className="h-9 px-5 rounded-[6px] text-[12px] font-medium"
                        style={{ backgroundColor: (isAlunoView && isPaidCourse && !isOwnedCourse) ? '#0047BB' : theme.buttonPrimary, color: '#FFFFFF' }}
                        disabled={primaryCtaDisabled}
                        onClick={() => {
                          if (!isAlunoView) return
                          if (!courseId) return
                          if (isDemoAluno) {
                            const qs = new URLSearchParams()
                            qs.set('courseId', String(courseId))
                            qs.set('demo', '1')
                            navigateTo(`/aluno/aula?${qs.toString()}`)
                            return
                          }
                          if (!isPaidCourse || isOwnedCourse) {
                            const qs = new URLSearchParams()
                            qs.set('courseId', String(courseId))
                            const first = Array.isArray(modules) ? modules[0] : null
                            const firstId = first?.id || first?.module_id || first?.moduleId || null
                            if (firstId) qs.set('moduleId', String(firstId))
                            navigateTo(`/aluno/aula?${qs.toString()}`)
                            return
                          }
                          startCourseCheckout()
                        }}
                      >
                        {primaryCtaLabel}
                      </Button>
                      {checkoutError ? (
                        <div className="mt-2 text-[12px] text-[#B91C1C]">
                          {checkoutError}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="col-span-12 lg:col-span-7">
                    <div className="w-full flex justify-center lg:justify-end">
                      <div className="relative w-full max-w-[560px] aspect-video rounded-xl overflow-hidden shadow-xl bg-[#0B1220]/10">
                        {mediaPromo ? (
                          <video
                            src={(typeof mediaPromo === 'string' && mediaPromo.includes('.supabase.co/storage/v1/object/')) ? `/api/media?u=${encodeURIComponent(mediaPromo)}` : mediaPromo}
                            className="w-full h-full object-cover"
                            autoPlay
                            loop
                            muted
                            playsInline
                            preload="auto"
                            onError={(e) => {
                              const v = e.currentTarget
                              const proxied = (typeof mediaPromo === 'string' && mediaPromo.includes('.supabase.co/storage/v1/object/')) ? `/api/media?u=${encodeURIComponent(mediaPromo)}` : null
                              if (!proxied || !String(v?.src || '').includes('/api/media?u=')) return
                              if (v?.dataset?.fallbackUsed === '1') return
                              v.dataset.fallbackUsed = '1'
                              v.src = mediaPromo
                              try { v.load() } catch (_) {}
                              try { v.play?.() } catch (_) {}
                            }}
                          />
                        ) : (
                          <div className="w-full h-full bg-white/60 flex items-center justify-center text-[12px] text-[#737780]">
                            Vídeo não disponível
                          </div>
                        )}
                        {mediaPromo ? (
                          <button
                            type="button"
                            onClick={() => setVideoOpen(true)}
                            className="absolute inset-0 flex items-center justify-center"
                            aria-label="Assistir vídeo"
                          >
                            <span className="h-12 w-12 rounded-full bg-white/90 flex items-center justify-center shadow-md">
                              <Play className="h-5 w-5 text-[#0047BB]" />
                            </span>
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[1200px] px-6 py-10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26" fill="none">
                <path d="M0 4C0 1.79086 1.79086 0 4 0H22C24.2091 0 26 1.79086 26 4V22C26 24.2091 24.2091 26 22 26H4C1.79086 26 0 24.2091 0 22V4Z" fill="#5B4DEA" />
                <g clipPath="url(#clip0_914_61491)">
                  <path d="M18.6875 17.375C18.6875 17.491 18.6414 17.6023 18.5594 17.6844C18.4773 17.7664 18.366 17.8125 18.25 17.8125H7.75C7.63397 17.8125 7.52269 17.7664 7.44064 17.6844C7.35859 17.6023 7.3125 17.491 7.3125 17.375C7.3125 17.259 7.35859 17.1477 7.44064 17.0656C7.52269 16.9836 7.63397 16.9375 7.75 16.9375H18.25C18.366 16.9375 18.4773 16.9836 18.5594 17.0656C18.6414 17.1477 18.6875 17.259 18.6875 17.375ZM18.6875 9.0625V15.1875C18.6875 15.4196 18.5953 15.6421 18.4312 15.8062C18.2671 15.9703 18.0446 16.0625 17.8125 16.0625H8.1875C7.95544 16.0625 7.73288 15.9703 7.56878 15.8062C7.40469 15.6421 7.3125 15.4196 7.3125 15.1875V9.0625C7.3125 8.83044 7.40469 8.60788 7.56878 8.44378C7.73288 8.27969 7.95544 8.1875 8.1875 8.1875H17.8125C18.0446 8.1875 18.2671 8.27969 18.4312 8.44378C18.5953 8.60788 18.6875 8.83044 18.6875 9.0625ZM14.9688 12.125C14.9687 12.0547 14.9518 11.9854 14.9193 11.9231C14.8868 11.8607 14.8398 11.8071 14.7823 11.7668L12.5948 10.2355C12.5292 10.1896 12.4523 10.1626 12.3725 10.1573C12.2926 10.1521 12.2128 10.1688 12.1418 10.2058C12.0708 10.2427 12.0113 10.2984 11.9698 10.3668C11.9282 10.4352 11.9063 10.5137 11.9062 10.5938V13.6562C11.9063 13.7363 11.9282 13.8148 11.9698 13.8832C12.0113 13.9516 12.0708 14.0073 12.1418 14.0442C12.2128 14.0812 12.2926 14.0979 12.3725 14.0927C12.4523 14.0874 12.5292 14.0604 12.5948 14.0145L14.7823 12.4832C14.8398 12.4429 14.8868 12.3893 14.9193 12.3269C14.9518 12.2646 14.9687 12.1953 14.9688 12.125Z" fill="#F9FAFB" />
                </g>
                <defs>
                  <clipPath id="clip0_914_61491">
                    <rect width="14" height="14" fill="white" transform="translate(6 6)" />
                  </clipPath>
                </defs>
              </svg>
              <div className="text-[14px] font-semibold">Módulos</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="h-8 w-8 rounded-full border border-[#E3E4E5] bg-white flex items-center justify-center"
                onClick={() => handleScrollModules('left')}
                aria-label="Voltar"
              >
                <ChevronLeft className="h-4 w-4 text-[#6B7588]" />
              </button>
              <button
                type="button"
                className="h-8 w-8 rounded-full border border-[#E3E4E5] bg-white flex items-center justify-center"
                onClick={() => handleScrollModules('right')}
                aria-label="Avançar"
              >
                <ChevronRight className="h-4 w-4 text-[#6B7588]" />
              </button>
            </div>
          </div>

          <div className="relative mt-5">
            <div
              ref={modulesScrollRef}
              className="flex gap-4 overflow-x-auto pb-3 scroll-smooth"
              style={{ scrollbarWidth: 'none' }}
            >
              {(modules.length > 0 ? modules : DEMO_MODULES).map((m, idx) => {
                const bg = moduleCardBg(m, idx);
                const name = m?.name || m?.title || `Módulo ${idx + 1}`;
                const moduleId = m?.id || m?.module_id || m?.moduleId || null
                const lockedCourse = isAlunoView && !isDemoAluno && isPaidCourse && !isOwnedCourse
                const paidModule = isAlunoView && !isDemoAluno && moduleId && isPaidModule(moduleId)
                const ownedModule = isAlunoView && !isDemoAluno && moduleId && isOwnedModule(moduleId)
                const lockedModule = isAlunoView && !isDemoAluno && moduleId && paidModule && !ownedModule
                const lockedFreeModuleByCourse = lockedCourse && !ownedModule && !paidModule
                const priceText = (paidModule && moduleId) ? formatCentsBRL(modulePriceCents(moduleId)) : ''
                return (
                  <button
                    key={m?.id || idx}
                    className={`shrink-0 w-[180px] h-[326px] rounded-xl overflow-hidden border border-[#E3E4E5] bg-white shadow-sm ${lockedFreeModuleByCourse ? 'opacity-70 grayscale cursor-not-allowed' : ''}`}
                    type="button"
                    onClick={() => {
                      if (!isAlunoView) return
                      if (!courseId) return
                      if (lockedFreeModuleByCourse) return
                      if (lockedModule) {
                        setSelectedModule(m)
                        setModuleCheckoutError('')
                        setModuleBuyOpen(true)
                        return
                      }
                      const qs = new URLSearchParams()
                      qs.set('courseId', String(courseId))
                      if (moduleId) qs.set('moduleId', String(moduleId))
                      if (isDemoAluno) qs.set('demo', '1')
                      navigateTo(`/aluno/aula?${qs.toString()}`)
                    }}
                    disabled={!isAlunoView || !courseId}
                  >
                    <div
                      className="w-full h-full flex flex-col justify-end"
                      style={{
                        backgroundImage: bg ? `url(${bg})` : undefined,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        backgroundColor: '#0B1220',
                      }}
                    >
                      <div className="bg-gradient-to-t from-black/70 to-black/0 h-full">
                        <div className="h-full px-3 pb-5 flex flex-col items-center justify-end text-center relative">
                          {paidModule ? (
                            <div className="absolute top-3 left-3 flex flex-col items-start gap-1">
                              <span className="inline-flex items-center justify-center h-[18px] px-3 text-[10px] rounded-[54px] leading-none font-medium bg-[#FEF3C7] text-[#92400E]">
                                Pago
                              </span>
                              {priceText ? (
                                <span className="inline-flex items-center justify-center h-[18px] px-3 text-[10px] rounded-[54px] leading-none font-medium bg-[#FEF3C7] text-[#92400E]">
                                  {priceText}
                                </span>
                              ) : null}
                            </div>
                          ) : (
                            <div className="absolute top-3 left-3">
                              <span className="inline-flex items-center justify-center h-[18px] px-3 text-[10px] rounded-[54px] leading-none font-medium bg-[#EEF2FF] text-[#0047BB]">
                                Gratuito
                              </span>
                            </div>
                          )}
                          {ownedModule && paidModule ? (
                            <div className="absolute top-3 right-3">
                              <span className="inline-flex items-center justify-center h-[18px] px-3 text-[10px] rounded-[54px] leading-none font-medium bg-[#E9FFEF] text-[#06C270]">
                                Adquirido
                              </span>
                            </div>
                          ) : lockedModule ? (
                            <div className="absolute top-3 right-3 h-8 w-8 rounded-full bg-white/90 flex items-center justify-center">
                              <Lock className="h-4 w-4 text-[#1E1B39]" />
                            </div>
                          ) : null}
                          <svg xmlns="http://www.w3.org/2000/svg" width="119" height="36" viewBox="0 0 119 36" fill="none" className="w-[110px] h-auto">
                            <g clipPath="url(#clip0_914_61509)">
                              <path d="M88.3434 35.5774H85.6503C84.9025 35.5774 84.2022 35.2854 83.6748 34.7536C83.1431 34.2176 82.8535 33.5115 82.8535 32.7575V2.41459C82.8535 2.36665 82.8535 2.31871 82.8535 2.27077C82.9097 1.1681 83.6705 0.278997 84.7469 0.0523619C85.8405 -0.174273 86.9039 0.348731 87.3924 1.35115L91.1358 9.01752V18.0045L90.7079 18.4272C90.1935 18.9371 89.9125 19.6171 89.9125 20.3449C89.9125 21.0727 90.1978 21.757 90.7079 22.2669L91.1358 22.6897V32.7575C91.1358 33.5115 90.8462 34.2219 90.3145 34.7536C89.7871 35.2854 89.0825 35.5774 88.339 35.5774H88.3434ZM85.7065 32.6965H88.2785V23.8447C87.4875 22.8553 87.0552 21.635 87.0552 20.3449C87.0552 19.0548 87.4875 17.8345 88.2785 16.8451V9.6887L85.7065 4.4238V32.7009V32.6965Z" fill="#DADADA" />
                              <path d="M98.1691 20.0965L103.218 15.7338L108.799 10.9091L118.417 2.59766H106.11L89.6317 16.2219L89.5323 16.3091C88.4905 17.342 87.9199 18.7236 87.9199 20.1967C87.9199 21.6699 88.4776 23.0209 89.502 24.0539C89.5885 24.141 89.6793 24.2151 89.783 24.2805L106.192 35.098H119L98.1691 20.0965ZM91.4084 21.9837C90.9588 21.4955 90.7167 20.8679 90.7167 20.1967C90.7167 19.5255 90.9761 18.8544 91.4559 18.3619L107.108 5.41752H110.861L105.989 9.6277L104.472 10.9396V12.9924H102.094L93.6389 20.297L110.277 32.2781H107.026L91.4084 21.9837Z" fill="white" />
                              <path d="M7.92786 23.2653C5.28668 23.2653 4.10658 21.5481 4.10658 19.4386C4.10658 17.3292 5.28668 15.612 7.92786 15.612C10.046 15.612 11.2218 16.7234 11.5806 18.2749H15.5229C14.8485 14.2522 11.3428 12.6309 7.92786 12.6309C4.18006 12.6309 0 14.4483 0 19.4386C0 24.4289 4.18006 26.2464 7.92786 26.2464C11.3428 26.2464 14.8485 24.6469 15.5229 20.6285H11.5806C11.2218 22.1539 10.046 23.2653 7.92786 23.2653Z" fill="white" />
                              <path d="M24.4844 12.6309C20.7366 12.6309 16.5781 14.4483 16.5781 19.4386C16.5781 24.4289 20.7366 26.2464 24.4844 26.2464C28.2322 26.2464 32.3906 24.4289 32.3906 19.4386C32.3906 14.4483 28.2322 12.6309 24.4844 12.6309ZM24.4844 23.2653C21.8432 23.2653 20.6631 21.5481 20.6631 19.4386C20.6631 17.3292 21.8432 15.612 24.4844 15.612C27.1255 15.612 28.2797 17.3292 28.2797 19.4386C28.2797 21.5481 27.1299 23.2653 24.4844 23.2653Z" fill="white" />
                              <path d="M43.1536 12.6309C40.4865 12.6309 38.9476 14.0822 38.4419 14.8362V12.9926H34.1191V25.9064H38.4419V18.3229C38.4419 16.8933 39.4274 15.8037 41.351 15.8037C43.2746 15.8037 44.1867 16.8933 44.1867 18.3229V25.9064H48.5138V17.3553C48.5138 14.4483 46.4475 12.6309 43.1536 12.6309Z" fill="white" />
                              <path d="M59.8528 12.6309C57.1857 12.6309 55.6468 14.0822 55.1454 14.8362V12.9926H50.8184V25.9064H55.1454V18.3229C55.1454 16.8933 56.131 15.8037 58.0503 15.8037C59.9695 15.8037 60.886 16.8933 60.886 18.3229V25.9064H65.213V17.3553C65.213 14.4483 63.1467 12.6309 59.8528 12.6309Z" fill="white" />
                              <path d="M74.2292 12.6562C70.5549 12.6562 66.5391 14.5957 66.5391 19.464C66.5391 24.3323 70.5549 26.2718 74.2292 26.2718C77.4755 26.2718 80.6225 24.9904 81.4395 21.5473H77.5966C77.0649 22.5672 76.1052 23.2907 74.2292 23.2907C72.0203 23.2907 70.8445 22.0834 70.5073 20.4316H81.634C82.0187 14.8616 77.9813 12.6562 74.2292 12.6562ZM70.6759 17.9124C71.1557 16.5831 72.3099 15.6374 74.2292 15.6374C76.1485 15.6374 77.1859 16.557 77.5966 17.9124H70.6759Z" fill="white" />
                              <path d="M112.546 15.733V12.9916H108.798V9.62695H104.471V12.9916H102.094V15.733H104.471V20.8454C104.471 24.088 105.241 26.1016 109.974 26.1016C110.986 26.1016 111.656 26.0275 112.546 25.9054V22.5887C109.71 22.9505 108.798 22.6105 108.798 20.8454V15.733H112.546Z" fill="white" />
                            </g>
                            <defs>
                              <clipPath id="clip0_914_61509">
                                <rect width="119" height="35.5773" fill="white" />
                              </clipPath>
                            </defs>
                          </svg>
                          <div className="mt-2 h-[2px] w-10 bg-white/70 rounded" />
                          <div className="mt-3 text-[14px] font-semibold text-white truncate w-full">{name}</div>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div
              className="pointer-events-none absolute right-0 top-0 h-full w-[90px]"
              style={{ background: `linear-gradient(to right, rgba(0,0,0,0), ${theme.pageBg})` }}
            />
          </div>
        </div>
      </div>

      {isAlunoView ? (
        <div className="mx-auto w-full max-w-[1200px] px-6 pb-10">
          <AlunoInboxThread
            user={user}
            studentName={studentName}
            threadKey={`course:${String(courseId || '')}`}
            title="Inbox"
            itemLabel="Mensagens"
            placeholder="Digite aqui sua mensagem"
            courseId={courseId}
          />
        </div>
      ) : null}

      <CourseFooter className="mt-auto" />

      {!isAlunoView ? (
        <button
          type="button"
          onClick={() => {
            const backPath = courseId && courseId !== 'demo' ? `/produtos/editar/${courseId}` : '/produtos/novo'
            window.history.pushState({}, '', backPath)
            window.dispatchEvent(new PopStateEvent('popstate'))
          }}
          className="fixed bottom-6 right-6 z-[1000] h-12 w-12 rounded-full bg-[#0047BB] text-white shadow-lg flex items-center justify-center hover:bg-[#003a99]"
          aria-label="Voltar para edição do curso"
          title="Voltar para edição do curso"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      ) : null}

      {videoOpen ? (
        <div className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-4">
          <div className="relative w-full max-w-[960px] bg-black rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setVideoOpen(false)}
              className="absolute top-3 right-3 z-10 h-9 w-9 rounded-full bg-white/90 flex items-center justify-center"
              aria-label="Fechar"
            >
              <X className="h-5 w-5 text-[#1E1B39]" />
            </button>
            <div className="w-full aspect-video">
              {mediaPromo ? (
                <video
                  src={(typeof mediaPromo === 'string' && mediaPromo.includes('.supabase.co/storage/v1/object/')) ? `/api/media?u=${encodeURIComponent(mediaPromo)}` : mediaPromo}
                  className="w-full h-full"
                  controls
                  preload="none"
                  onError={(e) => {
                    const v = e.currentTarget
                    const proxied = (typeof mediaPromo === 'string' && mediaPromo.includes('.supabase.co/storage/v1/object/')) ? `/api/media?u=${encodeURIComponent(mediaPromo)}` : null
                    if (!proxied || !String(v?.src || '').includes('/api/media?u=')) return
                    if (v?.dataset?.fallbackUsed === '1') return
                    v.dataset.fallbackUsed = '1'
                    v.src = mediaPromo
                    try { v.load() } catch (_) {}
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[12px] text-white/80">
                  Vídeo não disponível
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {moduleBuyOpen ? (
        <div className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-4">
          <div className="relative w-full max-w-[520px] bg-white rounded-xl overflow-hidden border border-[#E3E4E5]">
            <button
              type="button"
              onClick={() => { setModuleBuyOpen(false); setSelectedModule(null); setModuleCheckoutError('') }}
              className="absolute top-3 right-3 z-10 h-9 w-9 rounded-full bg-[#F3F4F6] flex items-center justify-center"
              aria-label="Fechar"
            >
              <X className="h-5 w-5 text-[#1E1B39]" />
            </button>
            <div className="p-5">
              <div className="text-[14px] font-semibold text-[#1E1B39]">Módulo pago</div>
              <div className="mt-1 text-[12px] text-[#737780]">
                {(selectedModule?.name || selectedModule?.title) ? `Você precisa comprar este módulo para acessar: ${String(selectedModule?.name || selectedModule?.title)}` : 'Você precisa comprar este módulo para acessar.'}
              </div>
              <div className="mt-4 flex items-center justify-between rounded-[10px] border border-[#E3E4E5] bg-[#FBFCFF] px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center h-[18px] px-3 text-[10px] rounded-[54px] leading-none font-medium bg-[#FEF3C7] text-[#92400E]">Pago</span>
                  <span className="text-[12px] font-semibold text-[#1E1B39]">
                    {formatCentsBRL(modulePriceCents(String(selectedModule?.id || selectedModule?.module_id || selectedModule?.moduleId || '')))}
                  </span>
                </div>
              </div>
              {moduleCheckoutError ? (
                <div className="mt-3 text-[12px] text-[#B91C1C]">{moduleCheckoutError}</div>
              ) : null}
              <div className="mt-4 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9"
                  onClick={() => { setModuleBuyOpen(false); setSelectedModule(null); setModuleCheckoutError('') }}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  className="h-9 bg-[#0047BB] hover:bg-[#003a99] text-white"
                  disabled={moduleCheckoutLoading || moduleVerifyLoading}
                  onClick={() => startModuleCheckout(String(selectedModule?.id || selectedModule?.module_id || selectedModule?.moduleId || ''))}
                >
                  {moduleVerifyLoading ? 'Verificando pagamento...' : (moduleCheckoutLoading ? 'Abrindo checkout...' : 'Comprar módulo')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
