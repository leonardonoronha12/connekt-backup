import React, { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '@/contexts/SupabaseAuthContext.jsx';
import { supabase } from '@/lib/supabaseClient.js';

const DashboardPage = () => {
  const [periodo, setPeriodo] = useState('diario');
  const [isFloatingGroupOpen, setIsFloatingGroupOpen] = useState(false);
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(false);
  const [onboardingAnim, setOnboardingAnim] = useState(null);
  const { user } = useAuth();
  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'Usuário';
  const [onboarding, setOnboarding] = useState({ profile: false, domain: false, payments: false, course: false, publish: false });
  const [salesRows, setSalesRows] = useState([]);

  // Verificar se o usuário chegou via confirmação de email
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('email_confirmed') === 'true') {
      setShowWelcomeBanner(true);
      // Remover o parâmetro da URL após 5 segundos
      setTimeout(() => {
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }, 5000);
    }
  }, []);

  const formatarMoeda = (valor) => {
    const n = Number(valor || 0);
    const value = isFinite(n) ? n : 0;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatarCentavos = (cents) => {
    const n = Number(cents || 0);
    const value = isFinite(n) ? n / 100 : 0;
    return formatarMoeda(value);
  };

  const normalizeText = (value) => String(value || '').trim().toLowerCase();

  const resolveMethodKey = (row) => {
    const raw = normalizeText(row?.payment_method || row?.paymentMethod || row?.method || row?.gateway_method || row?.brand);
    if (raw.includes('pix')) return 'pix';
    if (raw.includes('boleto') || raw.includes('billet')) return 'boleto';
    if (raw.includes('card') || raw.includes('credito') || raw.includes('credit') || raw.includes('visa') || raw.includes('master')) return 'card';
    return 'card';
  };

  const resolveStatusBucket = (row) => {
    const s = normalizeText(row?.status);
    if (s === 'paid' || s === 'aprovado' || s === 'approved' || s === 'succeeded' || s === 'captured') return 'approved';
    if (s === 'refunded' || s === 'reembolsado') return 'refunded';
    if (s === 'chargeback') return 'chargeback';
    if (s === 'canceled' || s === 'cancelled') return 'canceled';
    if (s === 'declined' || s === 'refused' || s === 'failed' || s === 'rejected' || s === 'denied' || s === 'not_authorized' || s === 'not authorized') return 'declined';
    return 'pending';
  };

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const [{ data: profileData }, { data: coursesData }] = await Promise.all([
          supabase
            .from('profiles')
            .select('profile_full_name,profile_phone,member_area_url,payout_enabled,payout_pix_key,payout_bank,payout_account')
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('courses')
            .select('id,status')
            .eq('user_id', user.id)
            .limit(50),
        ]);
        if (cancelled) return;
        const fullNameOk = !!(profileData?.profile_full_name || user?.user_metadata?.full_name || user?.user_metadata?.name);
        const phoneOk = !!profileData?.profile_phone;
        const profileOk = fullNameOk && phoneOk;
        const domainOk = !!profileData?.member_area_url;
        const paymentsOk = !!profileData?.payout_enabled && !!(profileData?.payout_pix_key || (profileData?.payout_bank && profileData?.payout_account));
        const courses = Array.isArray(coursesData) ? coursesData : [];
        const courseOk = courses.length > 0;
        const publishOk = courses.some(c => String(c?.status || '').toLowerCase() !== 'draft');
        setOnboarding({ profile: profileOk, domain: domainOk, payments: paymentsOk, course: courseOk, publish: publishOk });
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    let inFlight = false;
    const run = async () => {
      if (cancelled) return;
      if (inFlight) return;
      inFlight = true;
      try {
        const token = (await supabase.auth.getSession().catch(() => ({ data: null })))?.data?.session?.access_token || ''
        if (!token) throw new Error('missing_token')
        const r = await fetch(`/api/producer?type=sales&producerId=${encodeURIComponent(String(user.id))}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const body = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(String(body?.error || 'fetch_failed'))
        if (!cancelled) setSalesRows(Array.isArray(body?.data) ? body.data : []);
      } catch (_) {
        if (!cancelled) setSalesRows([]);
      } finally {
        inFlight = false;
      }
    };
    const onFocus = () => { run(); };
    run();
    try { window.addEventListener('focus', onFocus); } catch (_) {}
    const timer = window.setInterval(() => { run(); }, 15_000);
    return () => {
      cancelled = true;
      try { window.removeEventListener('focus', onFocus); } catch (_) {}
      try { window.clearInterval(timer); } catch (_) {}
    };
  }, [user?.id]);

  const dashboardAgg = useMemo(() => {
    const toDayKey = (d) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };
    const toLabelDDMM = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    const safeDate = (row) => {
      const raw = row?.created_at || row?.createdAt || null;
      const dt = raw ? new Date(raw) : null;
      return dt && isFinite(dt.getTime()) ? dt : null;
    };

    const totals = {
      approved: { count: 0, cents: 0 },
      refunded: { count: 0, cents: 0 },
      chargeback: { count: 0, cents: 0 },
    };

    const students = new Set();
    const methodAgg = {
      pix: { approved: 0, pending: 0, canceled: 0, total: 0, approvedCount: 0, totalCount: 0 },
      card: { approved: 0, pending: 0, canceled: 0, total: 0, approvedCount: 0, totalCount: 0 },
      boleto: { approved: 0, pending: 0, canceled: 0, total: 0, approvedCount: 0, totalCount: 0 },
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayBuckets = new Map();

    const startOfWeek = (d) => {
      const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const day = out.getDay();
      const diff = (day === 0 ? -6 : 1) - day;
      out.setDate(out.getDate() + diff);
      out.setHours(0, 0, 0, 0);
      return out;
    };
    const weekBuckets = new Map();
    const monthBuckets = new Map();

    for (const r of (salesRows || [])) {
      const bucket = resolveStatusBucket(r);
      const cents = Number(r?.amount_cents || 0);
      const amountCents = isFinite(cents) ? cents : 0;
      const dt = safeDate(r);
      const method = resolveMethodKey(r);

      if (bucket === 'approved') {
        totals.approved.count += 1;
        totals.approved.cents += amountCents;
        const buyerId = String(r?.buyer_id || r?.buyerId || '').trim();
        const email = String(r?.client_email || r?.clientEmail || '').trim().toLowerCase();
        const key = buyerId || email;
        if (key) students.add(key);
      } else if (bucket === 'refunded') {
        totals.refunded.count += 1;
        totals.refunded.cents += amountCents;
      } else if (bucket === 'chargeback') {
        totals.chargeback.count += 1;
        totals.chargeback.cents += amountCents;
      }

      const methodRow = methodAgg[method] || methodAgg.card;
      const cancelBucket = (bucket === 'canceled' || bucket === 'declined' || bucket === 'refunded' || bucket === 'chargeback') ? 'canceled' : bucket;
      if (cancelBucket === 'approved') {
        methodRow.approved += amountCents;
        methodRow.approvedCount += 1;
      } else if (cancelBucket === 'pending') {
        methodRow.pending += amountCents;
      } else {
        methodRow.canceled += amountCents;
      }
      methodRow.total += amountCents;
      methodRow.totalCount += 1;

      if (dt && bucket === 'approved') {
        const dayKey = toDayKey(dt);
        dayBuckets.set(dayKey, (dayBuckets.get(dayKey) || 0) + amountCents);

        const wk = startOfWeek(dt);
        const weekKey = toDayKey(wk);
        weekBuckets.set(weekKey, (weekBuckets.get(weekKey) || 0) + amountCents);

        const monthKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
        monthBuckets.set(monthKey, (monthBuckets.get(monthKey) || 0) + amountCents);
      }
    }

    const diario = [];
    for (let i = 13; i >= 0; i -= 1) {
      const d = new Date(today.getTime());
      d.setDate(d.getDate() - i);
      const key = toDayKey(d);
      const cents = dayBuckets.get(key) || 0;
      diario.push({ data: toLabelDDMM(d), valor: cents / 100 });
    }

    const semanal = [];
    const thisWeek = startOfWeek(today);
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(thisWeek.getTime());
      d.setDate(d.getDate() - i * 7);
      const key = toDayKey(d);
      const cents = weekBuckets.get(key) || 0;
      semanal.push({ data: toLabelDDMM(d), valor: cents / 100 });
    }

    const monthLabels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const year = today.getFullYear();
    const anual = monthLabels.map((label, idx) => {
      const key = `${year}-${String(idx + 1).padStart(2, '0')}`;
      const cents = monthBuckets.get(key) || 0;
      return { data: label, valor: cents / 100 };
    });

    const pct = (cur, prev) => {
      const c = Number(cur || 0);
      const p = Number(prev || 0);
      if (!(p > 0)) return c > 0 ? 100 : 0;
      return ((c - p) / p) * 100;
    };
    const formatPct = (n) => {
      const value = Number(n || 0);
      const sign = value > 0 ? '+' : '';
      return `${sign}${value.toFixed(2).replace('.', ',')}%`;
    };
    const sumLast = (arr, n) => arr.slice(-n).reduce((acc, it) => acc + Number(it?.valor || 0), 0);

    const dailyCur = sumLast(diario, 7);
    const dailyPrev = diario.slice(0, Math.max(0, diario.length - 7)).slice(-7).reduce((acc, it) => acc + Number(it?.valor || 0), 0);
    const weeklyCur = sumLast(semanal, 4);
    const weeklyPrev = semanal.slice(0, Math.max(0, semanal.length - 4)).slice(-4).reduce((acc, it) => acc + Number(it?.valor || 0), 0);
    const monthIdx = today.getMonth();
    const monthCur = anual[monthIdx]?.valor || 0;
    const monthPrev = monthIdx > 0 ? (anual[monthIdx - 1]?.valor || 0) : 0;

    const deltaByPeriodo = {
      diario: pct(dailyCur, dailyPrev),
      semanal: pct(weeklyCur, weeklyPrev),
      anual: pct(monthCur, monthPrev),
    };

    const meiosPagamento = [
      {
        tipo: 'PIX',
        conversao: `${Math.round(((methodAgg.pix.approvedCount || 0) / Math.max(1, methodAgg.pix.totalCount || 0)) * 100)}%`,
        emAnalise: formatarCentavos(methodAgg.pix.pending),
        aprovados: formatarCentavos(methodAgg.pix.approved),
        cancelados: formatarCentavos(methodAgg.pix.canceled),
        corFundo: '#DEFFFC',
      },
      {
        tipo: 'Cartão de crédito',
        conversao: `${Math.round(((methodAgg.card.approvedCount || 0) / Math.max(1, methodAgg.card.totalCount || 0)) * 100)}%`,
        emAnalise: formatarCentavos(methodAgg.card.pending),
        aprovados: formatarCentavos(methodAgg.card.approved),
        cancelados: formatarCentavos(methodAgg.card.canceled),
        corFundo: '#FAEFE0',
      },
      {
        tipo: 'Boleto',
        conversao: `${Math.round(((methodAgg.boleto.approvedCount || 0) / Math.max(1, methodAgg.boleto.totalCount || 0)) * 100)}%`,
        emAnalise: formatarCentavos(methodAgg.boleto.pending),
        aprovados: formatarCentavos(methodAgg.boleto.approved),
        cancelados: formatarCentavos(methodAgg.boleto.canceled),
        corFundo: '#F4F4F4',
      },
    ];

    return {
      totals,
      studentsCount: students.size,
      receitaTotalLabel: formatarCentavos(totals.approved.cents),
      stats: {
        alunos: { qtde: students.size, valor: formatarCentavos(totals.approved.cents), delta: '0,00%' },
        vendas: { qtde: totals.approved.count, valor: formatarCentavos(totals.approved.cents), delta: '0,00%' },
        reembolsadas: { qtde: totals.refunded.count, valor: formatarCentavos(totals.refunded.cents), delta: '0,00%' },
        chargeback: { qtde: totals.chargeback.count, valor: formatarCentavos(totals.chargeback.cents), delta: '0,00%' },
      },
      dadosGrafico: { diario, semanal, anual },
      meiosPagamento,
      aumentoPctRaw: deltaByPeriodo[periodo] || 0,
      aumentoPctLabel: formatPct(deltaByPeriodo[periodo] || 0),
    };
  }, [salesRows, periodo]);

  const navigateTo = (path) => {
    try {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (_) {
      window.location.assign(path);
    }
  };

  const items = [
    { id: 'profile', title: 'Perfil de usuário', desc: 'Preencha todas as informações do seu perfil de usuário', icon: '/laranja.svg', bg: '#FFEDCE', to: '/configuracoes?tab=perfil' },
    { id: 'domain', title: 'Domínio / Subdomínio', desc: 'Configure a url da área de membros da sua plataforma Connekt', icon: '/azul.svg', bg: '#E7EDFC', to: '/configuracoes?tab=whitelabel' },
    { id: 'payments', title: 'Pagamentos', desc: 'Preencha seus dados bancários para o recebimento de pagamentos.', icon: '/verde.svg', bg: '#E4FFF3', to: '/configuracoes?tab=pagamentos' },
    { id: 'course', title: 'Crie um curso', desc: 'Crie o seu primeiro curso online com a Connekt', icon: '/roxo.svg', bg: 'rgba(139, 97, 255, 0.10)', to: '/produtos/novo' },
    { id: 'publish', title: 'Publique seu curso', desc: 'Publique a venda do seu curso online, publique seu primeiro curso.', icon: '/amarelo.svg', bg: '#FFFCDE', to: '/cursos' },
  ];
  const doneCount = items.reduce((acc, it) => acc + (onboarding[it.id] ? 1 : 0), 0);
  const progressPct = Math.round((doneCount / items.length) * 100);
  const firstPending = items.find(it => !onboarding[it.id]) || null;

  const handleOnboardingAction = () => {
    if (firstPending) {
      setIsFloatingGroupOpen(false);
      setOnboardingAnim({ type: 'loading', title: 'Abrindo...', subtitle: firstPending.title || '' });
      window.setTimeout(() => {
        navigateTo(firstPending.to);
        setOnboardingAnim(null);
      }, 450);
      return;
    }
    setIsFloatingGroupOpen(false);
    setOnboardingAnim({ type: 'success', title: 'Onboarding concluído', subtitle: 'Sua conta está pronta para uso.' });
    window.setTimeout(() => setOnboardingAnim(null), 1200);
  };

  const debugSales = (() => {
    try {
      return new URLSearchParams(window.location.search || '').get('debugSales') === '1'
    } catch (_) {
      return false
    }
  })();

  return (
    <div className="min-h-screen min-h-[100dvh] overflow-y-auto bg-gray-50">
      <div className="max-w-[1180px] mx-auto pt-8 px-4 pb-8 space-y-[22px]">
        
        {/* Banner de Boas-vindas após confirmação de email */}
        {showWelcomeBanner && (
          <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-[10px] px-6 py-4 text-white shadow-lg animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-white bg-opacity-20 rounded-full p-2">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold">🎉 Email confirmado com sucesso!</h3>
                  <p className="text-sm opacity-90">Sua conta está ativa. Agora você pode aproveitar todos os recursos da plataforma!</p>
                </div>
              </div>
              <button
                onClick={() => setShowWelcomeBanner(false)}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        )}
        
        {/* Bloco A - Saudação + Card Finalize cadastro */}
        <div className="flex flex-col lg:flex-row gap-[22px]">
          {/* Card de boas-vindas */}
          <div className="flex-1 bg-[#E7EDFC] rounded-[10px] px-[42px] py-[22px]">
            <h1 className="text-lg font-semibold mb-2">
              Olá <span className="text-[#0047BB]">{displayName}</span> 👋
            </h1>
            <p className="text-base text-[#404040]">
              Seja bem vindo a maior plataforma de cursos de medicina do Brasil
            </p>
          </div>

        {/* Card Finalize cadastro */}
          <div className={`w-full lg:w-[254px] bg-gradient-to-b from-[#321A88] to-[#0D0439] rounded-[10px] px-[22px] py-3 text-white relative ${
            showWelcomeBanner ? 'ring-4 ring-yellow-400 ring-opacity-75 animate-bounce' : ''
          }`}>
            {showWelcomeBanner && (
              <div className="absolute -top-2 -right-2 bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded-full animate-pulse">
                PRÓXIMO PASSO!
              </div>
            )}
            <h3 className="text-sm font-medium mb-2">
              Finalize seu cadastro! 🔥
              {showWelcomeBanner && <span className="ml-1 animate-bounce">👈</span>}
            </h3>
            <p className="text-sm mb-4 opacity-90">
              {showWelcomeBanner 
                ? "Agora que seu email está confirmado, complete seu perfil para começar a vender!"
                : "Você precisa completar o seu cadastro antes de começar a vender."
              }
            </p>
            <button
              onClick={() => setIsFloatingGroupOpen(true)}
              className={`w-full h-[30px] bg-white text-[#0047BB] text-sm font-semibold rounded px-4 transition-all ${
                showWelcomeBanner 
                  ? 'hover:bg-yellow-100 hover:scale-105 animate-pulse' 
                  : 'hover:bg-gray-50'
              }`}
            >
              Ativar sua conta aqui!
            </button>
          </div>
        </div>

        {/* Bloco B - Cards de Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-[22px]">
          {/* Card Total de alunos */}
          <div className="bg-white rounded-[10px] shadow-[0_1px_4px_rgba(13,10,44,0.08)] px-[22px] py-8">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-xs text-[#9291A5] mb-1">Estatísticas</p>
                <p className="text-xs font-medium text-[#1E1B39]">Total de alunos</p>
              </div>
              <span className="bg-[#F1EDFF] text-[#331A88] text-xs font-medium px-2 py-1 rounded">
                {dashboardAgg.stats.alunos.delta}
              </span>
            </div>
            <div className="flex justify-between items-end">
              <span className="text-[28px] font-semibold">{dashboardAgg.stats.alunos.qtde.toLocaleString()}</span>
              <span className="text-sm font-medium">{dashboardAgg.stats.alunos.valor}</span>
            </div>
          </div>

          {/* Card Total de vendas */}
          <div className="bg-white rounded-[10px] shadow-[0_1px_4px_rgba(13,10,44,0.08)] px-[22px] py-8">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-xs text-[#9291A5] mb-1">Estatísticas</p>
                <p className="text-xs font-medium text-[#1E1B39]">Total de vendas</p>
              </div>
              <span className="bg-[#EAFFF0] text-[#34A853] text-xs font-medium px-2 py-1 rounded">
                {dashboardAgg.stats.vendas.delta}
              </span>
            </div>
            <div className="flex justify-between items-end">
              <span className="text-[28px] font-semibold">{dashboardAgg.stats.vendas.qtde.toLocaleString()}</span>
              <span className="text-sm font-medium">{dashboardAgg.stats.vendas.valor}</span>
            </div>
          </div>

          {/* Card Vendas Reembolsadas */}
          <div className="bg-white rounded-[10px] shadow-[0_1px_4px_rgba(13,10,44,0.08)] px-[22px] py-8">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-xs text-[#9291A5] mb-1">Estatísticas</p>
                <p className="text-xs font-medium text-[#1E1B39]">Vendas Reembolsadas</p>
              </div>
              <span className="bg-[#EAF2FF] text-[#0047BB] text-xs font-medium px-2 py-1 rounded">
                {dashboardAgg.stats.reembolsadas.delta}
              </span>
            </div>
            <div className="flex justify-between items-end">
              <span className="text-[28px] font-semibold">{dashboardAgg.stats.reembolsadas.qtde.toLocaleString()}</span>
              <span className="text-sm font-medium">{dashboardAgg.stats.reembolsadas.valor}</span>
            </div>
          </div>

          {/* Card Chargeback */}
          <div className="bg-white rounded-[10px] shadow-[0_1px_4px_rgba(13,10,44,0.08)] px-[22px] py-8">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-xs text-[#9291A5] mb-1">Estatísticas</p>
                <p className="text-xs font-medium text-[#1E1B39]">Chargeback</p>
              </div>
              <span className="bg-[#F3F3F3] text-[#414244] text-xs font-medium px-2 py-1 rounded">
                {dashboardAgg.stats.chargeback.delta}
              </span>
            </div>
            <div className="flex justify-between items-end">
              <span className="text-[28px] font-semibold">{dashboardAgg.stats.chargeback.qtde.toLocaleString()}</span>
              <span className="text-sm font-medium">{dashboardAgg.stats.chargeback.valor}</span>
            </div>
          </div>
        </div>

        {/* Bloco C e D - Gráfico + Meios de Pagamento */}
        <div className="flex flex-col xl:flex-row gap-[22px] xl:items-start">
          {/* Bloco C - Receita total (gráfico) */}
          <div className="flex-1 bg-white rounded-[10px] px-[22px] py-8">
            {/* Cabeçalho */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
              <div className="mb-4 sm:mb-0">
                <p className="text-sm text-[#9291A5] mb-1">Receita total</p>
                <p className="text-2xl font-semibold mb-2">{dashboardAgg.receitaTotalLabel}</p>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${dashboardAgg.aumentoPctRaw >= 0 ? 'bg-[#04CE00]' : 'bg-[#E53935]'}`}></div>
                  <span className={`text-xs font-semibold ${dashboardAgg.aumentoPctRaw >= 0 ? 'text-[#04CE00]' : 'text-[#E53935]'}`}>{dashboardAgg.aumentoPctLabel}</span>
                  <span className="text-xs text-[#9291A5]">AUMENTO DE VENDAS</span>
                </div>
              </div>

              {/* Segmented control */}
              <div className="bg-[#F6F5FA] rounded-lg p-1 flex">
                {['diario', 'semanal', 'anual'].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriodo(p)}
                    className={`px-4 py-2 text-xs font-medium rounded transition-all duration-300 ${
                      periodo === p
                        ? 'bg-[#0047BB] text-white'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                    aria-pressed={periodo === p}
                  >
                    {p === 'diario' ? 'Diária' : p === 'semanal' ? 'Semanal' : 'Anual'}
                  </button>
                ))}
              </div>
            </div>

            {/* Gráfico */}
            <div className="h-[399px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dashboardAgg.dadosGrafico[periodo]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="data" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#9291A5' }}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#9291A5' }}
                    tickFormatter={(value) => formatarMoeda(value)}
                  />
                  <Tooltip 
                    formatter={(value) => [formatarMoeda(value), 'Receita']}
                    labelStyle={{ color: '#1E1B39' }}
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="valor" 
                    stroke="#0047BB" 
                    strokeWidth={2}
                    dot={{ fill: '#0047BB', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: '#0047BB', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bloco D - Meios de Pagamento */}
          <div className="w-full xl:w-[270px] space-y-[22px]">
            {dashboardAgg.meiosPagamento.map((meio, index) => (
              <div key={index} className="bg-white rounded-[10px] shadow-[0_1px_4px_rgba(13,10,44,0.08)] px-[22px] py-8">
                {/* Cabeçalho com ícone */}
                <div className="flex items-center gap-3 mb-3">
                  <div 
                    className="w-7 h-7 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: meio.corFundo }}
                  >
                    {meio.tipo === 'PIX' && (
                      <svg width="16" height="17" viewBox="0 0 16 17" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="PIX">
                        <g clipPath="url(#clip0_606_43069)">
                          <path d="M3.52141 12.4403C3.8302 12.4414 4.13612 12.3801 4.42142 12.26C4.70672 12.14 4.96572 11.9636 5.18338 11.7409L7.58242 9.30284C7.66751 9.22036 7.78067 9.17431 7.89827 9.17431C8.01594 9.17431 8.12904 9.22036 8.2142 9.30284L10.6226 11.751C10.8406 11.9733 11.0998 12.1495 11.3853 12.2694C11.6707 12.3893 11.9767 12.4504 12.2855 12.4493H12.7586L9.71842 15.5376C9.49296 15.7673 9.22504 15.9495 8.9302 16.0739C8.63529 16.1982 8.31914 16.2622 7.99987 16.2622C7.6806 16.2622 7.36445 16.1982 7.06957 16.0739C6.77468 15.9495 6.50681 15.7673 6.28131 15.5376L3.22876 12.4403H3.52141ZM12.2855 3.81261C11.9768 3.81167 11.671 3.87294 11.3857 3.99289C11.1005 4.11285 10.8414 4.2891 10.6236 4.51145L8.21864 6.96064C8.13485 7.04559 8.02133 7.0933 7.903 7.0933C7.78467 7.0933 7.67114 7.04559 7.58736 6.96064L5.18832 4.522C4.97069 4.29935 4.71171 4.12288 4.4264 4.00282C4.14109 3.88277 3.83515 3.82153 3.52635 3.82266H3.22876L6.28131 0.72336C6.73713 0.260195 7.35529 0 7.99987 0C8.64445 0 9.26264 0.260195 9.71842 0.72336L12.7586 3.81211L12.2855 3.81261Z" fill="#34ABA1"/>
                          <path d="M0.712165 6.38415L2.52737 4.53884H3.52149C3.9575 4.53934 4.37521 4.71468 4.68468 5.02617L7.0837 7.46431C7.1906 7.57355 7.31767 7.66025 7.45767 7.71938C7.59767 7.77859 7.74778 7.80904 7.89935 7.80904C8.05098 7.80904 8.20109 7.77859 8.34102 7.71938C8.48102 7.66025 8.60815 7.57355 8.71505 7.46431L11.1234 5.01662C11.4329 4.7048 11.8508 4.52968 12.2866 4.5293H13.4651L15.2882 6.38214C15.744 6.8454 16 7.47362 16 8.12871C16 8.78381 15.744 9.41207 15.2882 9.87535L13.4651 11.7281H12.2856C11.8501 11.7281 11.4319 11.5523 11.1225 11.2408L8.71455 8.79216C8.49484 8.57892 8.20269 8.45992 7.89884 8.45992C7.59505 8.45992 7.30291 8.57892 7.08321 8.79216L4.68418 11.2303C4.37472 11.5418 3.957 11.7176 3.521 11.7176H2.52737L0.712165 9.87735C0.48639 9.648 0.307287 9.3757 0.185092 9.07606C0.0628951 8.77634 0 8.45511 0 8.13071C0 7.80631 0.0628951 7.48515 0.185092 7.18544C0.307287 6.88575 0.48639 6.61347 0.712165 6.38415Z" fill="#34ABA1"/>
                        </g>
                        <defs>
                          <clipPath id="clip0_606_43069">
                            <rect width="16" height="17" fill="white"/>
                          </clipPath>
                        </defs>
                      </svg>
                    )}
                    {meio.tipo === 'Cartão de crédito' && (
                      <svg width="16" height="10" viewBox="0 0 16 10" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Cartão de crédito">
                        <g clipPath="url(#clip0_606_43093)">
                          <path d="M5.83105 1.07031H10.1529V8.9343H5.83105V1.07031Z" fill="#FF5F00"/>
                          <path d="M6.10556 5.00184C6.10556 3.40405 6.84644 1.98684 7.98519 1.06981C7.14831 0.402911 6.09188 0 4.93937 0C2.20894 0 0 2.2369 0 5.00184C0 7.76671 2.20894 10.0037 4.93931 10.0037C6.09181 10.0037 7.14825 9.60076 7.98519 8.9338C6.84644 8.0307 6.10556 6.59962 6.10556 5.00184Z" fill="#EB001B"/>
                          <path d="M15.9842 5.00184C15.9842 7.76671 13.7753 10.0037 11.0449 10.0037C9.8924 10.0037 8.83596 9.60076 7.99902 8.9338C9.15152 8.01684 9.87871 6.59962 9.87871 5.00184C9.87871 3.40405 9.13777 1.98684 7.99902 1.06981C8.8359 0.402911 9.8924 0 11.0449 0C13.7753 0 15.9842 2.25082 15.9842 5.00184Z" fill="#F79E1B"/>
                        </g>
                        <defs>
                          <clipPath id="clip0_606_43093">
                            <rect width="16" height="10" fill="white"/>
                          </clipPath>
                        </defs>
                      </svg>
                    )}
                    {meio.tipo === 'Boleto' && (
                      <svg width="16" height="8" viewBox="0 0 16 8" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Boleto">
                        <g clipPath="url(#clip0_606_43118)">
                          <path fillRule="evenodd" clipRule="evenodd" d="M2.2124 0.222656H2.94762V8.22266H2.2124V0.222656ZM6.73536 0.222656H7.47058V8.22266H6.73536V0.222656ZM10.4967 0.222656H11.2319V8.22266H10.4967V0.222656ZM11.9928 0.222656H12.728V8.22266H11.9928V0.222656ZM13.5064 0.222656H14.2416V8.22266H13.5064V0.222656ZM8.23147 0.222656H9.72684V8.22266H8.23147V0.222656ZM3.71708 0.222656H5.96479V8.22266H3.71708V0.222656Z" fill="#6B7588"/>
                          <path fillRule="evenodd" clipRule="evenodd" d="M0.226562 4.64062H16.2266V5.83412H0.226562V4.64062Z" fill="#F5F7FA"/>
                        </g>
                        <defs>
                          <clipPath id="clip0_606_43118">
                            <rect width="16" height="8" fill="white"/>
                          </clipPath>
                        </defs>
                      </svg>
                    )}
                  </div>
                  <h4 className="text-xs font-medium">{meio.tipo}</h4>
                </div>

                {/* Linhas de informação */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-[#9291A5]">Conversão</span>
                      <span className="text-xs font-medium text-[#0047BB]">{meio.conversao}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-[#9291A5]">Em análise</span>
                      <span className="text-xs font-medium">{meio.emAnalise}</span>
                    </div>
                  </div>
                  
                  <div className="flex justify-between">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-[#9291A5]">Aprovados</span>
                      <span className="text-xs font-medium text-[#34A853]">{meio.aprovados}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-[#9291A5]">Cancelados</span>
                      <span className="text-xs font-medium">{meio.cancelados}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {debugSales && (
          <div className="bg-white rounded-[10px] px-[22px] py-6 border border-[#E3E4E5]">
            <div className="text-[12px] font-semibold text-[#1E1B39] mb-3">debugSales=1</div>
            <pre className="text-[11px] whitespace-pre-wrap break-words text-[#111827] bg-[#F9FAFB] border border-[#E5E7EB] rounded p-3 max-h-[420px] overflow-auto">
              {JSON.stringify({ salesRows: (salesRows || []).slice(0, 25), dashboardAgg }, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Grupo Flutuante do lado direito */}
      {isFloatingGroupOpen && (
        <div className="fixed inset-0 z-50">
          {/* Overlay para fechar ao clicar fora */}
          <div 
            className="absolute inset-0 backdrop-blur-[6px]"
            style={{ backgroundColor: '#0000001A' }}
            onClick={() => setIsFloatingGroupOpen(false)}
          ></div>
          
          {/* Backdrop para mobile */}
          <div className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden" onClick={() => setIsFloatingGroupOpen(false)}></div>
          
          {/* Painel flutuante do lado direito */}
          <div className="fixed md:absolute right-0 top-0 h-full w-full md:w-96 bg-white transform transition-transform duration-300 ease-in-out z-50 flex flex-col" style={{boxShadow: '-12px 22px 33.5px rgba(0, 0, 0, 0.15)'}}>
            
            {/* Header com gradiente */}
            <div className="px-4 md:px-8 py-8 md:py-11" style={{
              background: 'linear-gradient(137deg, #321A88 29%, #0D0439 100%), linear-gradient(141deg, #0047BB 0%, #023992 100%), linear-gradient(322deg, rgba(0, 71, 187, 0.20) 0%, #051134 100%)',
              boxShadow: '0px 1.4750956296920776px 4.425286769866943px rgba(13, 10, 44, 0.08)',
              overflow: 'hidden',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'flex-start',
              gap: '22px',
              display: 'flex'
            }}>
              {/* Estrutura do cabeçalho conforme especificação */}
              <div style={{
                alignSelf: 'stretch', 
                flexDirection: 'column', 
                justifyContent: 'center', 
                alignItems: 'flex-start', 
                gap: '12px', 
                display: 'flex'
              }}>
                <div className="text-lg md:text-xl" style={{
                  alignSelf: 'stretch', 
                  height: '37px', 
                  justifyContent: 'center', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  color: 'white', 
                  fontFamily: 'Inter', 
                  fontWeight: '600', 
                  wordWrap: 'break-word'
                }}>
                  Finalize seu cadastro! 🔥
                </div>
                <div style={{
                  alignSelf: 'stretch', 
                  justifyContent: 'flex-start', 
                  alignItems: 'center', 
                  gap: '8px', 
                  display: 'inline-flex'
                }}>
                  <div style={{flex: '1 1 0'}}>
                    <span className="text-sm md:text-base" style={{
                      color: 'white', 
                      fontFamily: 'Inter', 
                      fontWeight: '400', 
                      lineHeight: '26px', 
                      wordWrap: 'break-word'
                    }}>
                      Conclua todas as configurações para ativar sua conta da Connekt.
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Botão de fechar */}
              <button 
                onClick={() => setIsFloatingGroupOpen(false)}
                className="absolute top-4 right-4 text-white hover:text-gray-200 text-2xl"
              >
                ×
              </button>
            </div>

            {/* Conteúdo principal */}
            <div className="px-4 md:px-8 pb-6 md:pb-8 pt-6 md:pt-8 overflow-y-auto flex-1">
              {/* Barra de progresso */}
              <div className="mb-8">
                <p className="text-black text-sm font-normal leading-5 mb-4">Complete o onboarding ({doneCount} de {items.length} concluídas)</p>
                <div className="w-full h-2 bg-gray-200 rounded">
                  <div className="h-2 bg-[#2D5BFF] rounded" style={{ width: `${progressPct}%` }}></div>
                </div>
              </div>

              {/* Lista de itens */}
              <div className="space-y-6 mb-8">
                {items.map((it) => {
                  const done = !!onboarding[it.id];
                  return (
                    <div
                      key={it.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => { navigateTo(it.to); setIsFloatingGroupOpen(false); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { navigateTo(it.to); setIsFloatingGroupOpen(false); } }}
                      className="flex items-center p-4 bg-white rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                      style={{ boxShadow: '0px 0px 4.425286769866943px 2px rgba(13, 10, 44, 0.08)' }}
                    >
                      <div className="p-3 rounded-lg mr-3" style={{ backgroundColor: it.bg }}>
                        <img src={it.icon} alt={it.title} className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-[#1E1B39] text-xs font-medium leading-6">{it.title}</h3>
                        <p className="text-[#9291A5] text-xs font-normal leading-4">{it.desc}</p>
                      </div>
                      <div className="ml-5">
                        {done ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <path fillRule="evenodd" clipRule="evenodd" d="M2.25 12C2.25 6.61522 6.61522 2.25 12 2.25C17.3848 2.25 21.75 6.61522 21.75 12C21.75 17.3848 17.3848 21.75 12 21.75C6.61522 21.75 2.25 17.3848 2.25 12ZM15.6103 10.1859C15.8511 9.84887 15.773 9.38046 15.4359 9.1397C15.0989 8.89894 14.6305 8.97701 14.3897 9.31407L11.1543 13.8436L9.53033 12.2197C9.23744 11.9268 8.76256 11.9268 8.46967 12.2197C8.17678 12.5126 8.17678 12.9874 8.46967 13.2803L10.7197 15.5303C10.8756 15.6862 11.0921 15.7656 11.3119 15.7474C11.5316 15.7293 11.7322 15.6153 11.8603 15.4359L15.6103 10.1859Z" fill="#34C759"/>
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <path d="M9 18L15 12L9 6" stroke="#9291A5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Botão de ação */}
              <button
                type="button"
                onClick={handleOnboardingAction}
                className="w-full h-[42px] bg-[#0047BB] text-white px-6 rounded font-semibold text-sm hover:bg-[#023992] transition-colors mt-16 flex items-center justify-center"
              >
                {firstPending ? 'Continuar onboarding' : 'Onboarding concluído'}
              </button>
            </div>
          </div>
        </div>
      )}

      {onboardingAnim && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-[16px] shadow-xl border border-[#E3E4E5] px-8 py-7 flex flex-col items-center gap-3 animate-in fade-in zoom-in duration-200">
            {onboardingAnim?.type === 'loading' ? (
              <div className="w-12 h-12 rounded-full border-4 border-[#E3E4E5] border-t-[#0047BB] animate-spin" />
            ) : (
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-[#34C759]/20 animate-ping" />
                <div className="w-14 h-14 rounded-full bg-[#34C759]/10 flex items-center justify-center relative">
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M20 6L9 17L4 12" stroke="#34C759" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            )}
            <div className="text-[14px] font-semibold text-[#1E1B39]">{onboardingAnim?.title || ''}</div>
            {onboardingAnim?.subtitle ? (
              <div className="text-[12px] text-[#8F9299] text-center">{onboardingAnim.subtitle}</div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
