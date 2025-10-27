import React, { useState } from 'react';
import { Search, Filter, X, Calendar, Tag, BarChart3 } from 'lucide-react';

const QuestionBankSidebar = ({ activeFilters, onFilterChange, onClearFilters, questionBanks }) => {
  const [sidebarSearchTerm, setSidebarSearchTerm] = useState('');

  const handleFilterToggle = (filterKey) => {
    const newFilters = activeFilters.includes(filterKey)
      ? activeFilters.filter(f => f !== filterKey)
      : [...activeFilters, filterKey];
    onFilterChange(newFilters);
  };

  // Estatísticas calculadas
  const totalBanks = questionBanks.length;
  const totalQuestions = questionBanks.reduce((sum, bank) => sum + (bank.question_count || 0), 0);
  const activeBanks = questionBanks.filter(bank => bank.status !== 'inactive').length;

  // Extrair categorias únicas dos bancos
  const categories = [...new Set(questionBanks.map(bank => bank.category).filter(Boolean))];
  
  // Extrair tags únicas dos bancos
  const allTags = questionBanks.reduce((tags, bank) => {
    if (Array.isArray(bank.tags)) {
      return [...tags, ...bank.tags];
    }
    return tags;
  }, []);
  const uniqueTags = [...new Set(allTags)];

  const filterSections = [
    {
      title: 'Status',
      key: 'status',
      options: [
        { label: 'Ativo', value: 'status:active' },
        { label: 'Inativo', value: 'status:inactive' },
        { label: 'Rascunho', value: 'status:draft' }
      ]
    },
    {
      title: 'Categoria',
      key: 'category',
      options: categories.map(cat => ({ label: cat, value: `category:${cat}` }))
    },
    {
        title: 'Categorias',
        key: 'tags',
        options: uniqueTags.slice(0, 10).map(tag => ({ label: tag, value: `tags:${tag}` }))
      },
    {
      title: 'Data de Criação',
      key: 'created',
      options: [
        { label: 'Última semana', value: 'created:week' },
        { label: 'Último mês', value: 'created:month' },
        { label: 'Últimos 3 meses', value: 'created:quarter' }
      ]
    }
  ];

  return (
    <aside className="w-80 bg-white rounded-lg shadow-sm border border-gray-200 p-6 h-fit sticky top-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Filter className="w-5 h-5" />
          Filtros
        </h3>
        {activeFilters.length > 0 && (
          <button
            onClick={onClearFilters}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <X className="w-4 h-4" />
            Limpar
          </button>
        )}
      </div>

      {/* Search within sidebar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar filtros..."
            value={sidebarSearchTerm}
            onChange={(e) => setSidebarSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>
      </div>

      {/* Active Filters */}
      {activeFilters.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Filtros Ativos</h4>
          <div className="flex flex-wrap gap-2">
            {activeFilters.map((filter) => {
              const [category, value] = filter.split(':');
              return (
                <span
                  key={filter}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                >
                  {value}
                  <button
                    onClick={() => handleFilterToggle(filter)}
                    className="hover:bg-blue-200 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter Sections */}
      <div className="space-y-6">
        {filterSections.map((section) => {
          if (section.options.length === 0) return null;
          
          const filteredOptions = section.options.filter(option =>
            option.label.toLowerCase().includes(sidebarSearchTerm.toLowerCase())
          );

          if (filteredOptions.length === 0) return null;

          return (
            <div key={section.key}>
              <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                {section.key === 'status' && <BarChart3 className="w-4 h-4" />}
                {section.key === 'category' && <img src="/bank-icon.svg" alt="Bank Icon" className="w-4 h-4" />}
                {section.key === 'tags' && <Tag className="w-4 h-4" />}
                {section.key === 'created' && <Calendar className="w-4 h-4" />}
                {section.title}
              </h4>
              <div className="space-y-2">
                {filteredOptions.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded-md transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={activeFilters.includes(option.value)}
                      onChange={() => handleFilterToggle(option.value)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Statistics */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          Estatísticas
        </h4>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Total de Bancos</span>
            <span className="text-sm font-semibold text-gray-900">{totalBanks}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Total de Questões</span>
            <span className="text-sm font-semibold text-gray-900">{totalQuestions}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Bancos Ativos</span>
            <span className="text-sm font-semibold text-green-600">{activeBanks}</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default QuestionBankSidebar;