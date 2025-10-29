import React from 'react';
import { Helmet } from 'react-helmet-async';
import { FileText, Plus, Search, Calendar } from 'lucide-react';

const SimuladosPage = () => {
  return (
    <div className="h-full bg-gray-50 overflow-y-auto">
      <Helmet>
        <title>Simulados - Connekt</title>
      </Helmet>
      
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <FileText className="w-8 h-8 text-[#0047BB]" />
                Simulados
              </h1>
              <p className="text-gray-600 mt-2">Crie e gerencie simulados para seus alunos</p>
            </div>
            <button className="bg-[#0047BB] text-white px-6 py-3 rounded-[4px] flex items-center gap-2 hover:bg-[#003a99] transition-colors">
          <Plus className="w-4 h-4" />
          Criar Simulado
        </button>
          </div>

          {/* Search and Filter Bar */}
          <div className="flex gap-4 mb-8">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar simulados..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0047BB] focus:border-transparent"
              />
            </div>
            <button className="px-4 py-3 border border-gray-300 rounded-[4px] flex items-center gap-2 hover:bg-gray-50 transition-colors">
              <Calendar className="w-5 h-5" />
              Data
            </button>
          </div>

          {/* Empty State */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Nenhum simulado encontrado</h3>
            <p className="text-gray-600 mb-6">Crie simulados para avaliar o conhecimento dos seus alunos</p>
            <button className="bg-[#0047BB] text-white px-6 py-3 rounded-[4px] hover:bg-[#003a99] transition-colors">
          Criar Primeiro Simulado
        </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimuladosPage;