import React from 'react';
import { Helmet } from 'react-helmet-async';
import { ShoppingCart, Plus, Search, TrendingUp, DollarSign } from 'lucide-react';

const VendasPage = () => {
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
                  <p className="text-2xl font-bold text-gray-900">R$ 0,00</p>
                </div>
                <DollarSign className="w-8 h-8 text-green-500" />
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Vendas Este Mês</p>
                  <p className="text-2xl font-bold text-gray-900">R$ 0,00</p>
                </div>
                <TrendingUp className="w-8 h-8 text-blue-500" />
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total de Vendas</p>
                  <p className="text-2xl font-bold text-gray-900">0</p>
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

          {/* Empty State */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Nenhuma venda encontrada</h3>
            <p className="text-gray-600 mb-6">Registre suas primeiras vendas para começar a acompanhar sua receita</p>
            <button className="bg-[#0047BB] text-white px-6 py-3 rounded-[4px] hover:bg-[#003a99] transition-colors">
              Registrar Primeira Venda
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VendasPage;