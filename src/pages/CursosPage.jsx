import React from 'react';
import { Helmet } from 'react-helmet-async';
import { BookOpen, Plus, Search } from 'lucide-react';

const CursosPage = () => {
  return (
    <div className="h-full bg-gray-50 overflow-y-auto">
      <Helmet>
        <title>Meus Cursos - Connekt</title>
      </Helmet>
      
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <BookOpen className="w-8 h-8 text-[#0047BB]" />
                Meus Cursos
              </h1>
              <p className="text-gray-600 mt-2">Gerencie seus cursos e conteúdos educacionais</p>
            </div>
            <button className="bg-[#0047BB] text-white px-6 py-3 rounded-[4px] flex items-center gap-2 hover:bg-[#003a99] transition-colors">
          <Plus className="w-4 h-4" />
          Novo Curso
        </button>
          </div>

          {/* Search Bar */}
          <div className="mb-8">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar cursos..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0047BB] focus:border-transparent"
              />
            </div>
          </div>

          {/* Empty State */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Nenhum curso encontrado</h3>
            <p className="text-gray-600 mb-6">Comece criando seu primeiro curso educacional</p>
            <button className="bg-[#0047BB] text-white px-6 py-3 rounded-lg hover:bg-[#003a99] transition-colors">
              Criar Primeiro Curso
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CursosPage;