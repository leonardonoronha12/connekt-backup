import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Camera, Bell, X, ExternalLink, Info, AlertTriangle, UploadCloud, Monitor, Smartphone, LogOut, Shield } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/supabaseClient.js';
import { toast } from '@/hooks/use-toast.ts';
import { planService } from '@/services/planService.js';
import { canConnectVideoProvider, canUseWhitelabel, canUseNpsFeedback, resolvePlanKey } from '@/services/planEntitlements.js';
import CancelSubscriptionModal from '@/components/CancelSubscriptionModal.jsx';
import { deviceSessionService } from '@/services/deviceSessionService.js';
import { getPublicAppOrigin } from '@/services/publicUrl.js';
import { ALUNO_NAV_SECTIONS } from '@/constants/alunoNavSections'

function parseHostFromUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    return new URL(raw).hostname || '';
  } catch (_) {
    return raw.replace(/^https?:\/\//i, '').split('/')[0] || '';
  }
}

function normalizeSavedMemberAreaUrlForLink(value) {
  const host = parseHostFromUrl(value).toLowerCase();
  if (!host) return { url: '', host: '' };

  if (host.endsWith('.app.connektco.com')) {
    return { url: `https://${host}`, host };
  }

  const match = host.match(/^([a-z0-9-]+)\.connektco\.com(?:\.br)?$/i);
  if (match && match[1]) {
    const fixedHost = `${match[1].toLowerCase()}.app.connektco.com`;
    return { url: `https://${fixedHost}`, host: fixedHost };
  }

  return { url: `https://${host}`, host };
}

