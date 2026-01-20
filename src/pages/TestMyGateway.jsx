import React, { useState, useEffect } from 'react';
import { planService } from '@/services/planService';
import { useAuth } from '@/contexts/SupabaseAuthContext';

export default function TestMyGateway() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [envConfig, setEnvConfig] = useState({});

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

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">Teste de Integração MyGateway</h1>
      
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
