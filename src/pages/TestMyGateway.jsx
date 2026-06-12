import React, { useState, useEffect } from 'react';
import { planService } from '@/services/planService';
import { useAuth } from '@/contexts/SupabaseAuthContext';

export default function TestMyGateway() {
  const { user, session } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [envConfig, setEnvConfig] = useState({});
  const [healthLoading, setHealthLoading] = useState(false);

  const explainHealthcheck = (httpStatus, body) => {
    const status = Number(httpStatus || 0)
    const error = String(body?.error || '').trim()
    const step = String(body?.step || '').trim()
    if (status === 401 || error === 'unauthorized') {
      return 'Você precisa estar logado e autorizado como admin para rodar este teste.'
    }
    if (status === 403 || error === 'forbidden') {
      return 'Seu usuário não tem permissão de admin para rodar este teste.'
    }
    if (error === 'missing_gateway_env' || error === 'missing_gateway_base') {
      return 'O servidor não encontrou as credenciais/URL do gateway nas variáveis de ambiente. Isso é configuração interna, não é um erro do aluno.'
    }
    if (status === 504 || error === 'gateway_timeout') {
      if (step === 'auth') return 'O servidor tentou autenticar no gateway, mas o gateway não respondeu a tempo. Normalmente é instabilidade/queda do gateway ou bloqueio de rede.'
      if (step === 'paymentlink') return 'O servidor conseguiu autenticar, mas o gateway não respondeu a tempo ao criar o checkout. Normalmente é instabilidade/queda do gateway ou bloqueio de rede.'
      return 'O servidor tentou falar com o gateway, mas o gateway não respondeu a tempo. Normalmente é instabilidade/queda do gateway ou bloqueio de rede.'
    }
    if (status >= 500 && status <= 599) {
      return 'O servidor não conseguiu concluir a conversa com o gateway. Em geral é problema de conectividade/instabilidade do gateway (ou bloqueio).'
    }
    if (status >= 400 && status <= 499) {
      return 'O gateway respondeu, mas recusou a requisição. Em geral é credencial inválida, permissão ou formato do pedido.'
    }
    return ''
  }

  useEffect(() => {
    // Carrega config (mascarando segredos)
    // Nota: Variáveis sem VITE_ não são expostas ao frontend, o que é correto para segredos.
    const loadConfig = () => {
      const apiKey = import.meta.env.VITE_PLANS_GATEWAY_API_KEY || '';
      const authData = import.meta.env.VITE_PLANS_GATEWAY_AUTHDATA || '';
      const baseUrl = import.meta.env.VITE_PLANS_GATEWAY_URL || '';

      setEnvConfig({
        VITE_PLANS_GATEWAY_API_KEY: apiKey ? `${apiKey.slice(0, 8)}...` : '(vazio)',
        VITE_PLANS_GATEWAY_AUTHDATA: authData ? '(presente)' : '(vazio)',
        VITE_PLANS_GATEWAY_URL: baseUrl || '(vazio)',
        'Server-Side Keys (MYG_*)': '(Ocultas no frontend)'
      });
    };
    loadConfig();
  }, []);

  const addLog = (entry) => {
    setLogs(prev => [{ ts: new Date().toISOString(), ...entry }, ...prev]);
  };

  const handleTestCheckout = async (planKey, billingCycle) => {
    if (loading) return;
    setLoading(true);
    addLog({ type: 'info', msg: `Iniciando teste: ${planKey} / ${billingCycle}` });

    try {
      // Mock de user se não estiver logado
      const testUser = user || { id: 'test-user-id-123', email: 'test@example.com' };
      
      const result = await planService.startCheckout(planKey, billingCycle, testUser, {
        onLog: (log) => addLog({ type: 'debug', msg: `[Step: ${log.step}] ${log.message}`, data: log.data })
      });

      if (result.ok) {
        addLog({ type: 'success', msg: `Checkout criado com sucesso!`, data: result });
      } else {
        addLog({ type: 'error', msg: `Falha no checkout: ${result.error}`, data: result });
      }
    } catch (e) {
      addLog({ type: 'error', msg: `Exceção: ${e.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleGatewayHealthcheck = async () => {
    if (healthLoading) return;
    setHealthLoading(true);
    addLog({ type: 'info', msg: 'Rodando healthcheck do gateway (server-side)...' });
    try {
      const token = String(session?.access_token || '').trim();
      if (!token) {
        addLog({ type: 'error', msg: 'Você precisa estar logado como admin para rodar o healthcheck.' });
        return;
      }
      const r = await fetch('/api/admin/gateway-healthcheck', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        addLog({ type: 'error', msg: `Healthcheck falhou (HTTP ${r.status})`, data: body });
        const reason = explainHealthcheck(r.status, body)
        if (reason) addLog({ type: 'info', msg: `Explicação: ${reason}` })
        return;
      }
      addLog({ type: body?.ok ? 'success' : 'error', msg: `Healthcheck concluído (ok=${String(!!body?.ok)})`, data: body });
      const reason = explainHealthcheck(200, body)
      if (reason) addLog({ type: body?.ok ? 'info' : 'info', msg: `Explicação: ${reason}` })
    } catch (e) {
      addLog({ type: 'error', msg: `Exceção no healthcheck: ${e?.message || String(e)}` });
    } finally {
      setHealthLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">Teste de Integração MyGateway</h1>

      <div className="bg-white border rounded-lg p-4 space-y-2">
        <div className="font-semibold">Como interpretar (explicação para leigos)</div>
        <div className="text-sm text-slate-700 leading-relaxed">
          O seu site precisa “conversar” com o MyGateway para criar um link de checkout. Esse healthcheck simula exatamente essa conversa pelo servidor.
          Se aparecer “demorou para responder” ou HTTP 504, significa que o servidor tentou falar com o MyGateway e ele não respondeu a tempo (instabilidade/queda/bloqueio).
          Se aparecer HTTP 4xx, significa que o MyGateway respondeu, mas recusou (credenciais/permissão/formato).
        </div>
        <div className="text-sm text-slate-700 leading-relaxed">
          A caixa “Configuração de Ambiente” mostra apenas variáveis que começam com <span className="font-mono">VITE_</span>.
          As credenciais reais do gateway ficam no servidor e por segurança não aparecem no navegador, então é normal ver “(vazio)” ali.
        </div>
      </div>
      
      {/* Configurações */}
      <div className="bg-slate-100 p-4 rounded-lg border">
        <h2 className="font-semibold mb-2">Configuração de Ambiente (.env)</h2>
        <div className="grid grid-cols-2 gap-2 text-sm font-mono">
          {Object.entries(envConfig).map(([k, v]) => (
            <React.Fragment key={k}>
              <div className="text-slate-500">{k}:</div>
              <div className="font-bold text-slate-700">{v}</div>
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="border p-4 rounded-lg space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Healthcheck do Gateway (server-side)</h2>
          <button
            onClick={handleGatewayHealthcheck}
            disabled={healthLoading}
            className="px-3 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50 text-sm"
          >
            {healthLoading ? 'Testando...' : 'Rodar healthcheck'}
          </button>
        </div>
        <div className="text-sm text-slate-600">
          Esse teste chama <span className="font-mono">/api/admin/gateway-healthcheck</span> e tenta autenticar e criar um paymentlink no MyGateway,
          sem expor segredos no frontend.
        </div>
      </div>

      {/* Ações */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {['teste', 'start', 'pro', 'premium'].map(plan => (
          <div key={plan} className="border p-4 rounded-lg space-y-3">
            <h3 className="font-bold capitalize text-lg">{plan}</h3>
            <div className="flex gap-2">
              <button
                onClick={() => handleTestCheckout(plan, 'mensal')}
                disabled={loading}
                className="flex-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
              >
                Mensal
              </button>
              <button
                onClick={() => handleTestCheckout(plan, 'anual')}
                disabled={loading}
                className="flex-1 px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 text-sm"
              >
                Anual
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Logs */}
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-slate-50 px-4 py-2 border-b font-semibold flex justify-between items-center">
          <span>Logs de Execução</span>
          <button onClick={() => setLogs([])} className="text-xs text-red-500 hover:underline">Limpar</button>
        </div>
        <div className="h-96 overflow-y-auto bg-slate-900 text-slate-200 p-4 font-mono text-xs space-y-1">
          {logs.length === 0 && <div className="text-slate-500 italic">Nenhum log ainda...</div>}
          {logs.map((log, i) => (
            <div key={i} className={`border-b border-slate-800 pb-1 mb-1 ${
              log.type === 'error' ? 'text-red-400' : 
              log.type === 'success' ? 'text-green-400' : 
              log.type === 'debug' ? 'text-slate-400' : 'text-blue-300'
            }`}>
              <span className="opacity-50">[{log.ts.split('T')[1].slice(0,8)}]</span>{' '}
              <span className="font-bold">{log.msg}</span>
              {log.data && (
                <pre className="mt-1 ml-4 text-[10px] opacity-70 overflow-x-auto">
                  {JSON.stringify(log.data, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
