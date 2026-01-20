import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Search, Pencil, Trash, Trash2, Check, X, Tag, Upload, CheckCircle, Folder, Info, ChevronRight } from 'lucide-react';
import { TaxonomyDropdown } from '@/components/TaxonomyDropdown';
import { useTaxonomy } from '@/contexts/TaxonomyContext';

export default function CategoriasPage() {
  const [activeTab, setActiveTab] = useState('subcategorias'); // 'subcategorias' | 'categorias'

  const {
    categories,
    subcategories,
    tags,
    createCategory,
    updateCategory,
    deleteCategory,
    createSubcategory,
    updateSubcategory,
    deleteSubcategory,
    createTag,
    updateTag,
    deleteTag,
  } = useTaxonomy();

  // Estados de Busca
  const [searchTerm, setSearchTerm] = useState('');

  // Modais
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [currentEditingItem, setCurrentEditingItem] = useState(null);
  
  // Form States
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3B82F6',
    categoryIds: [],
    tags: [], // Agora é Array
    subcategoriesList: [] // Array de strings (nomes)
  });

  const [showTagSelector, setShowTagSelector] = useState(false);
  const [showSubcategorySelector, setShowSubcategorySelector] = useState(false);
  const [showCategorySelector, setShowCategorySelector] = useState(false);

  // Função de navegação manual compatível com o roteamento do App
  const navigateTo = (path) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const tagById = useMemo(() => new Map(tags.map(t => [t.id, t])), [tags]);
  const tagByNameLower = useMemo(() => new Map(tags.map(t => [String(t.name || '').toLowerCase(), t])), [tags]);
  const categoryById = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);
  const subcategoryByNameLower = useMemo(() => new Map(subcategories.map(s => [String(s.name || '').toLowerCase(), s])), [subcategories]);

  const [draftSubcategoryMetaByName, setDraftSubcategoryMetaByName] = useState({});

  useEffect(() => {
    if (!isModalOpen) return;
    const prevOverflow = document?.body?.style?.overflow;
    if (document?.body?.style) document.body.style.overflow = 'hidden';
    return () => {
      if (document?.body?.style) document.body.style.overflow = prevOverflow || '';
    };
  }, [isModalOpen]);


  const handleOpenCreateModal = () => {
    setModalMode('create');
    setFormData({
      name: '',
      description: '',
      color: '#3B82F6',
      categoryIds: categories[0] ? [categories[0].id] : [],
      tags: [],
      subcategoriesList: []
    });
    setDraftSubcategoryMetaByName({});
    resetSelectors();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item, type) => {
    setModalMode('edit');
    if (type === 'tag') {
      setCurrentEditingItem({ ...item, type });
      setFormData({
        name: item.name,
        description: item.description || '',
        color: item.color || '#94A3B8',
        categoryIds: [],
        tags: [],
        subcategoriesList: [],
      });
    } else if (type === 'category') {
      setCurrentEditingItem({ ...item, type });
      setFormData({
        name: item.name,
        description: item.description || '',
        color: item.color || '#3B82F6',
        categoryIds: [],
        tags: Array.isArray(item.tagIds) ? item.tagIds : [],
        subcategoriesList: [],
      });
    } else {
      setCurrentEditingItem({ ...item, type });
      setFormData({
        name: item.name,
        description: item.description || '',
        color: item.color || '#3B82F6',
        categoryIds: Array.isArray(item.categoryIds) ? item.categoryIds : [],
        tags: Array.isArray(item.tagIds) ? item.tagIds : [],
        subcategoriesList: [],
      });
    }
    resetSelectors();
    setIsModalOpen(true);
  };

  const resetSelectors = () => {
    setShowTagSelector(false);
    setShowSubcategorySelector(false);
    setShowCategorySelector(false);
  };

  // Funções de Tags
  const addTag = (tag) => {
    if (!formData.tags.includes(tag)) {
      setFormData(prev => ({ ...prev, tags: [...prev.tags, tag] }));
    }
  };

  const removeTag = (tag) => {
    setFormData(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
  };

  const createTagFromPayload = async (payload) => {
    const name = String(payload?.name || '').trim();
    if (!name) return;
    const created = createTag({
      name,
      color: String(payload?.color || '#94A3B8'),
      description: String(payload?.description || ''),
    });
    addTag(created.id);
  };

  const updateTagFromPayload = async (itemId, payload) => {
    const id = String(itemId);
    const newName = String(payload?.name || '').trim();
    if (!newName) return;
    updateTag(id, {
      name: newName,
      color: String(payload?.color || '#94A3B8'),
      description: String(payload?.description || ''),
    });
  };

  const deleteTagById = async (itemId) => {
    const id = String(itemId);
    deleteTag(id);
    setFormData(prev => ({ ...prev, tags: (prev.tags || []).filter(t => String(t) !== id) }));
  };

  // Funções de Subcategorias (Lote)
  const addSubcategoryFromSelector = (subName) => {
    if (!formData.subcategoriesList.includes(subName)) {
      setFormData(prev => ({ ...prev, subcategoriesList: [...prev.subcategoriesList, subName] }));
    }
  };

  const removeSubcategoryFromList = (subName) => {
    setFormData(prev => ({ ...prev, subcategoriesList: prev.subcategoriesList.filter(s => s !== subName) }));
  };

  const createSubcategoryFromPayload = async (payload) => {
    const name = String(payload?.name || '').trim();
    if (!name) return;
    setDraftSubcategoryMetaByName(prev => ({
      ...prev,
      [name]: { color: String(payload?.color || '#3B82F6'), desc: String(payload?.description || '') },
    }));
    addSubcategoryFromSelector(name);
  };

  const createCategoryFromPayload = async (payload) => {
    const name = String(payload?.name || '').trim();
    if (!name) return;
    const created = createCategory({
      name,
      description: String(payload?.description || ''),
      color: String(payload?.color || '#3B82F6'),
      tagIds: [],
    });
    addCategory(created.id);
  };

  const updateCategoryFromPayload = async (itemId, payload) => {
    const id = String(itemId);
    const name = String(payload?.name || '').trim();
    if (!name) return;
    updateCategory(id, {
      name,
      description: String(payload?.description || ''),
      color: String(payload?.color || '#3B82F6'),
    });
  };

  const deleteCategoryById = async (itemId) => {
    const id = String(itemId);
    deleteCategory(id);
    setFormData(prev => ({ ...prev, categoryIds: (prev.categoryIds || []).filter(cid => String(cid) !== id) }));
  };

  // Funções de Categorias (Seleção Múltipla)
  const addCategory = (catId) => {
    if (!formData.categoryIds.includes(catId)) {
      setFormData(prev => ({ ...prev, categoryIds: [...prev.categoryIds, catId] }));
    }
  };

  const removeCategory = (catId) => {
    setFormData(prev => ({ ...prev, categoryIds: prev.categoryIds.filter(id => id !== catId) }));
  };

  const handleSave = () => {
    if (!formData.name) return;

    if (activeTab === 'subcategorias') {
      if (modalMode === 'create') {
        createSubcategory({
          name: formData.name,
          description: formData.description,
          color: formData.color,
          categoryIds: formData.categoryIds,
          tagIds: formData.tags,
          productsCount: 0,
        });
      } else {
        updateSubcategory(String(currentEditingItem.id), {
          name: formData.name,
          description: formData.description,
          color: formData.color,
          categoryIds: formData.categoryIds,
          tagIds: formData.tags,
        });
      }
    } else if (activeTab === 'categorias') {
      if (modalMode === 'create') {
        const created = createCategory({
          name: formData.name,
          description: formData.description,
          color: formData.color,
          tagIds: formData.tags,
        });

        const list = Array.isArray(formData.subcategoriesList) ? formData.subcategoriesList : [];
        list.forEach((rawName) => {
          const subName = String(rawName || '').trim();
          if (!subName) return;
          const existing = subcategoryByNameLower.get(subName.toLowerCase());
          if (existing) {
            const next = Array.from(new Set([...(existing.categoryIds || []), created.id]));
            updateSubcategory(existing.id, { categoryIds: next });
            return;
          }
          const meta = draftSubcategoryMetaByName[subName];
          createSubcategory({
            name: subName,
            description: String(meta?.desc || ''),
            color: String(meta?.color || formData.color || '#3B82F6'),
            categoryIds: [created.id],
            tagIds: [],
            productsCount: 0,
          });
        });
      } else {
        updateCategory(String(currentEditingItem.id), {
          name: formData.name,
          description: formData.description,
          color: formData.color,
          tagIds: formData.tags,
        });
      }
    } else if (activeTab === 'tags') {
      const tagName = formData.name.trim();
      
      if (modalMode === 'create') {
        createTag({ name: tagName, color: formData.color, description: formData.description });
      } else {
        updateTag(String(currentEditingItem.id), { name: tagName, color: formData.color, description: formData.description });
      }
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id, type) => {
    if (confirm('Tem certeza que deseja excluir?')) {
      if (type === 'subcategory') {
        deleteSubcategory(String(id));
      } else if (type === 'category') {
        deleteCategory(String(id));
      } else if (type === 'tag') {
        deleteTag(String(id));
      }
    }
  };

  // Filtragem
  const filteredSubcategories = subcategories.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const filteredCategories = categories.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const categoryItemsForSelector = categories.map(c => ({ id: c.id, name: c.name, color: c.color, description: c.description }));
  const subcategoryItemsForSelector = subcategories.map(s => ({ id: s.id, name: s.name, color: s.color, description: s.description }));
  const tagItemsForSelector = tags.map(t => ({ id: t.id, name: t.name, color: t.color, description: t.description }));

  return (
    <div className="flex flex-col min-h-screen p-8 font-sans">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <span className="cursor-pointer hover:text-blue-600 transition-colors" onClick={() => navigateTo('/produtos')}>Produtos</span>
          <ChevronRight className="w-4 h-4" />
          <span className="font-medium text-slate-900">Categorias</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Gestão de termos de pesquisa</h1>
        <p className="text-slate-500 mt-1">Gerencie suas categorias, subcategorias e tags</p>
      </header>

      {/* Tabs e Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        {/* Tabs */}
        <div className="flex space-x-6 border-b border-gray-200 w-full md:w-auto">
          <button
            onClick={() => setActiveTab('categorias')}
            className={`pb-4 px-2 text-sm font-medium transition-colors relative ${
              activeTab === 'categorias' 
                ? 'text-blue-600' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Categorias
            {activeTab === 'categorias' && (
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('subcategorias')}
            className={`pb-4 px-2 text-sm font-medium transition-colors relative ${
              activeTab === 'subcategorias' 
                ? 'text-blue-600' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Subcategorias
            {activeTab === 'subcategorias' && (
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('tags')}
            className={`pb-4 px-2 text-sm font-medium transition-colors relative ${
              activeTab === 'tags' 
                ? 'text-blue-600' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Tags
            {activeTab === 'tags' && (
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full" />
            )}
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button className="flex items-center gap-2 px-4 py-2 text-slate-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors">
            Exportar
            <Upload className="w-4 h-4" />
          </button>
          <button 
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add {activeTab === 'subcategorias' ? 'subcategoria' : activeTab === 'categorias' ? 'categoria' : 'tag'}
          </button>
        </div>
      </div>

      {/* Content */}
      {activeTab === 'subcategorias' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredSubcategories.map(sub => {
            // Encontrar todas as categorias pais
            const parentCats = Array.isArray(sub.categoryIds)
              ? sub.categoryIds.map((cid) => categoryById.get(String(cid))).filter(Boolean)
              : [];

            return (
              <div key={sub.id} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full min-w-0 overflow-hidden">
                <div className="flex justify-between items-start mb-3 gap-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: sub.color }}></div>
                    <h3 className="font-semibold text-slate-800 text-base truncate min-w-0" title={sub.name}>{sub.name}</h3>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button 
                      onClick={() => handleOpenEditModal(sub, 'subcategory')}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(sub.id, 'subcategory')}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <p className="text-slate-500 text-sm mb-4 line-clamp-2 flex-grow">
                  {sub.description || 'Sem descrição definida.'}
                </p>

                <div className="space-y-3 mt-auto">
                  {/* Parent Categories */}
                  {parentCats.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Categorias vinculadas</span>
                      <div className="flex flex-wrap gap-2">
                        {parentCats.map(cat => (
                           <div key={cat.id} className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-full border border-gray-100">
                             <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: cat.color }}></div>
                             <span className="text-xs font-medium text-slate-600">{cat.name}</span>
                           </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tags */}
                  {Array.isArray(sub.tagIds) && sub.tagIds.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Tags vinculadas</span>
                      <div className="flex flex-wrap gap-2">
                        {sub.tagIds.slice(0, 3).map((tagId) => {
                          const tag = tagById.get(String(tagId))
                          if (!tag) return null
                          return (
                          <div key={tag.id} className="flex items-center gap-1 px-2 py-1 bg-slate-100 rounded text-xs text-slate-600">
                            <Tag className="w-3 h-3" />
                            {tag.name}
                          </div>
                          )
                        })}
                        {sub.tagIds.length > 3 && (
                          <span className="text-xs text-slate-400 self-center">+{sub.tagIds.length - 3}</span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="pt-3 border-t border-gray-50 flex items-center justify-end text-blue-600 text-xs font-medium">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    {sub.productsCount} produtos
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'categorias' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredCategories.map(cat => (
             <div key={cat.id} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full min-w-0 overflow-hidden">
               <div className="flex justify-between items-start mb-3 gap-2 min-w-0">
                 <div className="flex items-center gap-2 min-w-0">
                   <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: cat.color }}>
                      <Folder className="w-4 h-4" />
                   </div>
                   <h3 className="font-semibold text-slate-800 text-base truncate min-w-0">{cat.name}</h3>
                 </div>
                 <div className="flex items-center gap-1 flex-shrink-0">
                    <button 
                      onClick={() => handleOpenEditModal(cat, 'category')}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(cat.id, 'category')}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
               </div>
               <p className="text-slate-500 text-sm mb-4 line-clamp-2">
                  {cat.description || 'Sem descrição definida.'}
               </p>
               <div className="mt-auto text-xs text-slate-400">
                  ID: {cat.id}
               </div>
               {/* Tags na listagem de categorias */}
               {Array.isArray(cat.tagIds) && cat.tagIds.length > 0 && (
                 <div className="mt-3 flex flex-wrap gap-2">
                   {cat.tagIds.slice(0, 3).map((tagId) => {
                     const tag = tagById.get(String(tagId))
                     if (!tag) return null
                     return (
                     <div key={tag.id} className="flex items-center gap-1 px-2 py-1 bg-slate-100 rounded text-xs text-slate-600">
                       <Tag className="w-3 h-3" />
                       {tag.name}
                     </div>
                     )
                   })}
                 </div>
               )}
             </div>
          ))}
        </div>
      )}

      {activeTab === 'tags' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {tags.filter(t => (t.name || '').toLowerCase().includes(searchTerm.toLowerCase())).map(tag => (
             <div key={tag.id} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full min-w-0 overflow-hidden">
               <div className="flex justify-between items-start mb-3 gap-2 min-w-0">
                 <div className="flex items-center gap-2 min-w-0">
                   <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: tag.color || '#94A3B8' }}>
                      <Tag className="w-4 h-4" />
                   </div>
                   <h3 className="font-semibold text-slate-800 text-base truncate min-w-0">{tag.name}</h3>
                 </div>
                 <div className="flex items-center gap-1 flex-shrink-0">
                    <button 
                      onClick={() => handleOpenEditModal(tag, 'tag')}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(tag.id, 'tag')}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
               </div>
               <p className="text-slate-500 text-sm mb-4 line-clamp-2">
                  {tag.description || 'Sem descrição definida.'}
               </p>
             </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/50 overflow-y-auto">
          <div className="min-h-screen flex items-center justify-center p-4">
            <div className={`bg-white rounded-xl shadow-xl w-full ${(activeTab === 'subcategorias' || activeTab === 'categorias') ? 'max-w-2xl overflow-visible' : 'max-w-md overflow-hidden max-h-[90vh]'} flex flex-col`}>
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-shrink-0">
              <h3 className="font-semibold text-slate-800">
                {modalMode === 'create' ? 'Nova' : 'Editar'} {activeTab === 'subcategorias' ? 'Subcategoria' : activeTab === 'categorias' ? 'Categoria' : 'Tag'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className={`p-6 space-y-4 ${(activeTab === 'subcategorias' || activeTab === 'categorias') ? 'overflow-visible' : 'overflow-y-auto'}`}>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder={activeTab === 'subcategorias' ? "Ex: Eletrocardiograma" : "Ex: Cardiologia"}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cor</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({...formData, color: e.target.value})}
                    className="w-10 h-10 p-0 border-0 rounded cursor-pointer"
                  />
                  <span className="text-sm text-slate-500 uppercase">{formData.color}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all h-24 resize-none"
                  placeholder="Uma breve descrição..."
                />
              </div>

              {/* Campos específicos de Subcategorias */}
              {activeTab === 'subcategorias' && (
                <>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                       <img src="/icons/categorias-popup.svg" alt="" width={14} height={14} className="text-gray-600 opacity-50" />
                       <span className="text-sm font-medium text-slate-700">Categorias Pai</span>
                       
                       <div className="relative">
                         <button
                           type="button"
                           className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
                           onClick={() => setShowCategorySelector(!showCategorySelector)}
                         >
                           <Plus className="w-4 h-4 text-slate-600" />
                         </button>
 
                         <TaxonomyDropdown
                           open={showCategorySelector}
                           onOpenChange={setShowCategorySelector}
                           items={categoryItemsForSelector}
                           isSelected={(item) => (formData.categoryIds || []).includes(item.id)}
                           onSelect={(item) => {
                             addCategory(item.id);
                             setShowCategorySelector(false);
                           }}
                           onCreate={createCategoryFromPayload}
                           onUpdate={updateCategoryFromPayload}
                           onDelete={deleteCategoryById}
                           searchPlaceholder="Pesquisar categorias..."
                           createLabel="Criar nova categoria"
                           defaultColor="#3B82F6"
                         />
                       </div>
                    </div>
                    <span className="text-xs text-slate-500">Categorias que serão vinculadas</span>
 
                       <div className="flex flex-wrap gap-2">
                       {formData.categoryIds.map(catId => {
                         const cat = categoryById.get(String(catId));
                         if (!cat) return null;
                         return (
                           <span key={cat.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-gray-200 bg-white text-xs text-slate-700">
                             <span className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: cat.color }}></span>
                             {cat.name}
                             <button onClick={() => removeCategory(cat.id)} className="text-slate-400 hover:text-red-500">
                               <X className="w-3 h-3" />
                             </button>
                           </span>
                         );
                       })}
                       {formData.categoryIds.length === 0 && (
                         <span className="text-xs text-slate-400 italic">Nenhuma categoria selecionada</span>
                       )}
                    </div>
                  </div>
                </>
              )}

              {/* SELETOR DE SUBCATEGORIAS (Apenas ao criar Categoria) */}
              {activeTab === 'categorias' && modalMode === 'create' && (
                <div className="flex flex-col gap-2">
                   <div className="flex items-center gap-2">
                      <img src="/icons/subcategoria-popup.svg" alt="" width={14} height={14} className="text-gray-600 opacity-50" />
                      <span className="text-sm font-medium text-slate-700">Subcategorias</span>
                      
                      <div className="relative">
                        <button
                          type="button"
                          className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
                          onClick={() => setShowSubcategorySelector(!showSubcategorySelector)}
                        >
                          <Plus className="w-4 h-4 text-slate-600" />
                        </button>

                        <TaxonomyDropdown
                          open={showSubcategorySelector}
                          onOpenChange={setShowSubcategorySelector}
                          items={subcategoryItemsForSelector}
                          isSelected={(item) => (formData.subcategoriesList || []).includes(item.name)}
                          onSelect={(item) => {
                            addSubcategoryFromSelector(item.name);
                            setShowSubcategorySelector(false);
                          }}
                          onCreate={createSubcategoryFromPayload}
                          searchPlaceholder="Buscar subcategoria"
                          createLabel="Criar nova subcategoria"
                          defaultColor="#3B82F6"
                        />
                      </div>
                   </div>
                   <span className="text-xs text-slate-500">Subcategorias que serão vinculadas</span>

                   <div className="flex flex-wrap gap-2">
                      {formData.subcategoriesList.map(sub => (
                        <span key={sub} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-gray-200 bg-white text-xs text-slate-700">
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{
                              backgroundColor:
                                draftSubcategoryMetaByName[sub]?.color
                                || subcategoryByNameLower.get(String(sub || '').toLowerCase())?.color
                                || '#94A3B8'
                            }}
                          ></span>
                          {sub}
                          <button onClick={() => removeSubcategoryFromList(sub)} className="text-slate-400 hover:text-red-500">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                      {formData.subcategoriesList.length === 0 && (
                        <span className="text-xs text-slate-400 italic">Nenhuma subcategoria adicionada</span>
                      )}
                   </div>
                </div>
              )}

              {/* SELETOR DE TAGS (Comum a ambos) */}
              {activeTab !== 'tags' && (
              <div className="flex flex-col gap-2 pt-2 border-t border-gray-50">
                 <div className="flex items-center gap-2">
                    <img src="/icons/tag-popup.svg" alt="" width={14} height={14} className="text-gray-600 opacity-50" />
                    <span className="text-sm font-medium text-slate-700">Tags</span>
                    
                    <div className="relative">
                      <button
                        type="button"
                        className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
                        onClick={() => setShowTagSelector(!showTagSelector)}
                      >
                        <Plus className="w-4 h-4 text-slate-600" />
                      </button>

                      <TaxonomyDropdown
                        open={showTagSelector}
                        onOpenChange={setShowTagSelector}
                        items={tagItemsForSelector}
                        isSelected={(item) => (formData.tags || []).includes(item.id)}
                        onSelect={(item) => {
                          addTag(item.id);
                          setShowTagSelector(false);
                        }}
                        onCreate={createTagFromPayload}
                        onUpdate={updateTagFromPayload}
                        onDelete={deleteTagById}
                        searchPlaceholder="Buscar tag"
                        createLabel="Criar nova tag"
                        defaultColor="#94A3B8"
                      />
                    </div>
                 </div>
                 <span className="text-xs text-slate-500">Tags que serão vinculadas</span>

                 <div className="flex flex-wrap gap-2">
                    {formData.tags.map(tagId => {
                      const tag = tagById.get(String(tagId))
                      if (!tag) return null
                      return (
                      <span key={tag.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-gray-200 bg-white text-xs text-slate-700">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tag.color || '#94A3B8' }}></span>
                        {tag.name}
                        <button onClick={() => removeTag(tag.id)} className="text-slate-400 hover:text-red-500">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                      )
                    })}
                    {formData.tags.length === 0 && (
                      <span className="text-xs text-slate-400 italic">Nenhuma tag adicionada</span>
                    )}
                 </div>
              </div>
              )}

            </div>

            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 flex-shrink-0">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-slate-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
        </div>,
        document.body
      )}
    </div>
  );
}
