import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { planService } from '@/services/planService.js';
import { toast } from '@/hooks/use-toast.ts';
import CancelSubscriptionModal from '@/components/CancelSubscriptionModal.jsx';

const Feature = ({ children }) => (
  <li className="flex items-start gap-2">
    <span className="mt-1 inline-flex w-4 h-4 items-center justify-center rounded-full bg-[#E7EDFC] border border-[#D9E6FF]">
      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 20 20" fill="none" className="text-[#0047BB]">
        <path d="M16.667 5.833L8.3337 14.167L3.33366 9.167" stroke="#0047BB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
    <span className="text-[#1E1B39] text-sm break-words">{children}</span>
  </li>
);

const PlanCard = ({ name, priceMonthly, priceYearly, description, features, highlight, canCancel = true, isLoading = false, actionLabel, billing, containerStyle, onAction, onCancel }) => {
  const displayedPrice = billing === 'anual' ? priceYearly : priceMonthly;
  const isCancelDisabled = !!highlight && !canCancel
  const isDisabled = isLoading || isCancelDisabled

  return (
    <div 
      className={`bg-white rounded-[10px] shadow-[0_1px_4px_rgba(13,10,44,0.08)] border ${highlight ? 'border-[#D9E6FF]' : 'border-[#E3E4E5]'} p-6 w-full min-w-0 overflow-hidden`}
      style={containerStyle}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-inter text-[18px] leading-[24px] tracking-[0px] font-semibold not-italic text-[#0047BB]">{name}</h3>
          <p className="font-inter text-[14px] leading-[24px] tracking-[0px] font-normal not-italic text-[#737780]">{description}</p>
        </div>
        {highlight && (
          <span
            className="text-xs"
            style={{
              width: '111px',
              height: '30px',
              display: 'inline-flex',
              gap: '6px',
              opacity: 1,
              transform: 'rotate(0deg)',
              paddingTop: '6px',
              paddingRight: '16px',
              paddingBottom: '6px',
              paddingLeft: '16px',
              borderRadius: '54px',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: '#FDED72',
              backgroundColor: '#FFFBDC',
              color: '#E5B800',
              alignItems: 'center',
              justifyContent: 'center',
              boxSizing: 'border-box'
            }}
          >
            Meu plano
          </span>
        )}
      </div>

      <div className="mb-1">
        <div className="flex items-end gap-2">
          <span className="font-inter text-[28px] leading-[42px] tracking-[0px] font-semibold not-italic text-[#000000]">R$ {displayedPrice}</span>
        </div>
        <p className="font-inter text-[14px] leading-[24px] tracking-[0px] font-normal not-italic text-[#737780]">Por usuário e por mês</p>
      </div>

      <div className="mt-4 space-y-3">
        <button
          type="button"
          disabled={isDisabled}
          className={`font-inter text-[12px] leading-[20px] tracking-[0px] font-medium not-italic text-center rounded-[4px] w-full ${
            highlight
              ? (isCancelDisabled ? 'text-[#8F9299] border border-[#E3E4E5]' : 'text-[#D92D20] border border-[#D92D20]')
              : 'text-[#0047BB] border border-[#0047BB]'
          } ${isDisabled ? 'opacity-70 cursor-not-allowed' : ''}`}
          style={{
            height: '44px',
            gap: '8px',
            opacity: 1,
            transform: 'rotate(0deg)',
            paddingTop: '10px',
            paddingRight: '20px',
            paddingBottom: '10px',
            paddingLeft: '24px',
            borderRadius: '4px',
            borderWidth: '1px',
            backgroundColor: 'transparent',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box'
          }}
          onClick={highlight ? (isCancelDisabled ? undefined : onCancel) : onAction}
        >
          {isLoading ? (
            <>
              <span className="w-4 h-4 border-2 border-[#0047BB] border-t-transparent rounded-full animate-spin" />
              <span>Carregando…</span>
            </>
          ) : (
            (highlight ? (isCancelDisabled ? 'Plano cancelado' : 'Cancelar plano') : (actionLabel || 'Contratar plano'))
          )}
        </button>
      </div>

      <div className="mt-6">
        <h4 className="text-[#1E1B39] font-semibold mb-3">Recursos</h4>
        <ul className="space-y-3">
          {features.map((f, i) => (
            <Feature key={i}>{f}</Feature>
          ))}
        </ul>
      </div>
    </div>
  );
};

const PlanosPage = () => {
  const [billingCycle, setBillingCycle] = useState('mensal'); // 'mensal' | 'anual'
  const { user } = useAuth();
  const [activePlanKey, setActivePlanKey] = useState(() => planService.getActivePlan());
  const [subscription, setSubscription] = useState(() => (typeof planService.getSubscription === 'function' ? planService.getSubscription() : null));
  const [pendingPayment, setPendingPayment] = useState(() => (typeof planService.getPendingCheckout === 'function' ? planService.getPendingCheckout() : null));
  const checkoutWindowRef = useRef(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [actionLoadingPlanKey, setActionLoadingPlanKey] = useState(null);

  const subscriptionStatus = String(subscription?.status || '').toLowerCase()
  const subscriptionPlanKey = subscription?.planKey ? String(subscription.planKey) : null
  const subscriptionExpiresAtMs = (() => {
    try {
      if (!subscription?.expiresAt) return null
      const t = new Date(subscription.expiresAt).getTime()
      return isFinite(t) ? t : null
    } catch (_) {
      return null
    }
  })()
  const subscriptionNotExpired = subscriptionExpiresAtMs === null ? true : subscriptionExpiresAtMs > Date.now()
  const currentPlanKey = subscriptionPlanKey && subscriptionNotExpired ? subscriptionPlanKey : null
  const canCancelSubscription = currentPlanKey && subscriptionNotExpired && subscriptionStatus === 'active'

  const formatDateBR = (iso) => {
    try {
      const d = new Date(iso);
      if (!isFinite(d.getTime())) return '-';
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    } catch (_) {
      return '-';
    }
  };

  const refreshSubscription = () => {
    try {
      setActivePlanKey(planService.getActivePlan());
      if (typeof planService.getSubscription === 'function') {
        setSubscription(planService.getSubscription());
      }
      if (typeof planService.getPendingCheckout === 'function') {
        setPendingPayment(planService.getPendingCheckout());
      }
    } catch (_) {}
  };

  const cancelCurrentSubscription = async () => {
    if (!user?.id) {
      try { toast({ title: 'Faça login', description: 'Você precisa estar logado para cancelar o plano.', duration: 6000 }) } catch (_) {}
      return;
    }
    if (!canCancelSubscription) {
      try { toast({ title: 'Plano já cancelado', description: 'Não há uma assinatura ativa para cancelar.', duration: 5000 }) } catch (_) {}
      return
    }
    setIsCancelModalOpen(true);
  };
  // Fonte única de verdade para planos (fácil de alinhar com o documento)
  const plansData = {
    qa: {
      key: 'qa',
      name: 'Connekt QA Tester',
      description: 'Plano interno para o time de testes validar todos os recursos.',
      prices: { mensal: '1,00', anual: '1,00' },
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
      features: [
        'Cobrança simbólica para testes',
        'Checkout real do gateway',
        'Sem recursos de produção'
      ],
    },
    start: {
      key: 'start',
      name: 'Connekt Start',
      description: 'Essencial para iniciar: crie, hospede e valide seus cursos.',
      prices: { mensal: '99,00', anual: '79,00' },
      features: [
        'Sem NPS e feedback em aulas',
        '1 integração de player de vídeo',
        'Armazenamento: até 5 GB',
        'Banco de questões: até 200',
        'Whitelabel não incluído',
        'Onboarding sem personalização'
      ],
    },
    pro: {
      key: 'pro',
      name: 'Connekt Pro',
      description: 'Para crescimento e engajamento com organização avançada.',
      prices: { mensal: '299,00', anual: '249,00' },
      features: [
        'NPS e feedback em aulas',
        'Múltiplas integrações de player de vídeo',
        'Armazenamento: 50 GB',
        'Banco de questões: até 2.000',
        'Gestão completa de acesso de alunos',
        'Onboarding com mensagem de boas-vindas'
      ],
    },
    premium: {
      key: 'premium',
      name: 'Connekt Premium (Whitelabel)',
      description: 'Branding completo, escalabilidade máxima e comunidade com monetização.',
      prices: { mensal: '599,00', anual: '499,00' },
      features: [
        'Whitelabel completo (logo, cores e domínio)',
        'Suporte a múltiplos players de vídeo (prioritário)',
        'Armazenamento: 500 GB (ou ilimitado por uso justo)',
        'Banco de questões ilimitado',
        'Onboarding de alunos personalizado',
        'Suporte prioritário (mais canais)'
      ],
    },
  };

  const canUseQaPlan = (() => {
    try {
      return typeof planService.canUseTestPlanForUser === 'function' && planService.canUseTestPlanForUser(user)
    } catch (_) {
      return false
    }
  })();

  useEffect(() => {
    setActivePlanKey(planService.getActivePlan());
    refreshSubscription();
    async function fetchActivePlan() {
      if (!user?.id || !supabase) return;
      const USE_PROFILES_TABLE = import.meta.env.VITE_USE_PROFILES_TABLE === 'true'
      if (!USE_PROFILES_TABLE) return; // evitar chamadas quando desabilitado
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('active_plan')
          .eq('user_id', user.id)
          .maybeSingle();
        if (!error && data?.active_plan) setActivePlanKey(data.active_plan);
      } catch {
        // silencioso: mantém fallback do localStorage
      }
    }
    fetchActivePlan();
  }, []);

  useEffect(() => {
    const paymentId = (() => {
      try {
        const p = new URLSearchParams(window.location.search)
        return p.get('payment_id')
      } catch (_) {
        return null
      }
    })()
    if (!paymentId) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await planService.getPaymentById(paymentId)
        const payment = res?.payment
        const gatewayPaymentId = payment?.gateway_payment_id || null
        if (!cancelled && payment && gatewayPaymentId) {
          setPendingPayment({
            planKey: payment.plan_slug,
            billingCycle: payment.cycle,
            linkId: gatewayPaymentId,
            paymentId: payment.id,
          })
        }
      } catch (_) {}
      try {
        const p = new URLSearchParams(window.location.search)
        p.delete('payment_id')
        const next = window.location.pathname + (p.toString() ? `?${p.toString()}` : '') + window.location.hash
        window.history.replaceState({}, '', next)
      } catch (_) {}
    })()

    return () => { cancelled = true; }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const shouldSync = (() => {
      try {
        const p = new URLSearchParams(window.location.search || '')
        if (p.get('payment_id') || p.get('status') || p.get('link_id') || p.get('session_id')) return true
      } catch (_) {}
      try {
        const pending = typeof planService.getPendingCheckout === 'function' ? planService.getPendingCheckout() : null
        if (pending && pending.linkId) return true
      } catch (_) {}
      return false
    })()
    if (!shouldSync) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await planService.syncUserPayments({ days: 14, limit: 10 })
        const updatedPaid = Number(r?.data?.updatedPaid || 0)
        if (!cancelled && updatedPaid > 0) {
          refreshSubscription()
          try { toast({ title: 'Pagamento confirmado', description: 'Seu plano foi ativado.', duration: 5000 }) } catch (_) {}
        }
      } catch (_) {}
    })()
    return () => { cancelled = true; }
  }, [user?.id]);

  useEffect(() => {
    const onFocus = () => refreshSubscription();
    const onVis = () => {
      if (document.visibilityState === 'visible') refreshSubscription();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  useEffect(() => {
    let stopped = false;
    let intervalId = null;
    const runOnce = async () => {
      if (!pendingPayment?.linkId || stopped) return;
      try {
        const sync = await planService.syncPaymentStatus(pendingPayment.linkId);
        const syncPaid = !!(sync?.ok && (sync?.data?.paid === true || String(sync?.data?.status || '').toLowerCase() === 'paid'));
        const syncStatus = String(sync?.data?.status || '').toLowerCase();
        if (syncStatus === 'failed' || syncStatus === 'canceled') {
          refreshSubscription();
          try { toast({ title: 'Pagamento não aprovado', description: 'O gateway marcou a cobrança como falha. Tente novamente.', duration: 7000 }) } catch (_) {}
          try { checkoutWindowRef.current?.close?.() } catch (_) {}
          checkoutWindowRef.current = null;
          planService.clearPendingCheckout?.();
          setPendingPayment(null);
          return;
        }
        if (!syncPaid) return;

        const activated = await planService.handleCheckoutCallback(
          { status: 'success', plan: pendingPayment.planKey, billing: pendingPayment.billingCycle, link_id: pendingPayment.linkId, session_id: null },
          user,
          {}
        );

        refreshSubscription();
        if (activated?.ok) {
          try { toast({ title: 'Pagamento confirmado', description: 'Plano ativado com sucesso.', duration: 5000 }) } catch (_) {}
        }
        try {
          if (checkoutWindowRef.current && typeof checkoutWindowRef.current.close === 'function') {
            checkoutWindowRef.current.close();
          }
        } catch (_) {}
        checkoutWindowRef.current = null;
        if (typeof planService.clearPendingCheckout === 'function') planService.clearPendingCheckout();
        setPendingPayment(null);
      } catch (_) {}
    };

    if (pendingPayment?.linkId) {
      runOnce();
      intervalId = window.setInterval(runOnce, 4000);
    }

    return () => {
      stopped = true;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [pendingPayment?.linkId, pendingPayment?.planKey, pendingPayment?.billingCycle, user?.id]);

  const activePlanName = (() => {
    const key = subscription?.planKey || activePlanKey;
    if (!key) return null;
    return plansData[key]?.name || key;
  })();

  return (
    <div className="w-full px-6 pt-5 pb-8">
      <div className="max-w-[1348px] mx-auto">
        <div
          className="flex items-center justify-between mb-4 px-2"
        >
          <div>
            <h1 className="font-inter text-[18px] leading-[42px] tracking-[0px] font-semibold not-italic text-[#000000]">Upgrade de planos</h1>
            <p className="font-inter text-[16px] leading-[24px] tracking-[0px] font-normal not-italic text-[#404040]">Gerencie seus planos Connekt</p>
          </div>
        </div>

        {subscription?.planKey && (
          <div className="mt-4 mb-6 px-4">
            <div className="bg-white border border-[#D9E6FF] rounded-[10px] p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[14px] text-[#8F9299]">Plano ativo</div>
                <div className="text-[18px] font-semibold text-[#0047BB] break-words">{activePlanName}</div>
                <div className="text-[12px] text-[#404040] mt-1">
                  <span className="text-[#8F9299]">Status:</span>{' '}
                  <span className="font-medium">{subscription.status === 'canceled' ? 'Cancelado' : 'Ativo'}</span>
                  {'  '}•{'  '}
                  <span className="text-[#8F9299]">Ciclo:</span>{' '}
                  <span className="font-medium">{subscription.billingCycle === 'anual' ? 'Anual' : 'Mensal'}</span>
                </div>
                <div className="text-[12px] text-[#404040] mt-1">
                  <span className="text-[#8F9299]">Início:</span>{' '}
                  <span className="font-medium">{formatDateBR(subscription.activatedAt)}</span>
                  {'  '}•{'  '}
                  <span className="text-[#8F9299]">Válido até:</span>{' '}
                  <span className="font-medium">{formatDateBR(subscription.expiresAt)}</span>
                </div>
                <div className="text-[12px] text-[#404040] mt-1">
                  <span className="text-[#8F9299]">Renovação:</span>{' '}
                  <span className="font-medium">{subscription.autoRenew ? 'Automática' : 'Manual'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {pendingPayment?.linkId && (
          <div className="mb-6 px-4">
            <div className="bg-[#FFFBDC] border border-[#FDED72] rounded-[10px] p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[14px] text-[#1E1B39] font-semibold">Aguardando confirmação do pagamento…</div>
                <div className="text-[12px] text-[#404040] mt-1 break-words">
                  Plano: <span className="font-medium">{plansData[pendingPayment.planKey]?.name || pendingPayment.planKey}</span> •
                  Ciclo: <span className="font-medium">{pendingPayment.billingCycle === 'anual' ? 'Anual' : 'Mensal'}</span>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  className="text-xs text-white bg-[#0047BB] rounded px-4 py-2"
                  onClick={async () => {
                    try {
                      const sync = await planService.syncPaymentStatus(pendingPayment.linkId);
                      const status = String(sync?.data?.status || '').toLowerCase();
                      if (status === 'failed' || status === 'canceled') {
                        refreshSubscription();
                        try { toast({ title: 'Pagamento não aprovado', description: 'O gateway marcou a cobrança como falha. Tente novamente.', duration: 7000 }) } catch (_) {}
                        try { checkoutWindowRef.current?.close?.() } catch (_) {}
                        checkoutWindowRef.current = null;
                        planService.clearPendingCheckout?.();
                        setPendingPayment(null);
                        return;
                      }
                      const paid = !!(sync?.ok && (sync?.data?.paid === true || status === 'paid'));
                      if (paid) {
                        await planService.handleCheckoutCallback(
                          { status: 'success', plan: pendingPayment.planKey, billing: pendingPayment.billingCycle, link_id: pendingPayment.linkId, session_id: null },
                          user,
                          {}
                        );
                        refreshSubscription();
                        try { toast({ title: 'Pagamento confirmado', description: 'Plano ativado com sucesso.', duration: 5000 }) } catch (_) {}
                        try { checkoutWindowRef.current?.close?.() } catch (_) {}
                        checkoutWindowRef.current = null;
                        planService.clearPendingCheckout?.();
                        setPendingPayment(null);
                      } else {
                        try { toast({ title: 'Ainda não confirmado', description: 'O pagamento ainda não apareceu como pago. Tente novamente em alguns segundos.', duration: 5000 }) } catch (_) {}
                      }
                    } catch (e) {
                      try { toast({ title: 'Falha ao verificar', description: e?.message || String(e), duration: 6000 }) } catch (_) {}
                    }
                  }}
                >
                  Já paguei (verificar)
                </button>
                <button
                  type="button"
                  className="text-xs text-[#D92D20] border border-[#D92D20] rounded px-4 py-2"
                  onClick={() => {
                    try { checkoutWindowRef.current?.close?.() } catch (_) {}
                    checkoutWindowRef.current = null;
                    planService.clearPendingCheckout?.();
                    setPendingPayment(null);
                    refreshSubscription();
                  }}
                >
                  Cancelar verificação
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Seletor de ciclo de cobrança fora e abaixo do cabeçalho */}
        <div
          className="flex items-center justify-center mb-6"
          style={{
            width: '171px',
            height: '46px',
            gap: '22px',
            paddingTop: '6px',
            paddingRight: '8px',
            paddingBottom: '6px',
            paddingLeft: '8px',
            borderRadius: '50px',
            opacity: 1,
            transform: 'rotate(0deg)',
            backgroundColor: '#F8FAFF',
            border: '1px solid #E3E4E5',
            margin: '0 auto',
            marginTop: '22px'
          }}
        >
          <button
            type="button"
            className={`font-inter text-[12px] leading-[20px] tracking-[0px] font-medium not-italic text-center ${billingCycle === 'mensal' ? 'bg-white shadow-sm text-[#000000]' : 'text-[#6B7588]'}`}
            style={{
              width: '78px',
              height: '34px',
              display: 'inline-flex',
              gap: '1px',
              opacity: 1,
              transform: 'rotate(0deg)',
              paddingTop: '8px',
              paddingRight: '18px',
              paddingBottom: '8px',
              paddingLeft: '18px',
              borderRadius: '50px',
              boxSizing: 'border-box',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: '10px'
            }}
            onClick={() => setBillingCycle('mensal')}
          >
            Mensal
          </button>
          <button
            type="button"
            className={`px-4 h-7 rounded-full font-inter text-[12px] leading-[20px] tracking-[0px] font-medium not-italic text-center ${billingCycle === 'anual' ? 'bg-white shadow-sm text-[#8F9299]' : 'text-[#8F9299]'}`}
            style={{ marginLeft: '-5px' }}
            onClick={() => setBillingCycle('anual')}
          >
            Anual
          </button>
        </div>

        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mx-auto justify-center items-start px-4 md:px-8 pt-5"
        >
          {canUseQaPlan && (
            <PlanCard
              key={`qa-${billingCycle}`}
              name={plansData.qa.name}
              description={plansData.qa.description}
              priceMonthly={plansData.qa.prices.mensal}
              priceYearly={plansData.qa.prices.anual}
              billing={billingCycle}
              highlight={currentPlanKey === plansData.qa.key}
              canCancel={canCancelSubscription && currentPlanKey === plansData.qa.key}
              isLoading={actionLoadingPlanKey === plansData.qa.key}
              containerStyle={{
                width: '100%',
                height: 'auto',
              }}
              features={plansData.qa.features}
              onCancel={cancelCurrentSubscription}
              onAction={async () => {
                if (!user?.id) {
                  try { toast({ title: 'Faça login', description: 'Você precisa estar logado para contratar um plano.', duration: 6000 }) } catch (_) {}
                  return;
                }
                try {
                  setActionLoadingPlanKey(plansData.qa.key)
                  const r = await planService.startCheckout(plansData.qa.key, billingCycle, user, { redirect: false });
                  const url = r?.checkout_url || r?.checkoutUrl || null;
                  const linkId = r?.linkId || null;
                  const paymentId = r?.paymentId || null;
                  if (url) {
                    const w = window.open(String(url), '_blank', 'noopener');
                    checkoutWindowRef.current = w || null;
                    if (!w) {
                      try { toast({ title: 'Pop-up bloqueado', description: 'Permita pop-ups para abrir o checkout em nova aba.', duration: 6000 }) } catch (_) {}
                    }
                  }
                  if (linkId) {
                    setPendingPayment({ planKey: plansData.qa.key, billingCycle, linkId, paymentId });
                  }
                } catch (e) {
                  const msg = e?.message || String(e)
                  try { toast({ title: 'Falha ao iniciar checkout', description: msg, duration: 6000 }) } catch (_) {}
                } finally {
                  setActionLoadingPlanKey(null)
                }
              }}
            />
          )}
          <PlanCard
            key={`teste-${billingCycle}`}
            name={plansData.teste.name}
            description={plansData.teste.description}
            priceMonthly={plansData.teste.prices.mensal}
            priceYearly={plansData.teste.prices.anual}
            billing={billingCycle}
            highlight={currentPlanKey === plansData.teste.key}
            canCancel={canCancelSubscription && currentPlanKey === plansData.teste.key}
            isLoading={actionLoadingPlanKey === plansData.teste.key}
            containerStyle={{
              width: '100%',
              height: 'auto',
            }}
            features={plansData.teste.features}
            onCancel={cancelCurrentSubscription}
            onAction={async () => {
              if (!user?.id) {
                try { toast({ title: 'Faça login', description: 'Você precisa estar logado para contratar um plano.', duration: 6000 }) } catch (_) {}
                return;
              }
              try {
                setActionLoadingPlanKey(plansData.teste.key)
                const r = await planService.startCheckout(plansData.teste.key, billingCycle, user, { redirect: false });
                const url = r?.checkout_url || r?.checkoutUrl || null;
                const linkId = r?.linkId || null;
                const paymentId = r?.paymentId || null;
                if (url) {
                  const w = window.open(String(url), '_blank', 'noopener');
                  checkoutWindowRef.current = w || null;
                  if (!w) {
                    try { toast({ title: 'Pop-up bloqueado', description: 'Permita pop-ups para abrir o checkout em nova aba.', duration: 6000 }) } catch (_) {}
                  }
                }
                if (linkId) {
                  setPendingPayment({ planKey: plansData.teste.key, billingCycle, linkId, paymentId });
                }
              } catch (e) {
                const msg = e?.message || String(e)
                try { toast({ title: 'Falha ao iniciar checkout', description: msg, duration: 6000 }) } catch (_) {}
              } finally {
                setActionLoadingPlanKey(null)
              }
            }}
          />
          <PlanCard
            key={`start-${billingCycle}`}
            name={plansData.start.name}
            description={plansData.start.description}
            priceMonthly={plansData.start.prices.mensal}
            priceYearly={plansData.start.prices.anual}
            billing={billingCycle}
            highlight={currentPlanKey === plansData.start.key}
            canCancel={canCancelSubscription && currentPlanKey === plansData.start.key}
            isLoading={actionLoadingPlanKey === plansData.start.key}
            containerStyle={{
              width: '100%',
              height: 'auto',
            }}
            features={plansData.start.features}
            onCancel={cancelCurrentSubscription}
            onAction={async () => {
              if (!user?.id) {
                try { toast({ title: 'Faça login', description: 'Você precisa estar logado para contratar um plano.', duration: 6000 }) } catch (_) {}
                return;
              }
              try {
                setActionLoadingPlanKey(plansData.start.key)
                const r = await planService.startCheckout(plansData.start.key, billingCycle, user, { redirect: false });
                  const url = r?.checkout_url || r?.checkoutUrl || null;
                  const linkId = r?.linkId || null;
                  const paymentId = r?.paymentId || null;
                  if (url) {
                    const w = window.open(String(url), '_blank', 'noopener');
                    checkoutWindowRef.current = w || null;
                    if (!w) {
                      try { toast({ title: 'Pop-up bloqueado', description: 'Permita pop-ups para abrir o checkout em nova aba.', duration: 6000 }) } catch (_) {}
                    }
                  }
                  if (linkId) {
                    setPendingPayment({ planKey: plansData.start.key, billingCycle, linkId, paymentId });
                  }
              } catch (e) {
                const msg = e?.message || String(e)
                try { toast({ title: 'Falha ao iniciar checkout', description: msg, duration: 6000 }) } catch (_) {}
              } finally {
                setActionLoadingPlanKey(null)
              }
            }}
          />

          <div className="relative">
            <PlanCard
              key={`pro-${billingCycle}`}
              name={plansData.pro.name}
              description={plansData.pro.description}
              priceMonthly={plansData.pro.prices.mensal}
              priceYearly={plansData.pro.prices.anual}
              billing={billingCycle}
            highlight={currentPlanKey === plansData.pro.key}
            canCancel={canCancelSubscription && currentPlanKey === plansData.pro.key}
            isLoading={actionLoadingPlanKey === plansData.pro.key}
            containerStyle={{
              width: '100%',
              height: 'auto',
            }}
            features={plansData.pro.features}
            onCancel={cancelCurrentSubscription}
            onAction={async () => {
              if (!user?.id) {
                try { toast({ title: 'Faça login', description: 'Você precisa estar logado para contratar um plano.', duration: 6000 }) } catch (_) {}
                return;
              }
              try {
                setActionLoadingPlanKey(plansData.pro.key)
                const r = await planService.startCheckout(plansData.pro.key, billingCycle, user, { redirect: false });
                  const url = r?.checkout_url || r?.checkoutUrl || null;
                  const linkId = r?.linkId || null;
                  const paymentId = r?.paymentId || null;
                  if (url) {
                    const w = window.open(String(url), '_blank', 'noopener');
                    checkoutWindowRef.current = w || null;
                    if (!w) {
                      try { toast({ title: 'Pop-up bloqueado', description: 'Permita pop-ups para abrir o checkout em nova aba.', duration: 6000 }) } catch (_) {}
                    }
                  }
                  if (linkId) {
                    setPendingPayment({ planKey: plansData.pro.key, billingCycle, linkId, paymentId });
                  }
              } catch (e) {
                const msg = e?.message || String(e)
                try { toast({ title: 'Falha ao iniciar checkout', description: msg, duration: 6000 }) } catch (_) {}
              } finally {
                setActionLoadingPlanKey(null)
              }
            }}
          />
          </div>

          <PlanCard
            key={`premium-${billingCycle}`}
            name={plansData.premium.name}
            description={plansData.premium.description}
            priceMonthly={plansData.premium.prices.mensal}
            priceYearly={plansData.premium.prices.anual}
            billing={billingCycle}
            highlight={currentPlanKey === plansData.premium.key}
            canCancel={canCancelSubscription && currentPlanKey === plansData.premium.key}
            isLoading={actionLoadingPlanKey === plansData.premium.key}
            containerStyle={{
              width: '100%',
              height: 'auto',
            }}
            features={plansData.premium.features}
            onCancel={cancelCurrentSubscription}
            onAction={async () => {
              if (!user?.id) {
                try { toast({ title: 'Faça login', description: 'Você precisa estar logado para contratar um plano.', duration: 6000 }) } catch (_) {}
                return;
              }
              try {
                setActionLoadingPlanKey(plansData.premium.key)
                const r = await planService.startCheckout(plansData.premium.key, billingCycle, user, { redirect: false });
                const url = r?.checkout_url || r?.checkoutUrl || null;
                const linkId = r?.linkId || null;
                const paymentId = r?.paymentId || null;
                if (url) {
                  const w = window.open(String(url), '_blank', 'noopener');
                  checkoutWindowRef.current = w || null;
                  if (!w) {
                    try { toast({ title: 'Pop-up bloqueado', description: 'Permita pop-ups para abrir o checkout em nova aba.', duration: 6000 }) } catch (_) {}
                  }
                }
                if (linkId) {
                  setPendingPayment({ planKey: plansData.premium.key, billingCycle, linkId, paymentId });
                }
              } catch (e) {
                const msg = e?.message || String(e)
                try { toast({ title: 'Falha ao iniciar checkout', description: msg, duration: 6000 }) } catch (_) {}
              } finally {
                setActionLoadingPlanKey(null)
              }
            }}
          />
        </div>
      </div>
      <CancelSubscriptionModal
        open={isCancelModalOpen}
        loading={cancelLoading}
        onClose={() => setIsCancelModalOpen(false)}
        onConfirm={async (reason) => {
          if (!user?.id) {
            try { toast({ title: 'Faça login', description: 'Você precisa estar logado para cancelar o plano.', duration: 6000 }) } catch (_) {}
            return
          }
          try {
            setCancelLoading(true)
            const r = planService.cancelSubscription({ reason, userId: user.id })
            refreshSubscription()
            setIsCancelModalOpen(false)
            if (r?.ok) {
              try { toast({ title: 'Plano cancelado', description: 'Seu plano permanecerá ativo até o fim da validade.', duration: 6000 }) } catch (_) {}
            } else {
              try { toast({ title: 'Não foi possível cancelar', description: r?.error || 'Falha ao cancelar o plano.', duration: 6000 }) } catch (_) {}
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

export default PlanosPage;