const ConfiguracoesPage = () => {
  const { user, signOut, session, approveDeviceRequest, denyDeviceRequest } = useAuth();
  const [activeTab, setActiveTab] = useState('Perfil e conta');
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [testEmailLoading, setTestEmailLoading] = useState(false);

  const [deviceAccess, setDeviceAccess] = useState({ registered: { desktop: null, mobile: null }, pending: null })
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [currentDeviceId, setCurrentDeviceId] = useState('');

  // Dados do usuário para exibição
  const userName = user?.user_metadata?.name || user?.user_metadata?.full_name || 'Usuário';
  const userEmail = user?.email || 'email@exemplo.com';
  const isLocalDev = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const avatarInputRef = useRef(null);
  const devicesReqRef = useRef(0);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [subdomainSavedUrl, setSubdomainSavedUrl] = useState('');
  const studentPortalLink = useMemo(() => {
    try {
      const uid = user?.id ? String(user.id).trim() : ''
      if (!uid) return ''
      const host = String(window.location.hostname || '').toLowerCase()
      const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0'
      const envUrl =
        import.meta?.env?.VITE_SITE_URL ||
        import.meta?.env?.VITE_PUBLIC_APP_URL ||
        import.meta?.env?.VITE_APP_BASE_URL ||
        'https://app.connektco.com'
      const base = (() => {
        if (isLocal) return window.location.origin
        try { return new URL(String(envUrl)).origin } catch (_) { return 'https://app.connektco.com' }
      })()
      return `${base.replace(/\/$/, '')}/login-aluno?producer_uid=${encodeURIComponent(uid)}`
    } catch (_) {
      return ''
    }
  }, [user?.id])

  const [profileFullName, setProfileFullName] = useState(userName || '');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileCrm, setProfileCrm] = useState('');
  const [profileSpecialty, setProfileSpecialty] = useState('');
  const [profileInstitution, setProfileInstitution] = useState('');
  const [subdomainInput, setSubdomainInput] = useState('');
  const [subdomainSaving, setSubdomainSaving] = useState(false);
  const [subdomainStatus, setSubdomainStatus] = useState({ state: 'idle', title: '', description: '' });
  const subdomainStatusTimerRef = useRef(null);
  const subdomainStatusTriesRef = useRef(0);
  const whitelabelLogoInputRef = useRef(null);
  const whitelabelLogoCompactInputRef = useRef(null);
  const [whitelabelBrandName, setWhitelabelBrandName] = useState('');
  const [whitelabelPrimaryColor, setWhitelabelPrimaryColor] = useState('#0047BB');
  const [whitelabelPrimaryHoverColor, setWhitelabelPrimaryHoverColor] = useState('#003399');
  const [whitelabelSidebarFrom, setWhitelabelSidebarFrom] = useState('rgb(15, 6, 39)');
  const [whitelabelSidebarTo, setWhitelabelSidebarTo] = useState('rgb(0, 0, 104)');
  const [whitelabelLogoUrl, setWhitelabelLogoUrl] = useState('');
  const [whitelabelLogoCompactUrl, setWhitelabelLogoCompactUrl] = useState('');
  const [whitelabelWelcomeEmailSubject, setWhitelabelWelcomeEmailSubject] = useState('Bem-vindo à nossa plataforma de cursos!');
  const [whitelabelWelcomeEmailMessage, setWhitelabelWelcomeEmailMessage] = useState(`Olá {nome}!\n\nSeja muito bem-vindo(a) à nossa plataforma de cursos médicos!\n\nVocê agora tem acesso a conteúdos exclusivos desenvolvidos por especialistas renomados. Explore nossos cursos e aprimore seus conhecimentos.\n\nEm caso de dúvidas, nossa equipe está sempre disponível para ajudá-lo.\n\nBons estudos!\n\n`);
  const [whitelabelSaving, setWhitelabelSaving] = useState(false);
  const [whitelabelUploading, setWhitelabelUploading] = useState(false);
  const [payoutEnabled, setPayoutEnabled] = useState(false);
  const [payoutPixKey, setPayoutPixKey] = useState('');
  const [payoutBank, setPayoutBank] = useState('');
  const [payoutAgency, setPayoutAgency] = useState('');
  const [payoutAccount, setPayoutAccount] = useState('');
  const [payoutDocument, setPayoutDocument] = useState('');
  const [saving, setSaving] = useState(false);
  const [isVimeoSettingsOpen, setIsVimeoSettingsOpen] = useState(false);
  const [isVdoSettingsOpen, setIsVdoSettingsOpen] = useState(false);
  const [vimeoSettings, setVimeoSettings] = useState({ client_id: '', client_secret: '', scope: 'public private upload video_files' });
  const [vdoSettings, setVdoSettings] = useState({ api_secret: '' });
  const [connectedProviders, setConnectedProviders] = useState({ vimeo: false, vdocipher: false });
  const [isDisconnectVimeoOpen, setIsDisconnectVimeoOpen] = useState(false);
  const [isDisconnectVdoOpen, setIsDisconnectVdoOpen] = useState(false);

  const [planSnapshot, setPlanSnapshot] = useState(() => (typeof planService.getSubscription === 'function' ? planService.getSubscription() : null));
  const [activePlanKey, setActivePlanKey] = useState(() => (typeof planService.getActivePlan === 'function' ? planService.getActivePlan() : null));
  const [planUsage, setPlanUsage] = useState({ loading: false, courses: null, modules: null, lessons: null, questionBanks: null, questions: null, storageBytes: null, storageText: null, truncated: false, error: null });
  const [payments, setPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  const normalizeMemberAreaUrl = (raw) => {
    const input = String(raw || '').trim();
    if (!input) return { ok: false, error: 'missing' };
    if (/\s/.test(input)) return { ok: false, error: 'invalid_whitespace' };
    if (input.includes('/')) return { ok: false, error: 'invalid_path' };

    const withProto = /^https?:\/\//i.test(input) ? input : `https://${input}`;
    let urlObj;
    try {
      urlObj = new URL(withProto);
    } catch (_) {
      return { ok: false, error: 'invalid_url' };
    }

    const host = (urlObj.hostname || '').toLowerCase();
    if (!host) return { ok: false, error: 'invalid_host' };

    if (!host.includes('.')) {
      const slug = host;
      if (!/^[a-z0-9-]{3,63}$/.test(slug) || slug.startsWith('-') || slug.endsWith('-')) {
        return { ok: false, error: 'invalid_slug' };
      }
      const fullHost = `${slug}.app.connektco.com`;
      return { ok: true, url: `https://${fullHost}`, host: fullHost };
    }

    return { ok: true, url: `https://${host}`, host };
  };

  const resolvedPlanKey = resolvePlanKey();
  const whitelabelAllowed = canUseWhitelabel(resolvedPlanKey) || String(user?.email || '').toLowerCase() === 'leonardonoronha12@gmail.com';
  const npsFeedbackAllowed = canUseNpsFeedback(resolvedPlanKey);

  const toHexColor = (input, fallback) => {
    const raw = String(input || '').trim()
    const fb = String(fallback || '#000000').trim()
    if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toUpperCase()
    const m = raw.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i)
    if (m) {
      const clamp = (n) => Math.max(0, Math.min(255, Number(n)))
      const r = clamp(m[1])
      const g = clamp(m[2])
      const b = clamp(m[3])
      const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase()
      return hex
    }
    if (/^#[0-9a-f]{6}$/i.test(fb)) return fb.toUpperCase()
    return '#000000'
  }

  const parseDateInput = (value) => {
    if (value == null || value === '') return null
    if (value instanceof Date) return isFinite(value.getTime()) ? value : null
    if (typeof value === 'number') {
      const d = new Date(value)
      return isFinite(d.getTime()) ? d : null
    }
    const raw = String(value).trim()
    if (!raw) return null
    const mIsoDate = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (mIsoDate) {
      const y = Number(mIsoDate[1])
      const mo = Number(mIsoDate[2])
      const da = Number(mIsoDate[3])
      if (Number.isFinite(y) && Number.isFinite(mo) && Number.isFinite(da)) {
        const d = new Date(y, Math.max(0, mo - 1), da)
        return isFinite(d.getTime()) ? d : null
      }
    }
    const mBr = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (mBr) {
      const da = Number(mBr[1])
      const mo = Number(mBr[2])
      const y = Number(mBr[3])
      if (Number.isFinite(y) && Number.isFinite(mo) && Number.isFinite(da)) {
        const d = new Date(y, Math.max(0, mo - 1), da)
        return isFinite(d.getTime()) ? d : null
      }
    }
    const d = new Date(raw)
    return isFinite(d.getTime()) ? d : null
  }

  const addMonthsClamped = (date, months) => {
    const d = date instanceof Date ? new Date(date.getTime()) : null
    if (!d || !isFinite(d.getTime())) return null
    const day = d.getDate()
    d.setDate(1)
    d.setMonth(d.getMonth() + Number(months || 0))
    const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    d.setDate(Math.min(day, maxDay))
    return d
  }

  const addYearsClamped = (date, years) => addMonthsClamped(date, Number(years || 0) * 12)

  const formatDateBR = (value) => {
    try {
      const d = parseDateInput(value)
      if (!d) return '—'
      const dd = String(d.getDate()).padStart(2, '0')
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const yyyy = d.getFullYear()
      return `${dd}/${mm}/${yyyy}`
    } catch (_) {
      return '—'
    }
  }

  const resolvePaymentDueDate = (payment) => {
    const p = payment && typeof payment === 'object' ? payment : {}
    const explicit =
      p.due_at ||
      p.dueAt ||
      p.expires_at ||
      p.expiresAt ||
      p.valid_until ||
      p.validUntil ||
      p.period_end ||
      p.periodEnd ||
      p.current_period_end ||
      p.currentPeriodEnd ||
      null
    const explicitDate = parseDateInput(explicit)
    if (explicitDate) return explicitDate

    const base = parseDateInput(p.paid_at || p.paidAt || p.created_at || p.createdAt || null)
    if (!base) return null
    const cycle = String(p.cycle || '').trim().toLowerCase()
    if (cycle === 'anual' || cycle === 'annual' || cycle === 'year' || cycle === 'yearly') return addYearsClamped(base, 1)
    return addMonthsClamped(base, 1)
  }
  const formatDateTimeBR = (iso) => {
    try {
      if (!iso) return '—'
      const d = new Date(iso)
      if (!isFinite(d.getTime())) return '—'
      return d.toLocaleString('pt-BR')
    } catch (_) {
      return '—'
    }
  }

  const formatRelative = (iso) => {
    try {
      if (!iso) return '—'
      const t = new Date(iso).getTime()
      if (!isFinite(t)) return '—'
      const diff = Date.now() - t
      if (diff < 60 * 1000) return 'Agora mesmo'
      const mins = Math.floor(diff / 60000)
      if (mins < 60) return `Há ${mins} min`
      const hrs = Math.floor(mins / 60)
      if (hrs < 24) return `Há ${hrs} h`
      const days = Math.floor(hrs / 24)
      if (days === 1) return 'Ontem'
      return `Há ${days} dias`
    } catch (_) {
      return '—'
    }
  }

  useEffect(() => {
    try {
      setCurrentDeviceId(deviceSessionService.getOrCreateDeviceId())
    } catch (_) {}
  }, [])

  const refreshDevices = async () => {
    if (!user?.id) return
    const reqId = (devicesReqRef.current += 1)
    setDevicesLoading(true)
    try {
      const r = await deviceSessionService.getDeviceAccessState()
      if (reqId !== devicesReqRef.current) return
      if (!r?.ok) {
        setDeviceAccess({ registered: { desktop: null, mobile: null }, pending: null })
        return
      }
      setDeviceAccess(r.state || { registered: { desktop: null, mobile: null }, pending: null })
    } catch (e) {
      if (reqId !== devicesReqRef.current) return
      const msg = String(e?.message || '').toLowerCase()
      if (msg.includes('abort')) return
      setDeviceAccess({ registered: { desktop: null, mobile: null }, pending: null })
      toast({ title: 'Erro ao carregar dispositivos', description: e?.message || String(e), duration: 6000 })
    } finally {
      if (reqId !== devicesReqRef.current) return
      setDevicesLoading(false)
    }
  }
  const formatBytes = (bytes) => {
    const n = Number(bytes);
    if (!isFinite(n) || n < 0) return '—';
    if (n < 1024) return `${n} B`;
    const kb = n / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    const gb = mb / 1024;
    return `${gb.toFixed(2)} GB`;
  };

  const plansCatalog = {
    qa: {
      key: 'qa',
      name: 'Connekt QA Tester',
      description: 'Plano interno para o time de testes validar todos os recursos.',
      prices: { mensal: '1,00', anual: '1,00' },
      limits: { storageGb: 500, questionBankQuestions: 'unlimited', playerIntegrations: 'multi', whitelabel: true },
      features: [
        'Whitelabel completo (logo, cores e domínio)',
        'NPS e feedback em aulas',
        'Múltiplas integrações de player de vídeo',
        'Banco de questões ilimitado',
        'Armazenamento: 500 GB',
        'Acesso a todos os módulos do sistema',
      ],
    },
    teste: {
      key: 'teste',
      name: 'Connekt Teste',
      description: 'Plano de teste para validação de pagamentos.',
      prices: { mensal: '1,00', anual: '1,00' },
      limits: { storageGb: 1, questionBankQuestions: 50, playerIntegrations: 1, whitelabel: false },
      features: ['Cobrança simbólica para testes', 'Checkout real do gateway', 'Sem recursos de produção'],
    },
    start: {
      key: 'start',
      name: 'Connekt Start',
      description: 'Essencial para iniciar: crie, hospede e valide seus cursos.',
      prices: { mensal: '99,00', anual: '79,00' },
      limits: { storageGb: 5, questionBankQuestions: 200, playerIntegrations: 1, whitelabel: false },
      features: [
        'Sem NPS e feedback em aulas',
        '1 integração de player de vídeo',
        'Armazenamento: até 5 GB',
        'Banco de questões: até 200',
        'Whitelabel não incluído',
      ],
    },
    pro: {
      key: 'pro',
      name: 'Connekt Pro',
      description: 'Para crescimento e engajamento com organização avançada.',
      prices: { mensal: '299,00', anual: '249,00' },
      limits: { storageGb: 50, questionBankQuestions: 2000, playerIntegrations: 'multi', whitelabel: false },
      features: [
        'NPS e feedback em aulas',
        'Múltiplas integrações de player de vídeo',
        'Armazenamento: 50 GB',
        'Banco de questões: até 2.000',
        'Gestão completa de acesso de alunos',
      ],
    },
    premium: {
      key: 'premium',
      name: 'Connekt Premium (Whitelabel)',
      description: 'Branding completo, escalabilidade máxima e comunidade com monetização.',
      prices: { mensal: '599,00', anual: '499,00' },
      limits: { storageGb: 500, questionBankQuestions: 'unlimited', playerIntegrations: 'multi', whitelabel: true },
      features: [
        'Whitelabel completo (logo, cores e domínio)',
        'Suporte a múltiplos players de vídeo (prioritário)',
        'Armazenamento: 500 GB (ou ilimitado por uso justo)',
        'Banco de questões ilimitado',
        'Onboarding de alunos personalizado',
        'Suporte prioritário',
      ],
    },
  };

  useEffect(() => {
    if (activeTab !== 'Meu plano') return;
    try {
      if (typeof planService.getSubscription === 'function') setPlanSnapshot(planService.getSubscription());
      if (typeof planService.getActivePlan === 'function') setActivePlanKey(planService.getActivePlan());
    } catch (_) {}
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'Meu plano') return;
    if (!user?.id) return;
    let cancelled = false;

    const parseJsonMaybe = (v) => {
      if (!v) return null;
      if (typeof v === 'object') return v;
      if (typeof v !== 'string') return null;
      try { return JSON.parse(v); } catch (_) { return null; }
    };

    const getModulesFromRow = (row) => {
      const parsed = parseJsonMaybe(row?.modules);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.modules)) return parsed.modules;
        if (Array.isArray(parsed.items)) return parsed.items;
      }
      return [];
    };

    (async () => {
      setPlanUsage({ loading: true, courses: null, modules: null, lessons: null, questionBanks: null, questions: null, storageBytes: null, storageText: null, truncated: false, error: null });
      try {
        const { data: courseRows, error: courseErr, count: courseCount } = await supabase
          .from('courses')
          .select('id,modules', { count: 'exact' })
          .eq('user_id', user.id)
          .range(0, 999);
        if (courseErr) throw courseErr;

        const courses = Array.isArray(courseRows) ? courseRows : [];
        const truncatedCourses = typeof courseCount === 'number' ? courseCount > courses.length : false;

        let modulesTotal = 0;
        let lessonsTotal = 0;
        for (const r of courses) {
          const mods = getModulesFromRow(r);
          modulesTotal += Array.isArray(mods) ? mods.length : 0;
          for (const m of Array.isArray(mods) ? mods : []) {
            const lessons = Array.isArray(m?.lessons) ? m.lessons : [];
            lessonsTotal += lessons.length;
          }
        }

        const { data: bankRows, error: bankErr, count: bankCount } = await supabase
          .from('question_banks')
          .select('id,question_count,producer_external_id', { count: 'exact' })
          .eq('producer_external_id', user.id)
          .range(0, 999);
        let questionBanks = null;
        let questions = null;
        let truncatedBanks = false;
        if (!bankErr) {
          const banks = Array.isArray(bankRows) ? bankRows : [];
          truncatedBanks = typeof bankCount === 'number' ? bankCount > banks.length : false;
          questionBanks = typeof bankCount === 'number' ? bankCount : banks.length;
          questions = banks.reduce((acc, b) => acc + (Number(b?.question_count) || 0), 0);
        }

        const getFileSizeFromMeta = (meta) => {
          if (!meta) return null;
          const candidates = [
            meta.size,
            meta.contentLength,
            meta['content-length'],
            meta['Content-Length'],
            meta['contentLength'],
          ];
          for (const c of candidates) {
            const n = Number(c);
            if (isFinite(n) && n >= 0) return n;
          }
          return null;
        };

        const listAllFilesBytes = async (bucket, rootPath) => {
          const queue = [String(rootPath || '').replace(/\/+$/, '')];
          const visited = new Set();
          let total = 0;
          let scanned = 0;
          let truncated = false;
          while (queue.length > 0) {
            const prefix = queue.shift();
            if (visited.has(prefix)) continue;
            visited.add(prefix);
            const { data: items, error } = await supabase.storage
              .from(bucket)
              .list(prefix || '', { limit: 1000, offset: 0 });
            if (error) throw error;
            const arr = Array.isArray(items) ? items : [];
            for (const it of arr) {
              scanned += 1;
              if (scanned > 20000) { truncated = true; break; }
              const name = String(it?.name || '');
              const id = it?.id || null;
              const isFolder = !id && (!it?.metadata || Object.keys(it?.metadata || {}).length === 0);
              if (isFolder) {
                const nextPrefix = prefix ? `${prefix}/${name}` : name;
                queue.push(nextPrefix);
                continue;
              }
              const sz = getFileSizeFromMeta(it?.metadata);
              if (typeof sz === 'number') total += sz;
            }
            if (truncated) break;
          }
          return { bytes: total, truncated };
        };

        let storageBytes = null;
        let storageText = null;
        let truncatedStorage = false;
        try {
          const res = await listAllFilesBytes('courses-media', `users/${user.id}`);
          storageBytes = res.bytes;
          storageText = formatBytes(res.bytes);
          truncatedStorage = !!res.truncated;
        } catch (_) {
          storageBytes = null;
          storageText = null;
          truncatedStorage = false;
        }

        if (cancelled) return;
        setPlanUsage({
          loading: false,
          courses: typeof courseCount === 'number' ? courseCount : courses.length,
          modules: truncatedCourses ? null : modulesTotal,
          lessons: truncatedCourses ? null : lessonsTotal,
          questionBanks,
          questions,
          storageBytes,
          storageText,
          truncated: truncatedCourses || truncatedBanks || truncatedStorage,
          error: null,
        });
      } catch (e) {
        if (cancelled) return;
        setPlanUsage({ loading: false, courses: null, modules: null, lessons: null, questionBanks: null, questions: null, storageBytes: null, storageText: null, truncated: false, error: e?.message || String(e) });
      }
    })();

    return () => { cancelled = true; };
  }, [activeTab, user?.id]);

  useEffect(() => {
    if (activeTab !== 'Meu plano') return;
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      setPaymentsLoading(true);
      try {
        const isMissingColumn = (err) => {
          const msg = String(err?.message || err?.details || err || '').toLowerCase()
          const code = String(err?.code || '').toUpperCase()
          return code === 'PGRST204' || code === '42703' || (msg.includes('does not exist') && msg.includes('column')) || (msg.includes('schema cache') && msg.includes('could not find') && msg.includes('column'))
        }
        const selects = [
          'id,plan_slug,cycle,status,paid_at,created_at,due_at,expires_at,valid_until,period_end,current_period_end',
          'id,plan_slug,cycle,status,paid_at,created_at,expires_at,period_end,current_period_end',
          'id,plan_slug,cycle,status,paid_at,created_at,due_at',
          'id,plan_slug,cycle,status,paid_at,created_at',
        ]
        let data = []
        let lastErr = null
        for (const sel of selects) {
          const r = await supabase
            .from('payments')
            .select(sel)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(10)
          if (!r.error) { data = Array.isArray(r.data) ? r.data : []; lastErr = null; break }
          lastErr = r.error
          if (!isMissingColumn(r.error)) break
        }
        if (lastErr) throw lastErr
        if (!cancelled) setPayments(Array.isArray(data) ? data : []);
      } catch (_) {
        if (!cancelled) setPayments([]);
      } finally {
        if (!cancelled) setPaymentsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab, user?.id]);

  const vimeoRedirectUri = `${window.location.origin}/vimeo/callback`;

  const isAlunoView = typeof window !== 'undefined' && String(window.location.pathname || '').startsWith('/aluno/')

  const mapSubdomainStatusToUi = (payload) => {
    const state = String(payload?.state || '').toLowerCase()
    const reason = String(payload?.reason || '').toLowerCase()
    if (payload?.active === true || state === 'active') {
      return { state: 'active', title: 'Ativo', description: 'Pronto para acessar.' }
    }
    if (state === 'pending') {
      if (reason === 'dns_not_propagated') {
        return { state: 'pending', title: 'Aguardando DNS', description: 'A propagação ainda não terminou.' }
      }
      if (reason === 'ssl_or_deploy_pending') {
        return { state: 'pending', title: 'Ativando', description: 'Certificado/Deploy ainda em ativação.' }
      }
      return { state: 'pending', title: 'Ativando', description: 'Verificando disponibilidade do domínio.' }
    }
    if (state === 'error') {
      if (reason === 'not_pointing_to_app') {
        return { state: 'error', title: 'Não apontando', description: 'O domínio responde, mas não está servindo o app.' }
      }
      if (reason === 'invalid_host') {
        return { state: 'error', title: 'Inválido', description: 'Subdomínio/domínio inválido.' }
      }
      return { state: 'error', title: 'Erro', description: 'Não foi possível validar o domínio agora.' }
    }
    return { state: 'checking', title: 'Verificando', description: 'Checando disponibilidade do domínio.' }
  }

  const checkSubdomainStatus = async (host) => {
    try {
      const token = session?.access_token || ''
      const url = `/api/producer?type=domain_status&host=${encodeURIComponent(host)}`
      const r = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      const body = await r.json().catch(() => ({}))
      const ui = mapSubdomainStatusToUi(body)
      setSubdomainStatus(ui)
      return ui
    } catch (_) {
      const ui = { state: 'pending', title: 'Ativando', description: 'Verificação temporariamente indisponível.' }
      setSubdomainStatus(ui)
      return ui
    }
  }

  const startSubdomainStatusPolling = async (host) => {
    try {
      if (subdomainStatusTimerRef.current) clearInterval(subdomainStatusTimerRef.current)
    } catch (_) {}
    subdomainStatusTriesRef.current = 0
    setSubdomainStatus({ state: 'checking', title: 'Verificando', description: 'Checando disponibilidade do domínio.' })
    const tick = async () => {
      const tries = (subdomainStatusTriesRef.current += 1)
      const ui = await checkSubdomainStatus(host)
      if (ui.state === 'active' || tries >= 11520) {
        try {
          if (subdomainStatusTimerRef.current) clearInterval(subdomainStatusTimerRef.current)
        } catch (_) {}
        if (tries >= 11520 && ui.state !== 'active') {
          setSubdomainStatus({ state: 'pending', title: 'Aguardando', description: 'Pode levar até 48 horas para finalizar.' })
        }
      }
    }
    await tick()
    subdomainStatusTimerRef.current = setInterval(tick, 15000)
  }

  const allTabs = [
    { id: 'perfil', label: 'Perfil e conta', icon: null },
    { id: 'plano', label: 'Meu plano', icon: null },
    ...(whitelabelAllowed ? [{ id: 'whitelabel', label: 'White label', icon: null }] : []),
    { id: 'pagamentos', label: 'Pagamentos', icon: null },
    { id: 'integracoes', label: 'Integrações', icon: null },
    { id: 'dispositivos', label: 'Dispositivos', icon: null },
  ]

  const tabs = isAlunoView ? allTabs.filter((t) => t.id === 'perfil' || t.id === 'dispositivos') : allTabs

  const tabIdToLabel = isAlunoView
    ? { perfil: 'Perfil e conta', dispositivos: 'Dispositivos' }
    : {
        perfil: 'Perfil e conta',
        plano: 'Meu plano',
        ...(whitelabelAllowed ? { whitelabel: 'White label' } : {}),
        pagamentos: 'Pagamentos',
        integracoes: 'Integrações',
        dispositivos: 'Dispositivos',
      };

  useEffect(() => {
    const applyFromLocation = () => {
      try {
        const p = new URLSearchParams(window.location.search);
        const tab = p.get('tab');
        if (tab && tabIdToLabel[tab]) {
          setActiveTab(tabIdToLabel[tab]);
          return;
        }
      } catch (_) {}
    };
    applyFromLocation();
    window.addEventListener('popstate', applyFromLocation);
    return () => window.removeEventListener('popstate', applyFromLocation);
  }, [whitelabelAllowed, isAlunoView]);

  useEffect(() => {
    if (!isAlunoView) return
    if (activeTab === 'Perfil e conta' || activeTab === 'Dispositivos') return
    setActiveTab('Perfil e conta')
  }, [isAlunoView, activeTab])

  useEffect(() => {
    if (!whitelabelAllowed && activeTab === 'White label') {
      setActiveTab('Meu plano')
      toast({ title: 'Recurso indisponível', description: 'White label não está disponível no seu plano.', duration: 6000 })
    }
  }, [whitelabelAllowed, activeTab]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('profile_full_name,profile_phone,member_area_url,payout_enabled,payout_pix_key,payout_bank,payout_agency,payout_account,payout_document')
          .eq('user_id', user.id)
          .maybeSingle();
        if (cancelled) return;
        if (!error && data) {
          setProfileFullName(data.profile_full_name || userName || '');
          setProfilePhone(data.profile_phone || '');
          const memberAreaUrl = data.member_area_url || '';
          const normalizedMemberArea = normalizeSavedMemberAreaUrlForLink(memberAreaUrl);
          setSubdomainSavedUrl(normalizedMemberArea.url || '');
          setSubdomainInput(normalizedMemberArea.url || '');
          setPayoutEnabled(!!data.payout_enabled);
          setPayoutPixKey(data.payout_pix_key || '');
          setPayoutBank(data.payout_bank || '');
          setPayoutAgency(data.payout_agency || '');
          setPayoutAccount(data.payout_account || '');
          setPayoutDocument(data.payout_document || '');
        } else {
          setProfileFullName(userName || '');
        }
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return
    const meta = user?.user_metadata && typeof user.user_metadata === 'object' ? user.user_metadata : {}
    const readLocal = (k) => {
      try { return String(localStorage.getItem(k) || '') } catch (_) { return '' }
    }
    const u = String(user.id)
    const crm = String(meta.profile_crm || '').trim() || readLocal(`connekt_profile_crm:${u}`)
    const specialty = String(meta.profile_specialty || '').trim() || readLocal(`connekt_profile_specialty:${u}`)
    const institution = String(meta.profile_institution || '').trim() || readLocal(`connekt_profile_institution:${u}`)
    setProfileCrm(crm)
    setProfileSpecialty(specialty)
    setProfileInstitution(institution)
  }, [user?.id])

  useEffect(() => {
    if (!session?.access_token) return
    const host = normalizeSavedMemberAreaUrlForLink(subdomainSavedUrl).host
    if (!host) return
    startSubdomainStatusPolling(host)
    return () => {
      try {
        if (subdomainStatusTimerRef.current) clearInterval(subdomainStatusTimerRef.current)
      } catch (_) {}
    }
  }, [subdomainSavedUrl, session?.access_token]);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    (async () => {
      try {
        const meta = user?.user_metadata || {};
        const avatarPath = meta.avatar_path || meta.avatarPath || null;
        const avatarUrl = meta.avatar_url || meta.avatarUrl || null;
        if (avatarUrl && typeof avatarUrl === 'string') {
          if (active) setProfileAvatarUrl(avatarUrl);
          return;
        }
        if (avatarPath && typeof avatarPath === 'string') {
          const { data } = supabase.storage.from('courses-media').getPublicUrl(String(avatarPath));
          if (active) setProfileAvatarUrl(data?.publicUrl || '');
          return;
        }
        if (active) setProfileAvatarUrl('');
      } catch (_) {
        if (active) setProfileAvatarUrl('');
      }
    })();
    return () => { active = false; };
  }, [user?.id, user?.user_metadata]);

  useEffect(() => {
    try {
      const meta = user?.user_metadata || {};
      const wl = (meta.whitelabel && typeof meta.whitelabel === 'object')
        ? meta.whitelabel
        : ((meta.whiteLabel && typeof meta.whiteLabel === 'object') ? meta.whiteLabel : {});
      setWhitelabelBrandName(String(wl.name || wl.brandName || wl.appName || '').trim());
      setWhitelabelPrimaryColor(String(wl.primaryColor || wl.primary_color || '#0047BB').trim() || '#0047BB');
      setWhitelabelPrimaryHoverColor(String(wl.primaryHoverColor || wl.primary_hover_color || '#003399').trim() || '#003399');
      setWhitelabelSidebarFrom(String(wl.sidebarFrom || wl.sidebar_from || 'rgb(15, 6, 39)').trim() || 'rgb(15, 6, 39)');
      setWhitelabelSidebarTo(String(wl.sidebarTo || wl.sidebar_to || 'rgb(0, 0, 104)').trim() || 'rgb(0, 0, 104)');
      setWhitelabelLogoUrl(String(wl.logoUrl || wl.logo_url || '').trim());
      setWhitelabelLogoCompactUrl(String(wl.logoCompactUrl || wl.logo_compact_url || '').trim());
      setWhitelabelWelcomeEmailSubject(String(wl.welcomeEmailSubject || wl.welcome_email_subject || wl.welcomeSubject || 'Bem-vindo à nossa plataforma de cursos!').trim() || 'Bem-vindo à nossa plataforma de cursos!');
      setWhitelabelWelcomeEmailMessage(String(wl.welcomeEmailMessage || wl.welcome_email_message || wl.welcomeMessage || `Olá {nome}!\n\nSeja muito bem-vindo(a) à nossa plataforma de cursos médicos!\n\nVocê agora tem acesso a conteúdos exclusivos desenvolvidos por especialistas renomados. Explore nossos cursos e aprimore seus conhecimentos.\n\nEm caso de dúvidas, nossa equipe está sempre disponível para ajudá-lo.\n\nBons estudos!\n\n`).trimEnd());
    } catch (_) {}
  }, [user?.id, user?.user_metadata]);

  const uploadWhitelabelLogo = async (file, variant) => {
    if (!file || !user?.id) return;
    try {
      if (!file.type?.startsWith('image/')) {
        toast({ title: 'Arquivo inválido', description: 'Selecione uma imagem (JPG/PNG/WebP).', duration: 5000 });
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        toast({ title: 'Arquivo muito grande', description: 'Tamanho máximo: 2MB.', duration: 5000 });
        return;
      }
      const token = session?.access_token || (await (async () => {
        try {
          const { data } = await supabase.auth.getSession();
          return data?.session?.access_token || '';
        } catch (_) {
          return '';
        }
      })());
      if (!token) {
        toast({ title: 'Sessão inválida', description: 'Faça login novamente.', duration: 5000 });
        return;
      }
      setWhitelabelUploading(true);
      const qs = new URLSearchParams();
      qs.set('type', 'image');
      qs.set('bankId', 'whitelabel');
      qs.set('questionId', variant);
      qs.set('filename', file.name || 'logo.png');
      qs.set('contentType', file.type || 'image/png');
      const r = await fetch(`/api/upload-question-media?${qs.toString()}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast({ title: 'Erro ao enviar', description: String(body?.error || 'Falha no upload.'), duration: 6000 });
        return;
      }
      const url = String(body?.url || '').trim();
      if (!url) {
        toast({ title: 'Upload incompleto', description: 'URL não retornada.', duration: 6000 });
        return;
      }
      if (variant === 'logo') setWhitelabelLogoUrl(url);
      if (variant === 'logo_compact') setWhitelabelLogoCompactUrl(url);
      toast({ title: 'Logo enviado', description: 'Salve para aplicar no aluno.', duration: 4000 });
    } catch (err) {
      toast({ title: 'Erro ao enviar', description: err?.message || String(err), duration: 6000 });
    } finally {
      setWhitelabelUploading(false);
      try {
        if (variant === 'logo' && whitelabelLogoInputRef.current) whitelabelLogoInputRef.current.value = '';
        if (variant === 'logo_compact' && whitelabelLogoCompactInputRef.current) whitelabelLogoCompactInputRef.current.value = '';
      } catch (_) {}
    }
  };

  const handleSaveWhitelabel = async () => {
    if (!user?.id) return;
    setWhitelabelSaving(true);
    try {
      const meta = user?.user_metadata && typeof user.user_metadata === 'object' ? user.user_metadata : {};
      const next = {
        ...(meta || {}),
        whitelabel: {
          name: String(whitelabelBrandName || '').trim(),
          primaryColor: String(whitelabelPrimaryColor || '').trim(),
          primaryHoverColor: String(whitelabelPrimaryHoverColor || '').trim(),
          sidebarFrom: String(whitelabelSidebarFrom || '').trim(),
          sidebarTo: String(whitelabelSidebarTo || '').trim(),
          logoUrl: String(whitelabelLogoUrl || '').trim() || null,
          logoCompactUrl: String(whitelabelLogoCompactUrl || '').trim() || null,
          welcomeEmailSubject: String(whitelabelWelcomeEmailSubject || '').trim(),
          welcomeEmailMessage: String(whitelabelWelcomeEmailMessage || '').trim(),
        },
      };
      const { error } = await supabase.auth.updateUser({ data: next });
      if (error) throw error;
      toast({ title: 'White label salvo', description: 'Aplicado na área do aluno.', duration: 5000 });
    } catch (err) {
      toast({ title: 'Erro ao salvar', description: err?.message || String(err), duration: 6000 });
    } finally {
      setWhitelabelSaving(false);
    }
  };

  const handlePickAvatar = () => {
    if (avatarUploading) return;
    const el = avatarInputRef.current;
    if (el) el.click();
  };

  const handleAvatarFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    try {
      if (!file.type?.startsWith('image/')) {
        toast({ title: 'Arquivo inválido', description: 'Selecione uma imagem (JPG/PNG/WebP).', duration: 5000 });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: 'Arquivo muito grande', description: 'Tamanho máximo: 5MB.', duration: 5000 });
        return;
      }

      setAvatarUploading(true);
      const ext = (() => {
        const byMime = String(file.type || '').split('/')[1] || '';
        const clean = byMime.split('+')[0].toLowerCase();
        return clean || 'png';
      })();
      const rand = Math.random().toString(36).slice(2, 8);
      const objectPath = `users/${user.id}/profile/avatar_${Date.now()}_${rand}.${ext}`;
      const bucket = 'courses-media';

      const { error: upErr } = await supabase.storage.from(bucket).upload(objectPath, file, {
        upsert: true,
        contentType: file.type || 'image/png',
        cacheControl: '3600',
      });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(objectPath);
      const publicUrl = pub?.publicUrl || '';

      try {
        await supabase.auth.updateUser({ data: { avatar_path: objectPath, avatar_url: publicUrl || null } });
      } catch (_) {}

      setProfileAvatarUrl(publicUrl);
      toast({ title: 'Foto atualizada', description: 'Sua foto de perfil foi atualizada.', duration: 4000 });
    } catch (err) {
      toast({ title: 'Erro ao atualizar foto', description: err?.message || String(err), duration: 6000 });
    } finally {
      setAvatarUploading(false);
      try { if (avatarInputRef.current) avatarInputRef.current.value = ''; } catch (_) {}
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    (async () => {
      try {
        const [{ data: vimeoS }, { data: vdoS }] = await Promise.all([
          supabase.from('vimeo_settings').select('client_id,client_secret,scope').eq('user_id', user.id).maybeSingle(),
          supabase.from('vdocipher_settings').select('api_secret').eq('user_id', user.id).maybeSingle(),
        ]);
        if (!active) return;
        if (vimeoS) {
          setVimeoSettings({
            client_id: vimeoS.client_id || '',
            client_secret: vimeoS.client_secret || '',
            scope: vimeoS.scope || 'public private upload video_files',
          });
        }
        if (vdoS) setVdoSettings({ api_secret: vdoS.api_secret || '' });
      } catch (_) {}
    })();
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        let vdocipher = false;
        try { vdocipher = localStorage.getItem('connectedProvider.vdocipher') === 'true'; } catch (_) {}
        if (!user?.id) {
          if (active) setConnectedProviders({ vimeo: false, vdocipher });
          return;
        }
        const [{ data: vimeoData }, { data: vdoData }] = await Promise.all([
          supabase.from('vimeo_connections').select('id').eq('user_id', user.id).limit(1),
          supabase.from('vdocipher_connections').select('id').eq('user_id', user.id).limit(1),
        ]);
        const vimeoConnected = Array.isArray(vimeoData) && vimeoData.length > 0;
        const vdocipherConnected = Array.isArray(vdoData) && vdoData.length > 0;
        if (!vimeoConnected) {
          try { localStorage.removeItem('connectedProvider.vimeo'); } catch (_) {}
        } else {
          try { localStorage.setItem('connectedProvider.vimeo', 'true'); } catch (_) {}
        }
        if (vdocipherConnected) {
          vdocipher = true;
          try { localStorage.setItem('connectedProvider.vdocipher', 'true'); } catch (_) {}
        }
        if (active) setConnectedProviders({ vimeo: vimeoConnected, vdocipher });
      } catch (_) {
        let vdocipher = false;
        try { vdocipher = localStorage.getItem('connectedProvider.vdocipher') === 'true'; } catch (_) {}
        if (active) setConnectedProviders({ vimeo: false, vdocipher });
      }
    })();
    return () => { active = false; };
  }, [user?.id]);

  const saveVimeoSettings = async () => {
    if (!user?.id) return false;
    const payload = {
      user_id: user.id,
      client_id: String(vimeoSettings.client_id || ''),
      client_secret: String(vimeoSettings.client_secret || ''),
      redirect_uri: vimeoRedirectUri,
      scope: String(vimeoSettings.scope || 'public private upload video_files'),
    };
    const { error } = await supabase.from('vimeo_settings').upsert(payload, { onConflict: 'user_id' });
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, duration: 6000 });
      return false;
    }
    setVimeoSettings({ client_id: payload.client_id, client_secret: payload.client_secret, scope: payload.scope });
    toast({ title: 'Configurações Vimeo salvas', description: 'Você pode conectar agora.', duration: 5000 });
    return true;
  };

  const saveVdoSettings = async () => {
    if (!user?.id) return false;
    const payload = { user_id: user.id, api_secret: String(vdoSettings.api_secret || '') };
    const { error } = await supabase.from('vdocipher_settings').upsert(payload, { onConflict: 'user_id' });
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, duration: 6000 });
      return false;
    }
    setVdoSettings({ api_secret: payload.api_secret });
    toast({ title: 'Configurações VdoCipher salvas', description: 'Você pode conectar agora.', duration: 5000 });
    return true;
  };

  const handleConnectService = async (provider) => {
    if (!user?.id) return;
    const connectedCount = (connectedProviders.vimeo ? 1 : 0) + (connectedProviders.vdocipher ? 1 : 0);
    const isAlreadyConnected = provider === 'vimeo' ? !!connectedProviders.vimeo : (provider === 'vdocipher' ? !!connectedProviders.vdocipher : false);
    const allow = canConnectVideoProvider({
      planKey: resolvePlanKey(),
      alreadyConnectedCount: connectedCount,
      isAlreadyConnected,
    });
    if (!allow.ok) {
      toast({
        title: 'Limite do plano',
        description: 'Seu plano não permite adicionar mais integrações de player de vídeo.',
        duration: 6000,
      });
      return;
    }
    if (provider === 'vimeo') {
      const clientId = vimeoSettings.client_id;
      const clientSecret = vimeoSettings.client_secret;
      const scope = vimeoSettings.scope || 'public private upload video_files';
      if (!clientId || !clientSecret) {
        setIsVimeoSettingsOpen(true);
        toast({ title: 'Configuração do Vimeo', description: 'Defina seu Client ID e Client Secret.', duration: 5000 });
        return;
      }
      const state = Math.random().toString(36).slice(2);
      try { localStorage.setItem('vimeo_oauth_state', state); } catch (_) {}
      try { localStorage.setItem('vimeo_redirect_uri', vimeoRedirectUri); } catch (_) {}
      try { localStorage.setItem('vimeo_post_connect_next', '/configuracoes?tab=integracoes'); } catch (_) {}
      const url = `https://api.vimeo.com/oauth/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(vimeoRedirectUri)}&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(state)}`;
      window.location.href = url;
      return;
    }
    if (provider === 'vdocipher') {
      const apiSecret = vdoSettings.api_secret;
      if (!apiSecret) {
        setIsVdoSettingsOpen(true);
        toast({ title: 'Configuração do VdoCipher', description: 'Informe seu API Secret.', duration: 5000 });
        return;
      }
      if (!session?.access_token) {
        toast({ title: 'Sessão expirada', description: 'Faça login novamente.', duration: 5000 });
        return;
      }
      try {
        const { data, error } = await supabase.functions.invoke('vdocipher-connect', { body: {} });
        if (error) throw error;
        if (!data || data?.ok !== true) {
          toast({ title: 'Conexão VdoCipher', description: 'Falha ao validar a chave. Verifique o API Secret.', duration: 6000 });
          return;
        }
        try { localStorage.setItem('connectedProvider.vdocipher', 'true'); } catch (_) {}
        setConnectedProviders((prev) => ({ ...prev, vdocipher: true }));
        toast({ title: 'VdoCipher conectado', description: 'Integração concluída com sucesso.', duration: 5000 });
      } catch (e) {
        toast({ title: 'Conexão VdoCipher', description: e?.message || 'Erro inesperado.', duration: 6000 });
      }
    }
  };

  const handleDisconnectProvider = async (provider) => {
    if (!user?.id) return;
    try {
      if (provider === 'vimeo') {
        const { error } = await supabase.from('vimeo_connections').delete().eq('user_id', user.id);
        if (error) throw error;
        try { localStorage.removeItem('connectedProvider.vimeo'); } catch (_) {}
        setConnectedProviders((prev) => ({ ...prev, vimeo: false }));
        toast({ title: 'Vimeo desconectado', description: 'Você pode reconectar quando quiser.', duration: 5000 });
        return;
      }
      if (provider === 'vdocipher') {
        const { error } = await supabase.from('vdocipher_connections').delete().eq('user_id', user.id);
        if (error) throw error;
        try { localStorage.removeItem('connectedProvider.vdocipher'); } catch (_) {}
        setConnectedProviders((prev) => ({ ...prev, vdocipher: false }));
        toast({ title: 'VdoCipher desconectado', description: 'Você pode reconectar quando quiser.', duration: 5000 });
      }
    } catch (e) {
      toast({ title: 'Erro', description: e?.message || String(e), duration: 6000 });
    }
  };

  const handleAddSubdomain = async () => {
    if (!user?.id) return;
    const normalized = normalizeMemberAreaUrl(subdomainInput);
    if (!normalized.ok) {
      toast({ title: 'Subdomínio inválido', description: 'Digite um domínio válido (ex: meusite.com.br) ou um subdomínio (ex: meucurso).', duration: 6000 });
      return;
    }

    setSubdomainSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({ user_id: user.id, member_area_url: normalized.url }, { onConflict: 'user_id' });
      if (error) throw error;
      setSubdomainSavedUrl(normalized.url);
      setSubdomainInput(normalized.url);
      setSubdomainStatus({ state: 'checking', title: 'Verificando', description: 'Checando disponibilidade do domínio.' })
      toast({ title: 'Subdomínio salvo', description: normalized.host, duration: 5000 });
    } catch (e) {
      toast({ title: 'Erro ao salvar subdomínio', description: e?.message || String(e), duration: 6000 });
    } finally {
      setSubdomainSaving(false);
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        profile_full_name: profileFullName || null,
        profile_phone: profilePhone || null,
        payout_enabled: !!payoutEnabled,
        payout_pix_key: payoutPixKey || null,
        payout_bank: payoutBank || null,
        payout_agency: payoutAgency || null,
        payout_account: payoutAccount || null,
        payout_document: payoutDocument || null,
      };
      const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'user_id' });
      if (error) throw error;
      try {
        if (supabase?.auth?.updateUser) {
          await supabase.auth.updateUser({
            data: {
              ...(profileFullName ? { full_name: profileFullName } : {}),
              profile_crm: String(profileCrm || '').trim(),
              profile_specialty: String(profileSpecialty || '').trim(),
              profile_institution: String(profileInstitution || '').trim(),
            },
          });
        }
      } catch (_) {}
      try {
        const u = String(user.id)
        localStorage.setItem(`connekt_profile_crm:${u}`, String(profileCrm || ''))
        localStorage.setItem(`connekt_profile_specialty:${u}`, String(profileSpecialty || ''))
        localStorage.setItem(`connekt_profile_institution:${u}`, String(profileInstitution || ''))
      } catch (_) {}
      toast({ title: 'Salvo', description: 'Configurações atualizadas.', duration: 4000 });
    } catch (e) {
      toast({ title: 'Erro ao salvar', description: e?.message || String(e), duration: 6000 });
    } finally {
      setSaving(false);
    }
  };

  const handleUnregisterDeviceType = async (deviceType) => {
    if (!user?.id) return
    try {
      const r = await deviceSessionService.unregisterDeviceType({ deviceType })
      if (!r?.ok) throw new Error('Falha ao remover cadastro do dispositivo')
      await refreshDevices()
      toast({ title: 'Cadastro removido', description: 'O dispositivo precisará de aprovação para entrar novamente.', duration: 5000 })
    } catch (e) {
      toast({ title: 'Erro', description: e?.message || String(e), duration: 6000 })
    }
  }

  const handleRegisterThisDevice = async () => {
    if (!user?.id) return
    try {
      const r = await deviceSessionService.claimDevice({ userId: user.id })
      if (!r?.ok) throw new Error('Falha ao cadastrar este dispositivo')
      await refreshDevices()
      toast({ title: 'Dispositivo cadastrado', description: 'Este dispositivo foi cadastrado com sucesso.', duration: 5000 })
    } catch (e) {
      toast({ title: 'Erro', description: e?.message || String(e), duration: 6000 })
    }
  }

  const handleSignOutAll = async () => {
    if (!user?.id) return
    try {
      await deviceSessionService.clearActiveDevice({ userId: user.id })
    } catch (_) {}
    await deviceSessionService.signOutLocal()
  };

  useEffect(() => {
    if (activeTab !== 'Dispositivos') return
    if (!user?.id) return
    refreshDevices()
    return () => { try { devicesReqRef.current += 1 } catch (_) {} }
  }, [activeTab, user?.id, currentDeviceId])

  return (
    <div className="w-full min-h-screen bg-[#F8F9FA] p-8">
      <div className="max-w-[1200px] mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-[24px] font-bold text-[#1E1B39]">Configurações</h1>
            <p className="text-[14px] text-[#737780] mt-1">Gerencie sua conta da Connekt</p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className={`bg-[#0047BB] text-white px-4 py-2 rounded-[6px] text-[14px] font-medium transition-colors ${saving ? 'opacity-60 cursor-not-allowed' : 'hover:bg-[#003da0]'}`}
          >
            {saving ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-[#F6F5FA] p-1 rounded-full w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.label)}
              className={`px-4 py-2 rounded-full text-[12px] font-medium transition-colors ${
                activeTab === tab.label
                  ? 'bg-white text-[#0047BB] shadow-sm'
                  : 'text-[#737780] hover:text-[#1E1B39]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Main Content Card */}
        <div className="bg-white rounded-[8px] border border-[#E3E4E5] shadow-sm p-4 sm:p-8">
          {activeTab === 'Perfil e conta' && (
            <>
              <div className="mb-8">
                <h2 className="text-[18px] font-semibold text-[#1E1B39]">Perfil e Conta</h2>
                <p className="text-[14px] text-[#737780] mt-1">Gerencie suas informações pessoais e configurações da conta</p>
                <div className="h-[1px] bg-[#E3E4E5] mt-4" />
              </div>

              <div className="flex flex-col lg:flex-row gap-6 sm:gap-12">
                {/* Left Column - Profile Photo */}
                <div className="w-full lg:w-[200px] flex flex-col items-center">
                  <div className="relative w-24 h-24 sm:w-32 sm:h-32 mb-4">
                    <img
                      src={profileAvatarUrl || "/perfil rc.png"} 
                      alt="Profile"
                      className="w-full h-full rounded-full object-cover border-4 border-white shadow-lg"
                      onError={(e) => {
                        e.target.onerror = null; 
                        e.target.src = 'https://ui-avatars.com/api/?name=User&background=0D8ABC&color=fff';
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handlePickAvatar}
                    disabled={avatarUploading}
                    className="flex items-center justify-center gap-2 px-4 py-2 border border-[#0047BB] text-[#0047BB] rounded-[6px] text-[12px] font-medium hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full max-w-[240px]"
                  >
                    <div className="w-4 h-4 bg-[#0047BB] rounded-full flex items-center justify-center text-white text-[10px]">✓</div>
                    {avatarUploading ? 'Enviando…' : 'Alterar foto do perfil'}
                  </button>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarFileChange}
                  />
                </div>

                {/* Right Column - Form Fields */}
                <div className="flex-1 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[14px] text-[#1E1B39] font-medium">Nome completo</label>
                      <input
                        type="text"
                        value={profileFullName}
                        onChange={(e) => setProfileFullName(e.target.value)}
                        placeholder="Seu nome completo"
                        className="w-full px-3 py-2 border border-[#E3E4E5] rounded-[6px] text-[14px] focus:outline-none focus:border-[#0047BB] bg-[#F8FAFC]"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[14px] text-[#1E1B39] font-medium">E-mail</label>
                      <input
                        type="email"
                        value={userEmail}
                        readOnly
                        className="w-full px-3 py-2 border border-[#E3E4E5] rounded-[6px] text-[14px] focus:outline-none bg-[#F8FAFC] text-[#737780]"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[14px] text-[#1E1B39] font-medium">Telefone</label>
                      <input
                        type="tel"
                        value={profilePhone}
                        onChange={(e) => setProfilePhone(e.target.value)}
                        placeholder="(11) 99999-9999"
                        className="w-full px-3 py-2 border border-[#E3E4E5] rounded-[6px] text-[14px] focus:outline-none focus:border-[#0047BB] bg-[#F8FAFC]"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[14px] text-[#1E1B39] font-medium">CRM</label>
                      <input
                        type="text"
                        value={profileCrm}
                        onChange={(e) => setProfileCrm(e.target.value)}
                        placeholder="Digite seu CRM"
                        className="w-full px-3 py-2 border border-[#E3E4E5] rounded-[6px] text-[14px] focus:outline-none focus:border-[#0047BB] bg-[#F8FAFC]"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[14px] text-[#1E1B39] font-medium">Especialidade</label>
                      <input
                        type="text"
                        value={profileSpecialty}
                        onChange={(e) => setProfileSpecialty(e.target.value)}
                        placeholder="Digite sua especialidade"
                        className="w-full px-3 py-2 border border-[#E3E4E5] rounded-[6px] text-[14px] focus:outline-none focus:border-[#0047BB] bg-[#F8FAFC]"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[14px] text-[#1E1B39] font-medium">Instituição</label>
                      <input
                        type="text"
                        value={profileInstitution}
                        onChange={(e) => setProfileInstitution(e.target.value)}
                        placeholder="Digite sua instituição"
                        className="w-full px-3 py-2 border border-[#E3E4E5] rounded-[6px] text-[14px] focus:outline-none focus:border-[#0047BB] bg-[#F8FAFC]"
                      />
                    </div>
                  </div>

                  {!isAlunoView ? (
                    <div className="rounded-[8px] border border-[#E3E4E5] bg-[#F8FAFC] p-4">
                      <div className="text-[14px] font-semibold text-[#1E1B39]">Link de acesso do aluno</div>
                      <div className="text-[12px] text-[#737780] mt-1">Compartilhe este link para o aluno entrar no seu ambiente.</div>
                      <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={studentPortalLink}
                          className="w-full sm:flex-1 px-3 py-2 border border-[#E3E4E5] rounded-[6px] text-[12px] bg-white text-[#22252B]"
                        />
                        <button
                          type="button"
                          className="h-[36px] px-3 rounded-[6px] border border-[#E3E4E5] bg-white text-[12px] font-semibold text-[#22252B] w-full sm:w-auto whitespace-nowrap"
                          onClick={async () => {
                            try {
                              if (!studentPortalLink) return
                              await navigator.clipboard.writeText(studentPortalLink)
                              toast({ title: 'Copiado', description: 'Link copiado para a área de transferência.', duration: 4000 })
                            } catch (_) {
                              toast({ title: 'Erro', description: 'Não foi possível copiar o link.', duration: 4000, variant: 'destructive' })
                            }
                          }}
                        >
                          Copiar
                        </button>
                        <button
                          type="button"
                          className="h-[36px] px-3 rounded-[6px] bg-[#0047BB] text-white text-[12px] font-semibold w-full sm:w-auto whitespace-nowrap"
                          onClick={() => {
                            if (!studentPortalLink) return
                            window.open(studentPortalLink, '_blank', 'noopener,noreferrer')
                          }}
                        >
                          Abrir
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {/* Password Section */}
                  <div className="pt-6">
                    <h3 className="text-[14px] font-semibold text-[#1E1B39] mb-4">Alterar Senha</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[14px] text-[#1E1B39] font-medium">Senha atual</label>
                        <input
                          type="password"
                          placeholder="Digite o nome da categoria"
                          className="w-full px-3 py-2 border border-[#E3E4E5] rounded-[6px] text-[14px] focus:outline-none focus:border-[#0047BB] bg-[#F8FAFC]"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[14px] text-[#1E1B39] font-medium">Nova senha</label>
                        <input
                          type="password"
                          placeholder="Digite o nome da categoria"
                          className="w-full px-3 py-2 border border-[#E3E4E5] rounded-[6px] text-[14px] focus:outline-none focus:border-[#0047BB] bg-[#F8FAFC]"
                        />
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </>
          )}

          {activeTab === 'Meu plano' && (
            <>
              <div className="mb-8">
                <h2 className="text-[18px] font-semibold text-[#1E1B39]">Plano</h2>
                <p className="text-[14px] text-[#737780] mt-1">Gerencie seu plano de assinatura Connekt</p>
                <div className="h-[1px] bg-[#E3E4E5] mt-4" />
              </div>

              {/* Current Plan Card */}
              {(() => {
                const key = String(planSnapshot?.planKey || activePlanKey || '').trim().toLowerCase();
                const hasPlan = !!key;
                const plan = hasPlan ? (plansCatalog[key] || { key, name: key, description: '', prices: { mensal: '—', anual: '—' }, limits: {}, features: [] }) : null;
                const cycle = planSnapshot?.billingCycle === 'anual' ? 'anual' : 'mensal';
                const price = plan?.prices?.[cycle] || '—';
                const isTrial = hasPlan && String(planSnapshot?.status || '').toLowerCase() === 'trial';
                const activatedAt = hasPlan ? (planSnapshot?.activatedAt || null) : null;
                const expiresAt = hasPlan ? (planSnapshot?.expiresAt || null) : null;
                const statusLabel = !hasPlan ? 'Sem plano' : (isTrial ? 'Trial ativo' : ((planSnapshot?.status && String(planSnapshot.status).toLowerCase() === 'canceled') ? 'Cancelado' : 'Ativo'));
                const statusPill = !hasPlan ? 'bg-[#F3F4F6] text-[#6B7280]' : (isTrial ? 'bg-[#EFF6FF] text-[#0047BB]' : 'bg-[#FEF9C3] text-[#A16207]');
                return (
                  <div className={`${hasPlan ? 'bg-[#F8FAFC] border border-[#0047BB]' : 'bg-white border border-[#E3E4E5]'} rounded-[8px] p-6 mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-3 mb-2">
                        <h3 className={`text-[24px] font-bold break-words ${hasPlan ? 'text-[#0047BB]' : 'text-[#1E1B39]'}`}>{hasPlan ? plan.name : 'Nenhum plano ativo'}</h3>
                        <span className={`px-3 py-1 ${statusPill} text-[12px] font-medium rounded-full inline-flex items-center gap-2`}>
                          <span>🏆</span> {statusLabel}
                        </span>
                      </div>
                      <p className="text-[14px] text-[#737780]">{hasPlan ? (plan.description || '—') : 'Assine um plano para liberar recursos e limites de uso.'}</p>
                      <div className="mt-3 text-[12px] text-[#404040] flex flex-wrap gap-x-4 gap-y-1">
                        <span><span className="text-[#8F9299]">Ciclo:</span> <span className="font-medium">{cycle === 'anual' ? 'Anual' : 'Mensal'}</span></span>
                        <span><span className="text-[#8F9299]">Início:</span> <span className="font-medium">{formatDateBR(activatedAt)}</span></span>
                        <span><span className="text-[#8F9299]">Válido até:</span> <span className="font-medium">{formatDateBR(expiresAt)}</span></span>
                        <span><span className="text-[#8F9299]">Renovação:</span> <span className="font-medium">{hasPlan ? (planSnapshot?.autoRenew ? 'Automática' : 'Manual') : '—'}</span></span>
                      </div>
                    </div>
                    <div className="flex items-center gap-8 lg:border-l border-[#E3E4E5] lg:pl-8">
                      <div className="text-center">
                        <div className="flex items-baseline gap-1 justify-center">
                          <span className="text-[14px] text-[#1E1B39] font-medium">R$</span>
                          <span className="text-[32px] font-bold text-[#1E1B39]">{price}</span>
                        </div>
                        <p className="text-[12px] text-[#737780]">{cycle === 'anual' ? 'Por ano' : 'Por mês'}</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        {isLocalDev ? (
                          <button
                            onClick={async () => {
                              if (!user?.id) {
                                toast({ title: 'Faça login', description: 'Você precisa estar logado para testar.', duration: 6000 })
                                return
                              }
                              if (!hasPlan) return
                              try {
                                setTestEmailLoading(true)
                                const r = await supabase.functions.invoke('plan-notify', {
                                  body: { event: 'canceled', planKey: key, billingCycle: cycle, reason: 'Teste manual de email (cancelamento)' },
                                })
                                const ok = !!r?.data?.ok
                                const sent = !!r?.data?.sent
                                const skipped = !!r?.data?.skipped
                                const err = r?.data?.error || r?.error?.message || null
                                const details = r?.data?.details || null

                                if (!ok || !sent) {
                                  toast({
                                    title: 'Falha no teste',
                                    description: details ? `${String(err || 'Erro')}: ${String(details)}` : (err || 'Email não foi enviado (ver logs).'),
                                    duration: 9000,
                                  })
                                  return
                                }

                                toast({ title: 'Teste disparado', description: skipped ? 'Envio pulado (SendGrid não configurado).' : `Email enviado para ${userEmail}`, duration: 7000 })
                              } finally {
                                setTestEmailLoading(false)
                              }
                            }}
                            disabled={testEmailLoading}
                            className="text-[#0047BB] text-[14px] hover:text-[#003da0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
                          >
                            {testEmailLoading ? 'Enviando email de teste…' : 'Testar email de cancelamento'}
                          </button>
                        ) : null}
                        {hasPlan ? (
                          <button
                            onClick={() => setIsCancelModalOpen(true)}
                            className="text-[#737780] text-[14px] hover:text-[#1E1B39] transition-colors"
                          >
                            Cancelar
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              try {
                                window.history.pushState({}, '', '/planos')
                                window.dispatchEvent(new PopStateEvent('popstate'))
                              } catch (_) {}
                            }}
                            className="text-[#0047BB] text-[14px] font-medium hover:text-[#003da0] transition-colors text-left"
                          >
                            Ver planos
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {(() => {
                  const key = String(planSnapshot?.planKey || activePlanKey || '').trim().toLowerCase();
                  const hasPlan = !!key;
                  const plan = hasPlan ? (plansCatalog[key] || { key, name: key, description: '', prices: { mensal: '—', anual: '—' }, limits: {}, features: [] }) : { key: '', name: 'Sem plano', description: '', prices: { mensal: '—', anual: '—' }, limits: {}, features: [] };
                  const limits = plan?.limits || {};
                  const fmtLimit = (v, suffix = '') => {
                    if (v === 'unlimited') return 'Ilimitado';
                    if (v === 'multi') return 'Múltiplas';
                    if (typeof v === 'number') return `${v}${suffix}`;
                    if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
                    return '—';
                  };
                  return (
                    <>
                      <div className="bg-white rounded-[8px] border border-[#E3E4E5] p-6">
                        <div className="text-[14px] font-semibold text-[#1E1B39] mb-3">Detalhes do plano</div>
                        <ul className="space-y-2">
                          {(Array.isArray(plan.features) ? plan.features : []).map((f, idx) => (
                            <li key={idx} className="text-[12px] text-[#404040] flex items-start gap-2">
                              <span className="mt-1 inline-flex w-4 h-4 items-center justify-center rounded-full bg-[#E7EDFC] border border-[#D9E6FF]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#0047BB]" />
                              </span>
                              <span className="break-words">{f}</span>
                            </li>
                          ))}
                          {(Array.isArray(plan.features) ? plan.features : []).length === 0 && (
                            <li className="text-[12px] text-[#737780]">{hasPlan ? 'Sem detalhes disponíveis.' : 'Nenhum plano ativo.'}</li>
                          )}
                        </ul>
                      </div>
                      <div className="bg-white rounded-[8px] border border-[#E3E4E5] p-6">
                        <div className="text-[14px] font-semibold text-[#1E1B39] mb-3">Limites e recursos</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="rounded-[8px] border border-[#E3E4E5] bg-[#F8FAFC] p-3">
                            <div className="text-[11px] text-[#737780]">Armazenamento</div>
                            <div className="text-[14px] font-semibold text-[#1E1B39]">{fmtLimit(limits.storageGb, ' GB')}</div>
                          </div>
                          <div className="rounded-[8px] border border-[#E3E4E5] bg-[#F8FAFC] p-3">
                            <div className="text-[11px] text-[#737780]">Questões no banco</div>
                            <div className="text-[14px] font-semibold text-[#1E1B39]">{fmtLimit(limits.questionBankQuestions)}</div>
                          </div>
                          <div className="rounded-[8px] border border-[#E3E4E5] bg-[#F8FAFC] p-3">
                            <div className="text-[11px] text-[#737780]">Integrações de player</div>
                            <div className="text-[14px] font-semibold text-[#1E1B39]">{fmtLimit(limits.playerIntegrations)}</div>
                          </div>
                          <div className="rounded-[8px] border border-[#E3E4E5] bg-[#F8FAFC] p-3 sm:col-span-2">
                            <div className="text-[11px] text-[#737780]">Whitelabel</div>
                            <div className="text-[14px] font-semibold text-[#1E1B39]">{fmtLimit(limits.whitelabel)}</div>
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>

              <div className="bg-white rounded-[8px] border border-[#E3E4E5] p-6 mb-8">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <div className="text-[14px] font-semibold text-[#1E1B39]">Uso do plano</div>
                    <div className="text-[12px] text-[#737780]">Métricas calculadas a partir dos seus dados.</div>
                  </div>
                  {planUsage.loading && <div className="text-[12px] text-[#737780]">Atualizando…</div>}
                </div>
                {planUsage.error ? (
                  <div className="text-[12px] text-[#D92D20]">{planUsage.error}</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {(() => {
                      const key = String(planSnapshot?.planKey || activePlanKey || '').trim().toLowerCase();
                      const plan = key ? (plansCatalog[key] || {}) : {};
                      const limitGb = plan?.limits?.storageGb;
                      const limitBytes = typeof limitGb === 'number' ? limitGb * 1024 * 1024 * 1024 : null;
                      const storageHint = (() => {
                        if (planUsage.storageBytes === null) return null;
                        if (typeof limitBytes !== 'number' || limitBytes <= 0) return null;
                        const pct = Math.min(999, Math.max(0, Math.round((planUsage.storageBytes / limitBytes) * 100)));
                        return `${pct}%`;
                      })();
                      return [
                        { label: 'Armazenamento usado', value: planUsage.storageText, hint: storageHint || (planUsage.storageBytes === null ? '—' : null) },
                        { label: 'Cursos', value: planUsage.courses, hint: planUsage.truncated ? 'Parcial' : null },
                        { label: 'Módulos', value: planUsage.modules, hint: planUsage.modules === null && planUsage.truncated ? 'Parcial' : null },
                        { label: 'Aulas', value: planUsage.lessons, hint: planUsage.lessons === null && planUsage.truncated ? 'Parcial' : null },
                        { label: 'Bancos de questões', value: planUsage.questionBanks, hint: planUsage.questionBanks === null ? '—' : null },
                        { label: 'Questões', value: planUsage.questions, hint: planUsage.questions === null ? '—' : null },
                      ];
                    })().map((item) => (
                      <div key={item.label} className="rounded-[8px] border border-[#E3E4E5] bg-[#F8FAFC] p-3">
                        <div className="text-[11px] text-[#737780]">{item.label}</div>
                        <div className="flex items-end justify-between gap-2">
                          <div className="text-[18px] font-bold text-[#1E1B39]">
                            {item.value === null ? '—' : String(item.value)}
                          </div>
                          {item.hint ? <div className="text-[11px] text-[#8F9299]">{item.hint}</div> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Payment History Table */}
              <div className="border border-[#E3E4E5] rounded-[8px] overflow-hidden">
                <table className="w-full">
                  <thead className="bg-white border-b border-[#E3E4E5]">
                    <tr>
                      <th className="px-6 py-4 text-left text-[12px] font-semibold text-[#1E1B39]">Plano</th>
                      <th className="px-6 py-4 text-left text-[12px] font-semibold text-[#1E1B39]">Data do vencimento</th>
                      <th className="px-6 py-4 text-left text-[12px] font-semibold text-[#1E1B39]">Data do pagamento</th>
                      <th className="px-6 py-4 text-right text-[12px] font-semibold text-[#1E1B39]">Status</th>
                      <th className="px-6 py-4 text-right text-[12px] font-semibold text-[#1E1B39]">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E3E4E5]">
                    {paymentsLoading ? (
                      <tr className="bg-white">
                        <td className="px-6 py-6 text-[12px] text-[#737780]" colSpan={5}>Carregando histórico…</td>
                      </tr>
                    ) : (payments && payments.length > 0 ? (
                      payments.map((p) => {
                        const status = String(p?.status || '').toLowerCase();
                        const paid = status === 'paid' || status === 'pago' || status === 'success';
                        const refused = status === 'failed' || status === 'recusado' || status === 'canceled' || status === 'cancelado';
                        const label = paid ? 'Pago' : (refused ? 'Recusado' : 'Pendente');
                        const statusColor = paid ? 'bg-green-100 text-green-700' : (refused ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700');
                        const planKey = String(p?.plan_slug || '');
                        const planName = plansCatalog[planKey]?.name || planKey || '—';
                        const billingCycle = String(p?.cycle || '').trim().toLowerCase() === 'anual' ? 'anual' : 'mensal'
                        return (
                          <tr key={p.id} className="bg-white hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="text-[12px] text-[#737780]">Nome</span>
                                <span className="text-[14px] text-[#1E1B39]">{planName}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-[14px] text-[#1E1B39]">{formatDateBR(resolvePaymentDueDate(p))}</td>
                            <td className="px-6 py-4 text-[14px] text-[#1E1B39]">{formatDateBR(p.paid_at)}</td>
                            <td className="px-6 py-4 text-right">
                              <span className={`inline-block px-3 py-1 rounded-full text-[12px] font-medium ${statusColor}`}>
                                {label}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              {!paid ? (
                                <button
                                  type="button"
                                  className="h-9 px-3 rounded-[10px] bg-[#0047BB] text-white text-[12px] font-semibold hover:bg-[#003da0]"
                                  onClick={async () => {
                                    const preOpened = (() => {
                                      try { return window.open('about:blank', '_blank', 'noopener') } catch (_) { return null }
                                    })()
                                    try {
                                      if (!user?.id) {
                                        toast({ title: 'Faça login', description: 'Você precisa estar logado para efetuar o pagamento.', duration: 6000 })
                                        try { preOpened && preOpened.close && preOpened.close() } catch (_) {}
                                        return
                                      }
                                      const r = await planService.startCheckout(planKey, billingCycle, user, { redirect: false, forceNew: true })
                                      const url = String(r?.checkout_url || r?.checkoutUrl || '').trim()
                                      if (!r?.ok || !url) {
                                        try { preOpened && preOpened.close && preOpened.close() } catch (_) {}
                                        toast({ title: 'Falha ao iniciar pagamento', description: String(r?.error || 'Tente novamente.'), duration: 6000 })
                                        return
                                      }
                                      if (preOpened && typeof preOpened.location !== 'undefined') {
                                        try { preOpened.location.href = url } catch (_) {}
                                      } else {
                                        let opened = null
                                        try { opened = window.open(url, '_blank', 'noopener') } catch (_) { opened = null }
                                        if (!opened) {
                                          try { await navigator.clipboard.writeText(url) } catch (_) {}
                                          toast({ title: 'Pop-up bloqueado', description: 'Link copiado. Permita pop-ups para abrir o pagamento em nova aba.', duration: 7000 })
                                        }
                                      }
                                    } catch (e) {
                                      try { preOpened && preOpened.close && preOpened.close() } catch (_) {}
                                      toast({ title: 'Falha ao iniciar pagamento', description: e?.message || 'Tente novamente.', duration: 6000 })
                                    }
                                  }}
                                >
                                  Efetuar pagamento atrasado
                                </button>
                              ) : (
                                <span className="text-[12px] text-[#737780]">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr className="bg-white">
                        <td className="px-6 py-6 text-[12px] text-[#737780]" colSpan={5}>Nenhum pagamento encontrado.</td>
                      </tr>
                    ))}
                </tbody>
              </table>
              </div>
            </>
          )}

          {activeTab === 'White label' && (
            <>
              <div className="mb-8">
                <h2 className="text-[18px] font-semibold text-[#1E1B39]">White Label</h2>
                <p className="text-[14px] text-[#737780] mt-1">Personalize a identidade visual da plataforma</p>
                <div className="h-[1px] bg-[#E3E4E5] mt-4" />
              </div>

              {/* Logotipo Section */}
              <div className="mb-8">
                <h3 className="text-[14px] font-semibold text-[#1E1B39] mb-4">Logotipo</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[12px] text-[#737780]">Logo (sidebar)</label>
                    <input
                      ref={whitelabelLogoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadWhitelabelLogo(file, 'logo');
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => whitelabelLogoInputRef.current && whitelabelLogoInputRef.current.click()}
                      disabled={whitelabelUploading}
                      className="w-full border-2 border-dashed border-[#0047BB] rounded-[8px] bg-[#F8FAFC] h-[120px] flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed overflow-hidden"
                    >
                      {whitelabelLogoUrl ? (
                        <img src={whitelabelLogoUrl} alt="Logo" className="max-h-[92px] max-w-[92%] object-contain" />
                      ) : (
                        <>
                          <UploadCloud className="text-[#0047BB] mb-2" size={24} />
                          <p className="text-[12px] font-bold text-[#1E1B39]">
                            Arraste ou <span className="text-[#0047BB]">selecione clicando aqui</span>
                          </p>
                          <p className="text-[10px] text-[#737780] mt-1">Max 2 MB, formato: JPG ou PNG</p>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[12px] text-[#737780]">Logo (compacta)</label>
                    <input
                      ref={whitelabelLogoCompactInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadWhitelabelLogo(file, 'logo_compact');
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => whitelabelLogoCompactInputRef.current && whitelabelLogoCompactInputRef.current.click()}
                      disabled={whitelabelUploading}
                      className="w-full border-2 border-dashed border-[#0047BB] rounded-[8px] bg-[#F8FAFC] h-[120px] flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed overflow-hidden"
                    >
                      {whitelabelLogoCompactUrl ? (
                        <img src={whitelabelLogoCompactUrl} alt="Logo compacta" className="max-h-[92px] max-w-[92%] object-contain" />
                      ) : (
                        <>
                          <UploadCloud className="text-[#0047BB] mb-2" size={24} />
                          <p className="text-[12px] font-bold text-[#1E1B39]">
                            Arraste ou <span className="text-[#0047BB]">selecione clicando aqui</span>
                          </p>
                          <p className="text-[10px] text-[#737780] mt-1">Max 2 MB, formato: JPG ou PNG</p>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-[#F8FAFC] border border-[#E3E4E5] rounded-[8px] p-6 mb-8">
                <h3 className="text-[14px] font-semibold text-[#1E1B39] mb-4">Identidade visual</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[12px] text-[#737780]">Nome da marca</label>
                    <input
                      type="text"
                      value={whitelabelBrandName}
                      onChange={(e) => setWhitelabelBrandName(e.target.value)}
                      placeholder="Ex.: Minha Plataforma"
                      className="w-full px-3 py-2 border border-[#E3E4E5] rounded-[6px] text-[14px] focus:outline-none focus:border-[#0047BB] bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[12px] text-[#737780]">Cor primária</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={whitelabelPrimaryColor}
                        onChange={(e) => setWhitelabelPrimaryColor(e.target.value)}
                        placeholder="#0047BB"
                        className="flex-1 px-3 py-2 border border-[#E3E4E5] rounded-[6px] text-[14px] focus:outline-none focus:border-[#0047BB] bg-white"
                      />
                      <input
                        type="color"
                        value={toHexColor(whitelabelPrimaryColor, '#0047BB')}
                        onChange={(e) => setWhitelabelPrimaryColor(e.target.value)}
                        className="h-10 w-12 border border-[#E3E4E5] rounded-[6px] bg-white px-1"
                        aria-label="Cor primária"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[12px] text-[#737780]">Cor primária (hover)</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={whitelabelPrimaryHoverColor}
                        onChange={(e) => setWhitelabelPrimaryHoverColor(e.target.value)}
                        placeholder="#003399"
                        className="flex-1 px-3 py-2 border border-[#E3E4E5] rounded-[6px] text-[14px] focus:outline-none focus:border-[#0047BB] bg-white"
                      />
                      <input
                        type="color"
                        value={toHexColor(whitelabelPrimaryHoverColor, '#003399')}
                        onChange={(e) => setWhitelabelPrimaryHoverColor(e.target.value)}
                        className="h-10 w-12 border border-[#E3E4E5] rounded-[6px] bg-white px-1"
                        aria-label="Cor primária hover"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[12px] text-[#737780]">Sidebar (topo)</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={whitelabelSidebarFrom}
                        onChange={(e) => setWhitelabelSidebarFrom(e.target.value)}
                        placeholder="rgb(15, 6, 39)"
                        className="flex-1 px-3 py-2 border border-[#E3E4E5] rounded-[6px] text-[14px] focus:outline-none focus:border-[#0047BB] bg-white"
                      />
                      <input
                        type="color"
                        value={toHexColor(whitelabelSidebarFrom, '#0F0627')}
                        onChange={(e) => setWhitelabelSidebarFrom(e.target.value)}
                        className="h-10 w-12 border border-[#E3E4E5] rounded-[6px] bg-white px-1"
                        aria-label="Sidebar topo"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[12px] text-[#737780]">Sidebar (base)</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={whitelabelSidebarTo}
                        onChange={(e) => setWhitelabelSidebarTo(e.target.value)}
                        placeholder="rgb(0, 0, 104)"
                        className="flex-1 px-3 py-2 border border-[#E3E4E5] rounded-[6px] text-[14px] focus:outline-none focus:border-[#0047BB] bg-white"
                      />
                      <input
                        type="color"
                        value={toHexColor(whitelabelSidebarTo, '#000068')}
                        onChange={(e) => setWhitelabelSidebarTo(e.target.value)}
                        className="h-10 w-12 border border-[#E3E4E5] rounded-[6px] bg-white px-1"
                        aria-label="Sidebar base"
                      />
                    </div>
                  </div>
                  <div className="flex items-end justify-end">
                    <button
                      type="button"
                      disabled={whitelabelSaving || whitelabelUploading}
                      onClick={handleSaveWhitelabel}
                      className={`h-10 px-5 rounded-[6px] text-[14px] font-medium text-white transition-colors whitespace-nowrap ${whitelabelSaving || whitelabelUploading ? 'opacity-60 cursor-not-allowed bg-[#0047BB]' : 'bg-[#0047BB] hover:bg-[#003da0]'}`}
                    >
                      {whitelabelSaving ? 'Salvando…' : 'Salvar white label'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Subdomain Section */}
              <div className="bg-[#F8FAFC] border border-[#E3E4E5] rounded-[8px] p-6 mb-8">
                <h3 className="text-[14px] font-semibold text-[#1E1B39] mb-4">Criar Subdomínio Gratuito</h3>
                
                <div className="space-y-2 mb-2">
                  <label className="text-[12px] text-[#737780]">Subdomínio<span className="text-red-500">*</span></label>
                  <div className="flex gap-4">
                    <input 
                      type="text" 
                      placeholder="exemplodesubdominio.com.br"
                      value={subdomainInput}
                      onChange={(e) => setSubdomainInput(e.target.value)}
                      className="flex-1 px-3 py-2 border border-[#E3E4E5] rounded-[6px] text-[14px] focus:outline-none focus:border-[#0047BB] bg-white"
                    />
                    <button
                      type="button"
                      disabled={subdomainSaving || !subdomainInput.trim() || subdomainStatus.state === 'checking' || subdomainStatus.state === 'pending'}
                      onClick={handleAddSubdomain}
                      className={`bg-[#0047BB] text-white px-4 py-2 rounded-[6px] text-[14px] font-medium transition-colors whitespace-nowrap ${subdomainSaving || !subdomainInput.trim() || subdomainStatus.state === 'checking' || subdomainStatus.state === 'pending' ? 'opacity-60 cursor-not-allowed' : 'hover:bg-[#003da0]'}`}
                    >
                      {subdomainSaving ? 'Salvando…' : (subdomainStatus.state === 'checking' || subdomainStatus.state === 'pending' ? 'Verificando…' : 'Adicionar subdomínio')}
                    </button>
                  </div>
                </div>
                {subdomainSavedUrl ? (
                  <div className="mb-6 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={normalizeSavedMemberAreaUrlForLink(subdomainSavedUrl).url}
                        target="_blank"
                        rel="noreferrer"
                        className={`inline-flex items-center gap-2 text-[12px] hover:underline ${
                          subdomainStatus.state === 'active'
                            ? 'text-[#166534]'
                            : (subdomainStatus.state === 'error' ? 'text-[#B91C1C]' : 'text-[#B45309]')
                        }`}
                      >
                        Subdomínio configurado: {normalizeSavedMemberAreaUrlForLink(subdomainSavedUrl).host} <ExternalLink size={14} />
                      </a>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          subdomainStatus.state === 'active'
                            ? 'bg-[#DCFCE7] text-[#166534]'
                            : (subdomainStatus.state === 'error' ? 'bg-[#FEE2E2] text-[#B91C1C]' : 'bg-[#FFEDD5] text-[#B45309]')
                        }`}
                      >
                        {subdomainStatus.title || 'Verificando'}
                      </span>
                    </div>
                    {subdomainStatus.description ? (
                      <div
                        className={`text-[12px] ${
                          subdomainStatus.state === 'active'
                            ? 'text-[#166534]'
                            : (subdomainStatus.state === 'error' ? 'text-[#B91C1C]' : 'text-[#B45309]')
                        }`}
                      >
                        {subdomainStatus.description}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-[12px] text-[#737780] mb-6">Informe o subdomínio e clique em “Adicionar subdomínio”.</p>
                )}

                <div className="bg-[#EFF6FF] rounded-[6px] p-4 flex gap-3">
                  <Info size={20} className="text-[#0047BB] flex-shrink-0" />
                  <div>
                    <h4 className="text-[14px] font-bold text-[#0047BB] mb-1">Tempo de Propagação</h4>
                    <p className="text-[12px] text-[#737780] leading-relaxed">
                      A configuração DNS pode levar de 15 minutos a 48 horas para se propagar completamente. Durante este período, alguns usuários podem ainda ver a configuração antiga.
                    </p>
                  </div>
                </div>
              </div>

              {/* Welcome Email Section */}
              <div className="bg-[#F8FAFC] border border-[#E3E4E5] rounded-[8px] p-6">
                <h3 className="text-[14px] font-semibold text-[#1E1B39] mb-4">Email de boas-vindas</h3>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[12px] text-[#737780]">Assunto</label>
                    <input 
                      type="text" 
                      value={whitelabelWelcomeEmailSubject}
                      onChange={(e) => setWhitelabelWelcomeEmailSubject(e.target.value)}
                      className="w-full px-3 py-2 border border-[#E3E4E5] rounded-[6px] text-[14px] focus:outline-none focus:border-[#0047BB] bg-white"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[12px] text-[#737780]">Mensagem</label>
                    <textarea 
                      value={whitelabelWelcomeEmailMessage}
                      onChange={(e) => setWhitelabelWelcomeEmailMessage(e.target.value)}
                      className="w-full h-[250px] px-3 py-2 border border-[#E3E4E5] rounded-[6px] text-[14px] focus:outline-none focus:border-[#0047BB] bg-white resize-none"
                    />
                  </div>
                  <div className="flex items-end justify-end">
                    <button
                      type="button"
                      disabled={whitelabelSaving || whitelabelUploading}
                      onClick={handleSaveWhitelabel}
                      className={`h-10 px-5 rounded-[6px] text-[14px] font-medium text-white transition-colors whitespace-nowrap ${whitelabelSaving || whitelabelUploading ? 'opacity-60 cursor-not-allowed bg-[#0047BB]' : 'bg-[#0047BB] hover:bg-[#003da0]'}`}
                    >
                      {whitelabelSaving ? 'Salvando…' : 'Salvar email'}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'Pagamentos' && (
            <>
              <div className="mb-8">
                <h2 className="text-[18px] font-semibold text-[#1E1B39]">Pagamentos</h2>
                <p className="text-[14px] text-[#737780] mt-1">Preencha seus dados bancários para o recebimento de pagamentos</p>
                <div className="h-[1px] bg-[#E3E4E5] mt-4" />
              </div>

              <div className="bg-[#F8FAFC] border border-[#E3E4E5] rounded-[8px] p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-[14px] font-semibold text-[#1E1B39]">Recebimento</h3>
                    <p className="text-[12px] text-[#737780] mt-1">Ative para liberar vendas e recebimentos.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPayoutEnabled(v => !v)}
                    className={`w-12 h-7 rounded-full relative transition-colors ${payoutEnabled ? 'bg-[#0047BB]' : 'bg-[#E3E4E5]'} focus:outline-none focus:ring-2 focus:ring-[#0047BB]/30`}
                    aria-pressed={payoutEnabled}
                  >
                    <span className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${payoutEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[12px] text-[#737780]">Chave Pix</label>
                    <input
                      type="text"
                      value={payoutPixKey}
                      onChange={(e) => setPayoutPixKey(e.target.value)}
                      placeholder="CPF, CNPJ, email, telefone ou aleatória"
                      className="w-full px-3 py-2 border border-[#E3E4E5] rounded-[6px] text-[14px] focus:outline-none focus:border-[#0047BB] bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[12px] text-[#737780]">Documento (CPF/CNPJ)</label>
                    <input
                      type="text"
                      value={payoutDocument}
                      onChange={(e) => setPayoutDocument(e.target.value)}
                      placeholder="Somente números"
                      className="w-full px-3 py-2 border border-[#E3E4E5] rounded-[6px] text-[14px] focus:outline-none focus:border-[#0047BB] bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[12px] text-[#737780]">Banco</label>
                    <input
                      type="text"
                      value={payoutBank}
                      onChange={(e) => setPayoutBank(e.target.value)}
                      placeholder="Ex.: 001 - Banco do Brasil"
                      className="w-full px-3 py-2 border border-[#E3E4E5] rounded-[6px] text-[14px] focus:outline-none focus:border-[#0047BB] bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[12px] text-[#737780]">Agência</label>
                    <input
                      type="text"
                      value={payoutAgency}
                      onChange={(e) => setPayoutAgency(e.target.value)}
                      placeholder="0001"
                      className="w-full px-3 py-2 border border-[#E3E4E5] rounded-[6px] text-[14px] focus:outline-none focus:border-[#0047BB] bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[12px] text-[#737780]">Conta</label>
                    <input
                      type="text"
                      value={payoutAccount}
                      onChange={(e) => setPayoutAccount(e.target.value)}
                      placeholder="12345-6"
                      className="w-full px-3 py-2 border border-[#E3E4E5] rounded-[6px] text-[14px] focus:outline-none focus:border-[#0047BB] bg-white"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'Integrações' && (
            <>
              <div className="mb-8">
                <h2 className="text-[18px] font-semibold text-[#1E1B39]">Integrações</h2>
                <p className="text-[14px] text-[#737780] mt-1">Conecte sua plataforma com ferramentas externas</p>
                <div className="h-[1px] bg-[#E3E4E5] mt-4" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* VdoCipher Card */}
                <div className="border border-[#E3E4E5] rounded-[8px] p-6 flex flex-col h-full">
                  <div className="h-12 mb-4 flex items-center">
                    <img src="/icons/vdocipher-logo.svg" alt="VdoCipher" className="h-full object-contain" />
                  </div>
                  <p className="text-[14px] text-[#737780] mb-6 flex-grow">
                    Vdocipher, uma plataforma segura de hospedagem de vídeos, protege seus vídeos contra downloads.
                  </p>
                  
                  <div className="bg-[#F8FAFC] p-4 rounded-[6px] mb-6 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-medium text-[#1E1B39]">Conta:</span>
                      <span className="text-[12px] text-[#737780]">{connectedProviders.vdocipher ? 'Conectado' : 'Não conectado'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-medium text-[#1E1B39]">Email:</span>
                      <span className="text-[12px] text-[#737780]">{connectedProviders.vdocipher ? userEmail : '--------'}</span>
                    </div>
                  </div>

                  {connectedProviders.vdocipher ? (
                    <button
                      type="button"
                      onClick={() => setIsDisconnectVdoOpen(true)}
                      className="w-full text-[#0047BB] py-2 rounded-[6px] text-[14px] font-bold hover:bg-blue-50 transition-colors"
                    >
                      Desconectar
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsVdoSettingsOpen(true)}
                      className="w-full bg-[#EBF1FF] text-[#0047BB] py-2 rounded-[6px] text-[14px] font-medium hover:bg-[#dbeafe] transition-colors"
                    >
                      Conectar
                    </button>
                  )}
                </div>

                {/* Vimeo Card */}
                <div className="border border-[#E3E4E5] rounded-[8px] p-6 flex flex-col h-full">
                  <div className="h-12 mb-4 flex items-center">
                    <img src="/icons/vimeo-logo.svg" alt="Vimeo" className="h-full object-contain" />
                  </div>
                  <p className="text-[14px] text-[#737780] mb-6 flex-grow">
                    Ferramentas simples para qualquer empresa criar, gerir e compartilhar vídeos de qualidade.
                  </p>
                  
                  <div className="bg-[#F8FAFC] p-4 rounded-[6px] mb-6 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-medium text-[#1E1B39]">Conta:</span>
                      <span className="text-[12px] text-[#737780]">{connectedProviders.vimeo ? 'Conectado' : 'Não conectado'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-medium text-[#1E1B39]">Email:</span>
                      <span className="text-[12px] text-[#737780]">{connectedProviders.vimeo ? userEmail : '--------'}</span>
                    </div>
                  </div>

                  {connectedProviders.vimeo ? (
                    <button
                      type="button"
                      onClick={() => setIsDisconnectVimeoOpen(true)}
                      className="w-full text-[#0047BB] py-2 rounded-[6px] text-[14px] font-bold hover:bg-blue-50 transition-colors"
                    >
                      Desconectar
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsVimeoSettingsOpen(true)}
                      className="w-full bg-[#EBF1FF] text-[#0047BB] py-2 rounded-[6px] text-[14px] font-medium hover:bg-[#dbeafe] transition-colors"
                    >
                      Conectar
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === 'Dispositivos' && (
            <>
              <div className="mb-8">
                <h2 className="text-[18px] font-semibold text-[#1E1B39]">Meus Dispositivos</h2>
                <p className="text-[14px] text-[#737780] mt-1">Gerencie os dispositivos cadastrados na sua conta.</p>
                <div className="h-[1px] bg-[#E3E4E5] mt-4" />
              </div>

              <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-[8px] p-4 mb-8 flex gap-3">
                <Shield className="text-[#DC2626] flex-shrink-0" size={24} />
                <div>
                  <h3 className="text-[14px] font-bold text-[#DC2626] mb-1">Limite de acesso simultâneo</h3>
                  <p className="text-[12px] text-[#B91C1C]">
                    Sua conta permite apenas <strong>1 desktop e 1 mobile cadastrados</strong>.
                    A sessão expira após cerca de <strong>10 minutos sem atividade</strong>. Para trocar um dispositivo, envie uma solicitação e aprove em um dispositivo cadastrado.
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-[16px] font-semibold text-[#1E1B39]">Dispositivos cadastrados</h3>
                  <button
                    onClick={handleSignOutAll}
                    className="text-[#0047BB] text-[14px] font-medium hover:underline flex items-center gap-2"
                  >
                    <LogOut size={16} />
                    Sair
                  </button>
                </div>

                {devicesLoading ? (
                  <div className="text-[13px] text-[#737780]">Carregando dispositivos…</div>
                ) : (
                  (() => {
                    const info = deviceSessionService.getDeviceInfo()
                    const currentType = info?.type === 'mobile' ? 'mobile' : 'desktop'
                    const registered = deviceAccess?.registered || {}
                    const desktop = registered.desktop || {}
                    const mobile = registered.mobile || {}
                    const pending = deviceAccess?.pending || null
                    const canRegisterDesktop = currentType === 'desktop' && !desktop?.device_id
                    const canRegisterMobile = currentType === 'mobile' && !mobile?.device_id
                    const renderSlot = (slotType, slot, canRegister) => {
                      const isMobileSlot = slotType === 'mobile'
                      const slotId = String(slot?.device_id || '').trim()
                      const isCurrent = slotId && currentDeviceId && slotId === String(currentDeviceId)
                      return (
                        <div className="border border-[#E3E4E5] rounded-[8px] p-4 bg-white">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4 min-w-0">
                              <div className="w-12 h-12 bg-[#F1F5F9] rounded-full flex items-center justify-center text-[#64748B] flex-shrink-0">
                                {isMobileSlot ? <Smartphone size={24} /> : <Monitor size={24} />}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <div className="text-[14px] font-bold text-[#1E1B39]">{isMobileSlot ? 'Mobile' : 'Desktop'}</div>
                                  {isCurrent ? (
                                    <span className="bg-[#DCFCE7] text-[#166534] text-[10px] font-bold px-2 py-0.5 rounded-full">
                                      ESTE DISPOSITIVO
                                    </span>
                                  ) : null}
                                </div>
                                {slotId ? (
                                  <>
                                    <div className="text-[13px] text-[#1E1B39] mt-1 break-words">{slot?.label || 'Dispositivo'}</div>
                                    <div className="text-[12px] text-[#737780] mt-1">
                                      Última atividade: {formatRelative(slot?.last_seen_at)}
                                    </div>
                                    {slot?.expires_at ? (
                                      <div className="text-[12px] text-[#737780] mt-1">Expira em: {formatDateTimeBR(slot.expires_at)}</div>
                                    ) : null}
                                  </>
                                ) : (
                                  <div className="text-[12px] text-[#737780] mt-1">Nenhum dispositivo cadastrado.</div>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              {slotId ? (
                                <button
                                  type="button"
                                  onClick={() => handleUnregisterDeviceType(slotType)}
                                  className="text-[#DC2626] text-[12px] font-semibold hover:underline"
                                >
                                  Remover
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={!canRegister}
                                  onClick={handleRegisterThisDevice}
                                  className={`px-3 py-2 rounded-[8px] text-[12px] font-semibold transition-colors ${canRegister ? 'bg-[#0047BB] text-white hover:bg-[#003da0]' : 'bg-[#E5E7EB] text-[#6B7280] cursor-not-allowed'}`}
                                >
                                  Cadastrar este dispositivo
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    }
                    return (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {renderSlot('desktop', desktop, canRegisterDesktop)}
                          {renderSlot('mobile', mobile, canRegisterMobile)}
                        </div>

                        {pending?.device_id ? (
                          <div className="border border-[#E3E4E5] rounded-[8px] p-4 bg-white">
                            <div className="flex items-center justify-between gap-4">
                              <div className="min-w-0">
                                <div className="text-[14px] font-bold text-[#1E1B39]">Solicitação pendente</div>
                                <div className="text-[12px] text-[#737780] mt-1 break-words">{pending?.label || 'Novo dispositivo'}</div>
                                <div className="text-[12px] text-[#737780] mt-1">
                                  Tipo: {String(pending?.device_type || '').toLowerCase() === 'mobile' ? 'Mobile' : 'Desktop'} • Solicitado em: {formatDateTimeBR(pending?.requested_at)}
                                </div>
                              </div>
                              <div className="flex flex-col sm:flex-row gap-2">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await approveDeviceRequest?.()
                                    await refreshDevices()
                                  }}
                                  className="bg-[#0047BB] text-white px-3 py-2 rounded-[8px] text-[12px] font-semibold hover:bg-[#003da0] transition-colors"
                                >
                                  Aprovar
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await denyDeviceRequest?.()
                                    await refreshDevices()
                                  }}
                                  className="border border-[#E3E4E5] text-[#1E1B39] px-3 py-2 rounded-[8px] text-[12px] font-semibold hover:bg-[#F8FAFC] transition-colors"
                                >
                                  Recusar
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )
                  })()
                )}
              </div>
            </>
          )}
        </div>

      </div>




{isVimeoSettingsOpen && (
<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
  <div className="bg-white w-full max-w-[600px] rounded-[12px] shadow-xl animate-in fade-in zoom-in duration-200">
    <div className="flex items-center justify-between p-6 border-b border-[#E3E4E5]">
      <h2 className="text-[18px] font-bold text-[#1E1B39]">Configurações do Vimeo</h2>
      <button
        type="button"
        onClick={() => setIsVimeoSettingsOpen(false)}
        className="text-[#737780] hover:text-[#1E1B39] transition-colors"
        aria-label="Fechar"
      >
        <X size={20} />
      </button>
    </div>

    <div className="p-6 space-y-4">
      <div className="bg-[#F8FAFC] border border-[#E3E4E5] rounded-[8px] p-4 space-y-2">
        <div className="flex items-start gap-2">
          <Info size={18} className="text-[#0047BB] mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <div className="text-[13px] font-semibold text-[#1E1B39]">Como conectar</div>
            <div className="text-[12px] text-[#737780]">
              1) Crie um app no Vimeo (Developer) e copie o Client ID e Client Secret.
            </div>
            <div className="text-[12px] text-[#737780]">
              2) No app do Vimeo, registre esta Redirect URI exatamente como está abaixo.
            </div>
            <div className="text-[12px] text-[#737780]">
              3) Clique em “Salvar e Conectar” para autorizar e voltar automaticamente para a Connekt.
            </div>
            <div className="pt-1">
              <a
                href="https://developer.vimeo.com/apps"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[12px] text-[#0047BB] hover:underline"
              >
                Abrir Vimeo Developer Apps <ExternalLink size={14} />
              </a>
            </div>
          </div>
        </div>
      </div>
      <div>
        <label className="text-[12px] text-[#737780]">Client ID</label>
        <div className="text-[11px] text-[#737780]">Você encontra no painel do seu app no Vimeo.</div>
        <input
          className="mt-1 w-full px-3 py-2 border border-[#E3E4E5] rounded-[6px] text-[14px] focus:outline-none focus:border-[#0047BB] bg-white"
          value={vimeoSettings.client_id}
          onChange={(e) => setVimeoSettings((s) => ({ ...s, client_id: e.target.value }))}
          placeholder="ex: 123abc..."
        />
      </div>
      <div>
        <label className="text-[12px] text-[#737780]">Client Secret</label>
        <div className="text-[11px] text-[#737780]">Mantenha em segurança. Usado para concluir a autorização.</div>
        <input
          type="password"
          className="mt-1 w-full px-3 py-2 border border-[#E3E4E5] rounded-[6px] text-[14px] focus:outline-none focus:border-[#0047BB] bg-white"
          value={vimeoSettings.client_secret}
          onChange={(e) => setVimeoSettings((s) => ({ ...s, client_secret: e.target.value }))}
          placeholder="ex: super-secreto"
        />
      </div>
      <div>
        <label className="text-[12px] text-[#737780]">Redirect URI</label>
        <div className="text-[11px] text-[#737780]">Cole essa URL nas configurações do app no Vimeo.</div>
        <input
          className="mt-1 w-full px-3 py-2 border border-[#E3E4E5] rounded-[6px] text-[14px] focus:outline-none bg-[#F8FAFC] text-[#737780]"
          value={vimeoRedirectUri}
          readOnly
        />
        <div className="mt-2">
          <button
            type="button"
            onClick={() => {
              try {
                navigator.clipboard.writeText(vimeoRedirectUri);
                toast({ title: 'Redirect URI copiada', description: vimeoRedirectUri, duration: 4000 });
              } catch (_) {
                toast({ title: 'Falha ao copiar', description: 'Copie manualmente a URL.', duration: 5000 });
              }
            }}
            className="px-3 py-2 rounded-[6px] border border-[#E3E4E5] text-[#1E1B39] text-[13px] hover:bg-[#F8FAFC] transition-colors"
          >
            Copiar Redirect URI
          </button>
        </div>
      </div>
    </div>

    <div className="p-6 border-t border-[#E3E4E5] flex justify-end gap-3">
      <button
        type="button"
        onClick={() => setIsVimeoSettingsOpen(false)}
        className="px-4 py-2 rounded-[6px] border border-[#E3E4E5] text-[#1E1B39] text-[14px] font-medium hover:bg-[#F8FAFC] transition-colors"
      >
        Cancelar
      </button>
      <button
        type="button"
        onClick={async () => {
          const ok = await saveVimeoSettings();
          if (ok) {
            setIsVimeoSettingsOpen(false);
            await handleConnectService('vimeo');
          }
        }}
        className="px-4 py-2 rounded-[6px] bg-[#0047BB] text-white text-[14px] font-medium hover:bg-[#003da0] transition-colors"
      >
        Salvar e Conectar
      </button>
    </div>
  </div>
</div>
)}

{isVdoSettingsOpen && (
<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
  <div className="bg-white w-full max-w-[600px] rounded-[12px] shadow-xl animate-in fade-in zoom-in duration-200">
    <div className="flex items-center justify-between p-6 border-b border-[#E3E4E5]">
      <h2 className="text-[18px] font-bold text-[#1E1B39]">Configurações do VdoCipher</h2>
      <button
        type="button"
        onClick={() => setIsVdoSettingsOpen(false)}
        className="text-[#737780] hover:text-[#1E1B39] transition-colors"
        aria-label="Fechar"
      >
        <X size={20} />
      </button>
    </div>

    <div className="p-6 space-y-4">
      <div className="bg-[#F8FAFC] border border-[#E3E4E5] rounded-[8px] p-4 space-y-2">
        <div className="flex items-start gap-2">
          <Info size={18} className="text-[#0047BB] mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <div className="text-[13px] font-semibold text-[#1E1B39]">Como conectar</div>
            <div className="text-[12px] text-[#737780]">
              1) No VdoCipher, gere/copiar o seu API Secret.
            </div>
            <div className="text-[12px] text-[#737780]">
              2) Cole aqui e clique em “Salvar e Conectar” para validar a chave automaticamente.
            </div>
            <div className="text-[12px] text-[#737780]">
              3) Depois de conectado, você pode usar upload e reprodução via VdoCipher dentro da plataforma.
            </div>
            <div className="pt-1 flex flex-wrap gap-3">
              <a
                href="https://www.vdocipher.com/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[12px] text-[#0047BB] hover:underline"
              >
                Abrir VdoCipher <ExternalLink size={14} />
              </a>
              <a
                href="https://www.vdocipher.com/docs/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[12px] text-[#0047BB] hover:underline"
              >
                Documentação <ExternalLink size={14} />
              </a>
            </div>
          </div>
        </div>
      </div>
      <div>
        <label className="text-[12px] text-[#737780]">API Secret</label>
        <div className="text-[11px] text-[#737780]">Não compartilhe essa chave. Ela é específica da sua conta.</div>
        <input
          type="password"
          className="mt-1 w-full px-3 py-2 border border-[#E3E4E5] rounded-[6px] text-[14px] focus:outline-none focus:border-[#0047BB] bg-white"
          value={vdoSettings.api_secret}
          onChange={(e) => setVdoSettings((s) => ({ ...s, api_secret: e.target.value }))}
          placeholder="ex: sk_live_..."
        />
      </div>
    </div>

    <div className="p-6 border-t border-[#E3E4E5] flex justify-end gap-3">
      <button
        type="button"
        onClick={() => setIsVdoSettingsOpen(false)}
        className="px-4 py-2 rounded-[6px] border border-[#E3E4E5] text-[#1E1B39] text-[14px] font-medium hover:bg-[#F8FAFC] transition-colors"
      >
        Cancelar
      </button>
      <button
        type="button"
        onClick={async () => {
          const ok = await saveVdoSettings();
          if (ok) {
            setIsVdoSettingsOpen(false);
            await handleConnectService('vdocipher');
          }
        }}
        className="px-4 py-2 rounded-[6px] bg-[#0047BB] text-white text-[14px] font-medium hover:bg-[#003da0] transition-colors"
      >
        Salvar e Conectar
      </button>
    </div>
  </div>
</div>
)}

{isDisconnectVimeoOpen && (
<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
  <div className="bg-white w-full max-w-[520px] rounded-[12px] shadow-xl animate-in fade-in zoom-in duration-200">
    <div className="flex items-center justify-between p-6 border-b border-[#E3E4E5]">
      <h2 className="text-[18px] font-bold text-[#1E1B39]">Desconectar Vimeo</h2>
      <button
        type="button"
        onClick={() => setIsDisconnectVimeoOpen(false)}
        className="text-[#737780] hover:text-[#1E1B39] transition-colors"
        aria-label="Fechar"
      >
        <X size={20} />
      </button>
    </div>
    <div className="p-6">
      <p className="text-[14px] text-[#737780]">Você pode reconectar quando quiser.</p>
    </div>
    <div className="p-6 border-t border-[#E3E4E5] flex justify-end gap-3">
      <button
        type="button"
        onClick={() => setIsDisconnectVimeoOpen(false)}
        className="px-4 py-2 rounded-[6px] border border-[#E3E4E5] text-[#1E1B39] text-[14px] font-medium hover:bg-[#F8FAFC] transition-colors"
      >
        Cancelar
      </button>
      <button
        type="button"
        onClick={async () => {
          setIsDisconnectVimeoOpen(false);
          await handleDisconnectProvider('vimeo');
        }}
        className="px-4 py-2 rounded-[6px] bg-[#DC2626] text-white text-[14px] font-medium hover:bg-[#b91c1c] transition-colors"
      >
        Desconectar
      </button>
    </div>
  </div>
</div>
)}

{isDisconnectVdoOpen && (
<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
  <div className="bg-white w-full max-w-[520px] rounded-[12px] shadow-xl animate-in fade-in zoom-in duration-200">
    <div className="flex items-center justify-between p-6 border-b border-[#E3E4E5]">
      <h2 className="text-[18px] font-bold text-[#1E1B39]">Desconectar VdoCipher</h2>
      <button
        type="button"
        onClick={() => setIsDisconnectVdoOpen(false)}
        className="text-[#737780] hover:text-[#1E1B39] transition-colors"
        aria-label="Fechar"
      >
        <X size={20} />
      </button>
    </div>
    <div className="p-6">
      <p className="text-[14px] text-[#737780]">Você pode reconectar quando quiser.</p>
    </div>
    <div className="p-6 border-t border-[#E3E4E5] flex justify-end gap-3">
      <button
        type="button"
        onClick={() => setIsDisconnectVdoOpen(false)}
        className="px-4 py-2 rounded-[6px] border border-[#E3E4E5] text-[#1E1B39] text-[14px] font-medium hover:bg-[#F8FAFC] transition-colors"
      >
        Cancelar
      </button>
      <button
        type="button"
        onClick={async () => {
          setIsDisconnectVdoOpen(false);
          await handleDisconnectProvider('vdocipher');
        }}
        className="px-4 py-2 rounded-[6px] bg-[#DC2626] text-white text-[14px] font-medium hover:bg-[#b91c1c] transition-colors"
      >
        Desconectar
      </button>
    </div>
  </div>
</div>
)}

{/* Upgrade Modal */}
{isUpgradeModalOpen && (
<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
<div className="bg-white w-full max-w-[600px] rounded-[12px] shadow-xl animate-in fade-in zoom-in duration-200">
{/* Modal Header */}
<div className="flex items-center justify-between p-6 border-b border-[#E3E4E5]">
<h2 className="text-[18px] font-bold text-[#1E1B39]">Upgrade de plano</h2>
<button 
onClick={() => setIsUpgradeModalOpen(false)}
className="text-[#737780] hover:text-[#1E1B39] transition-colors"
>
<X size={20} />
</button>
</div>

{/* Modal Content */}
<div className="p-6 space-y-4">
{/* Plan Start (Current) */}
<div className="border border-[#0047BB] rounded-[8px] p-4 bg-white relative">
<div className="flex justify-between items-start">
<div>
<div className="flex items-center gap-2 mb-1">
<h3 className="text-[16px] font-bold text-[#0047BB]">Plano Start</h3>
<span className="px-2 py-0.5 bg-[#DCFCE7] text-[#166534] text-[10px] font-medium rounded-full">
● Plano atual
</span>
</div>
<p className="text-[14px] text-[#737780]">Aqui vai a descrição do plano</p>
</div>
<div className="flex items-start gap-3">
<div className="text-right">
<span className="text-[12px] text-[#1E1B39] font-medium mr-1">R$</span>
<span className="text-[20px] font-bold text-[#1E1B39]">97,00</span>
</div>
<ExternalLink size={16} className="text-[#737780] mt-1" />
</div>
</div>
{/* Connection Line Indicator (Visual only as per design) */}
<div className="absolute -left-[1px] top-1/2 w-[3px] h-8 bg-[#0047BB] rounded-r transform -translate-y-1/2"></div>
</div>

{/* Plan Pro */}
<button className="w-full border border-[#E3E4E5] rounded-[8px] p-4 bg-white hover:border-[#0047BB] transition-colors text-left group">
<div className="flex justify-between items-start">
<div>
<h3 className="text-[16px] font-bold text-[#1E1B39] mb-1 group-hover:text-[#0047BB] transition-colors">Plano Pro</h3>
<p className="text-[14px] text-[#737780]">Aqui vai a descrição do plano</p>
</div>
<div className="flex items-start gap-3">
<div className="text-right">
<span className="text-[12px] text-[#1E1B39] font-medium mr-1">R$</span>
<span className="text-[20px] font-bold text-[#1E1B39]">297,00</span>
</div>
<ExternalLink size={16} className="text-[#737780] mt-1" />
</div>
</div>
</button>

{/* Plan Premium */}
<button className="w-full border border-[#E3E4E5] rounded-[8px] p-4 bg-white hover:border-[#0047BB] transition-colors text-left group">
<div className="flex justify-between items-start">
<div>
<h3 className="text-[16px] font-bold text-[#1E1B39] mb-1 group-hover:text-[#0047BB] transition-colors">Plano Premium</h3>
<p className="text-[14px] text-[#737780]">Aqui vai a descrição do plano</p>
</div>
<div className="flex items-start gap-3">
<div className="text-right">
<span className="text-[12px] text-[#1E1B39] font-medium mr-1">R$</span>
<span className="text-[20px] font-bold text-[#1E1B39]">697,00</span>
</div>
<ExternalLink size={16} className="text-[#737780] mt-1" />
</div>
</div>
</button>

{/* Info Box */}
<div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-[6px] p-4 flex gap-3">
<Info size={20} className="text-[#0047BB] flex-shrink-0" />
<p className="text-[12px] text-[#0047BB] leading-relaxed">
A alteração do plano entra em vigor imediatamente, o pagamento é feito no momento da mudança do plano
</p>
</div>
</div>

{/* Modal Footer */}
<div className="p-6 border-t border-[#E3E4E5] flex justify-end gap-3">
<button 
onClick={() => setIsUpgradeModalOpen(false)}
className="px-4 py-2 border border-[#E3E4E5] text-[#1E1B39] rounded-[6px] text-[14px] font-medium hover:bg-gray-50 transition-colors"
>
Cancelar
</button>
<button className="px-4 py-2 bg-[#0047BB] text-white rounded-[6px] text-[14px] font-medium hover:bg-[#003da0] transition-colors"
>
Fazer upgrade
</button>
</div>
</div>
</div>
)}
      <CancelSubscriptionModal
        open={isCancelModalOpen}
        loading={cancelLoading}
        onClose={() => setIsCancelModalOpen(false)}
        onConfirm={async (reason) => {
          if (!user?.id) {
            toast({ title: 'Faça login', description: 'Você precisa estar logado para cancelar o plano.', duration: 6000 })
            return
          }
          try {
            setCancelLoading(true)
            const r = planService.cancelSubscription({ reason, userId: user.id })
            try { setPlanSnapshot(planService.getSubscription()) } catch (_) {}
            try { setActivePlanKey(planService.getActivePlan()) } catch (_) {}
            setIsCancelModalOpen(false)
            if (r?.ok) {
              try { toast({ title: 'Assinatura cancelada', description: 'Seu plano permanecerá ativo até o fim da validade.', duration: 6000 }) } catch (_) {}
            } else {
              try { toast({ title: 'Não foi possível cancelar', description: r?.error || 'Falha ao cancelar a assinatura.', duration: 6000 }) } catch (_) {}
            }
            try { await supabase.from('subscriptions_cancellations').insert({ user_id: user.id, reason }) } catch (_) {}
          } finally {
            setCancelLoading(false)
          }
        }}
      />
    </div>
  );
};
export default ConfiguracoesPage;
