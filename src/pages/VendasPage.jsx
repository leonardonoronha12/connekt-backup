import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { ShoppingCart, Plus, Search, TrendingUp, DollarSign } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const VendasPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);

  const currency = 'BRL';
  const fmtMoney = (cents) => {
    const n = Number(cents || 0);
    const value = isFinite(n) ? n / 100 : 0;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value);
  };

  const startOfDay = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const startOfMonth = () => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('sales')
          .select('id,amount_cents,status,created_at')
          .eq('producer_id', user.id)
          .order('created_at', { ascending: false })
          .limit(500);
        if (error) throw error;
        if (!cancelled) setRows(Array.isArray(data) ? data : []);
      } catch (_) {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const stats = useMemo(() => {
    const paid = (rows || []).filter((r) => String(r?.status || '').toLowerCase() === 'paid');
    const dayStart = startOfDay().getTime();
    const monthStart = startOfMonth().getTime();
    let todayCents = 0;
    let monthCents = 0;
    for (const r of paid) {
      const t = r?.created_at ? new Date(r.created_at).getTime() : 0;
      const cents = Number(r?.amount_cents || 0);
      if (!isFinite(cents)) continue;
      if (t >= dayStart) todayCents += cents;
      if (t >= monthStart) monthCents += cents;
    }
    return {
      todayCents,
      monthCents,
      totalCount: paid.length,
    };
  }, [rows]);

  return (
    <div className="h-full bg-gray-50 overflow-y-auto">
      <Helmet>
        <title>Vendas - Connekt</title>
      </Helmet>
      
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <ShoppingCart className="w-8 h-8 text-[#0047BB]" />
                Vendas
              </h1>
              <p className="text-gray-600 mt-2">Acompanhe suas vendas e receitas</p>
            </div>
            <button className="bg-[#0047BB] text-white px-6 py-3 rounded-[4px] flex items-center gap-2 hover:bg-[#003a99] transition-colors">
          <Plus className="w-4 h-4" />
          Nova Venda
        </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Vendas Hoje</p>
                  <p className="text-2xl font-bold text-gray-900">{fmtMoney(stats.todayCents)}</p>
                </div>
                <DollarSign className="w-8 h-8 text-green-500" />
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Vendas Este Mês</p>
                  <p className="text-2xl font-bold text-gray-900">{fmtMoney(stats.monthCents)}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-blue-500" />
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total de Vendas</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalCount}</p>
                </div>
                <ShoppingCart className="w-8 h-8 text-purple-500" />
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mb-8">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar vendas..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0047BB] focus:border-transparent"
              />
            </div>
          </div>

          {loading ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <p className="text-gray-600">Carregando vendas…</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Nenhuma venda encontrada</h3>
              <p className="text-gray-600 mb-6">Registre suas primeiras vendas para começar a acompanhar sua receita</p>
              <button className="bg-[#0047BB] text-white px-6 py-3 rounded-[4px] hover:bg-[#003a99] transition-colors">
                Registrar Primeira Venda
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Vendas recentes</h3>
                <span className="text-sm text-gray-500">{rows.length} registros</span>
              </div>
              <div className="divide-y divide-gray-100">
                {rows.slice(0, 10).map((r) => (
                  <div key={r.id} className="px-6 py-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">Venda</div>
                      <div className="text-xs text-gray-500">
                        {r.created_at ? new Date(r.created_at).toLocaleString('pt-BR') : '—'}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs px-2 py-1 rounded-full border border-gray-200 text-gray-600">
                        {String(r.status || '').toLowerCase() === 'paid' ? 'Pago' : 'Pendente'}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">{fmtMoney(r.amount_cents)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VendasPage;
