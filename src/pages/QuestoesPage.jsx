import React, { useState, useRef, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Plus } from 'lucide-react';
import questionBankService from '@/services/questionBankService';
import { useToast } from '@/components/ui/use-toast';

const QuestoesPage = () => {
  const { toast } = useToast();
  // Ler o bankId da URL para identificar o banco específico
  const [currentBankId, setCurrentBankId] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showUploadBox, setShowUploadBox] = useState(false);
  // Lista de questões e seleção atual
  const [questions, setQuestions] = useState([]);
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(null);
  // Seleções para criação do banco
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [selectedTags, setSelectedTags] = useState([]); // array de objetos { id, name, color, description }
  // Helpers para acessar/atualizar a questão selecionada
  const getSelectedQuestion = () => (
    selectedQuestionIndex !== null && questions[selectedQuestionIndex]
      ? questions[selectedQuestionIndex]
      : null
  );
  const updateSelectedQuestion = (partial) => {
    if (selectedQuestionIndex === null) return;
    setQuestions(prev => {
      const next = [...prev];
      const current = next[selectedQuestionIndex];
      if (!current) return next;
      next[selectedQuestionIndex] = { ...current, ...partial };
      return next;
    });
  };

  // Input de arquivo para imagem (ao clicar no ícone de imagem)
  const imageFileInputRef = useRef(null);
  const handleRevealUploadBox = () => {
    // Apenas revela o box de upload
    setShowUploadBox(true);
  };
  const handleOpenImageFileDialog = () => {
    // Abre o seletor de arquivos
    if (imageFileInputRef.current) {
      imageFileInputRef.current.click();
    }
  };

  // Efeito para capturar o bankId via query string ao montar
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const bankIdParam = params.get('bankId');
    if (bankIdParam) {
      // Usar o UUID diretamente (não converter para número)
      const bankId = bankIdParam;
      setCurrentBankId(bankId);
      (async () => {
        try {
          const { data, error } = await questionBankService.getQuestionBankById(bankId);
          if (error || !data) {
            toast({ description: 'Não foi possível carregar o banco selecionado', variant: 'destructive' });
            return;
          }
          // Pré-popular seleções com dados do banco
          setSelectedCategory(data.category || '');
          setSelectedSubcategory(data.subcategory || '');
          setSelectedTags(Array.isArray(data.tags) ? data.tags : []);
          toast({ description: `Banco selecionado: ${data.name || bankId}` });
        } catch (e) {
          console.error('Erro ao carregar banco por ID:', e);
          toast({ description: 'Erro ao carregar banco selecionado', variant: 'destructive' });
        }
      })();
    }
  }, []);
  const handleImageFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      // Mantém o comportamento atual sem alterar UI; apenas registra seleção
      console.log('Arquivo selecionado:', file.name, file.type, file.size);
    }
  };

  const handleCriarDoZero = () => {
    // Cria uma nova questão com campos próprios e seleciona para edição
    setQuestions(prev => {
      const newQuestion = {
        name: `Questão ${prev.length + 1}`,
        type: 'multiple_choice',
        required: false,
        text: '',
        choices: ['', '', '', ''],
        correctChoiceIndex: null,
        points: 5,
        attempts: 3,
      };
      const next = [...prev, newQuestion];
      setSelectedQuestionIndex(next.length - 1);
      return next;
    });
    setIsCreating(true);
  };

  const handleCriarComAI = () => {
    // Placeholder para ação futura
    console.log('Criar com A.I. clicado');
    alert('Em breve: criação assistida por A.I.');
  };

  // Estado "Obrigatório" passa a ser por questão (armazenado em questions)
  // Menu de categorias no sidebar direito
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  // Dropdown de categorias dentro do sidebar
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [categorySearchTerm, setCategorySearchTerm] = useState('');
  const categoryDropdownRef = useRef(null);

  // Estados e dados iguais ao QuestionBankPage
  const [categories, setCategories] = useState([
    { id: 1, name: 'Neurologia', color: '#8B5CF6', description: 'Especialidade médica que trata do sistema nervoso' },
    { id: 2, name: 'Cardiologia', color: '#EF4444', description: 'Especialidade médica que trata do coração e sistema cardiovascular' },
    { id: 3, name: 'Pediatria', color: '#10B981', description: 'Especialidade médica que cuida da saúde de crianças e adolescentes' },
    { id: 4, name: 'Ortopedia', color: '#F59E0B', description: 'Especialidade médica que trata do sistema musculoesquelético' },
    { id: 5, name: 'Dermatologia', color: '#06B6D4', description: 'Especialidade médica que trata da pele e seus anexos' }
  ]);
  const [isCreatingNewCategory, setIsCreatingNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#8B5CF6');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [editCategoryColor, setEditCategoryColor] = useState('#8B5CF6');
  const [editCategoryDescription, setEditCategoryDescription] = useState('');
  const [pendingDeleteCategoryId, setPendingDeleteCategoryId] = useState(null);

  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(categorySearchTerm.toLowerCase())
  );

  const handleStartCreatingCategory = () => {
    setIsCreatingNewCategory(true);
    setTimeout(() => {
      if (categoryDropdownRef.current) {
        categoryDropdownRef.current.scrollTop = categoryDropdownRef.current.scrollHeight;
      }
    }, 100);
  };

  const handleCreateNewCategory = () => {
    if (newCategoryName.trim() && newCategoryDescription.trim() &&
        !categories.some(cat => cat.name === newCategoryName.trim())) {
      const newCategory = {
        id: categories.length + 1,
        name: newCategoryName.trim(),
        color: newCategoryColor,
        description: newCategoryDescription.trim()
      };
      setCategories(prev => [...prev, newCategory]);
      setNewCategoryName('');
      setNewCategoryColor('#8B5CF6');
      setNewCategoryDescription('');
      setIsCreatingNewCategory(false);
      setShowCategoryDropdown(false);
      setCategorySearchTerm('');
    }
  };

  const handleCancelNewCategory = () => {
    setNewCategoryName('');
    setNewCategoryColor('#8B5CF6');
    setNewCategoryDescription('');
    setIsCreatingNewCategory(false);
    setCategorySearchTerm('');
  };

  const handleStartEditCategory = (category) => {
    setEditingCategoryId(category.id);
    setEditCategoryName(category.name);
    setEditCategoryColor(category.color);
    setEditCategoryDescription(category.description || '');
  };

  const handleCancelEditCategory = () => {
    setEditingCategoryId(null);
    setEditCategoryName('');
    setEditCategoryColor('#8B5CF6');
    setEditCategoryDescription('');
  };

  const handleSaveEditCategory = () => {
    if (!editCategoryName.trim() || !editCategoryDescription.trim() || !editingCategoryId) return;
    setCategories(prev => prev.map(cat => (
      cat.id === editingCategoryId
        ? { ...cat, name: editCategoryName.trim(), color: editCategoryColor, description: editCategoryDescription.trim() }
        : cat
    )));
    setEditingCategoryId(null);
    setEditCategoryName('');
    setEditCategoryColor('#8B5CF6');
    setEditCategoryDescription('');
  };

  const handleDeleteCategory = (id) => {
    setCategories(prev => prev.filter(c => c.id !== id));
    setPendingDeleteCategoryId(null);
  };

  const handleSelectCategory = (category) => {
    setSelectedCategory(category.name);
    toast({ description: `Categoria selecionada: ${category.name}` });
  };

  // Fechar dropdowns ao clicar fora da área dos dropdown-containers
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.dropdown-container')) {
        // Categorias
        setShowCategoryDropdown(false);
        setIsCreatingNewCategory(false);
        setCategorySearchTerm('');
        setPendingDeleteCategoryId(null);
        setEditingCategoryId(null);

        // Subcategorias
        setShowSubcategoryDropdown(false);
        setIsCreatingNewSubcategory(false);
        setSubcategorySearchTerm('');
        setPendingDeleteSubcategoryId(null);
        setEditingSubcategoryId(null);
        setNewSubcategoryName('');
        setNewSubcategoryColor('#22C55E');
        setNewSubcategoryDescription('');

        // Tags
        setShowTagsDropdown(false);
        setIsCreatingNewTag(false);
        setTagsSearchTerm('');
        setPendingDeleteTagId(null);
        setEditingTagId(null);
        setNewTagName('');
        setNewTagColor('#0EA5E9');
        setNewTagDescription('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Subcategorias: estados, dados e handlers
  const [showSubcategoryDropdown, setShowSubcategoryDropdown] = useState(false);
  const [subcategorySearchTerm, setSubcategorySearchTerm] = useState('');
  const subcategoryDropdownRef = useRef(null);
  const [subcategories, setSubcategories] = useState([
    { id: 1, name: 'Subcategoria A', color: '#22C55E', description: 'Descrição da Subcategoria A' },
    { id: 2, name: 'Subcategoria B', color: '#10B981', description: 'Descrição da Subcategoria B' },
    { id: 3, name: 'Subcategoria C', color: '#34D399', description: 'Descrição da Subcategoria C' },
    { id: 4, name: 'Subcategoria D', color: '#059669', description: 'Descrição da Subcategoria D' },
  ]);
  const [isCreatingNewSubcategory, setIsCreatingNewSubcategory] = useState(false);
  const [newSubcategoryName, setNewSubcategoryName] = useState('');
  const [newSubcategoryColor, setNewSubcategoryColor] = useState('#22C55E');
  const [newSubcategoryDescription, setNewSubcategoryDescription] = useState('');
  const [editingSubcategoryId, setEditingSubcategoryId] = useState(null);
  const [editSubcategoryName, setEditSubcategoryName] = useState('');
  const [editSubcategoryColor, setEditSubcategoryColor] = useState('#22C55E');
  const [editSubcategoryDescription, setEditSubcategoryDescription] = useState('');
  const [pendingDeleteSubcategoryId, setPendingDeleteSubcategoryId] = useState(null);

  const filteredSubcategories = subcategories.filter(subcategory =>
    subcategory.name.toLowerCase().includes(subcategorySearchTerm.toLowerCase())
  );

  const handleStartCreatingSubcategory = () => {
    setIsCreatingNewSubcategory(true);
    setTimeout(() => {
      if (subcategoryDropdownRef.current) {
        subcategoryDropdownRef.current.scrollTop = subcategoryDropdownRef.current.scrollHeight;
      }
    }, 100);
  };

  const handleCreateNewSubcategory = () => {
    if (newSubcategoryName.trim() && newSubcategoryDescription.trim() &&
        !subcategories.some(sc => sc.name === newSubcategoryName.trim())) {
      const newSc = {
        id: subcategories.length + 1,
        name: newSubcategoryName.trim(),
        color: newSubcategoryColor,
        description: newSubcategoryDescription.trim()
      };
      setSubcategories(prev => [...prev, newSc]);
      setNewSubcategoryName('');
      setNewSubcategoryColor('#22C55E');
      setNewSubcategoryDescription('');
      setIsCreatingNewSubcategory(false);
      setShowSubcategoryDropdown(false);
      setSubcategorySearchTerm('');
    }
  };

  const handleCancelNewSubcategory = () => {
    setNewSubcategoryName('');
    setNewSubcategoryColor('#22C55E');
    setNewSubcategoryDescription('');
    setIsCreatingNewSubcategory(false);
    setSubcategorySearchTerm('');
  };

  const handleStartEditSubcategory = (subcategory) => {
    setEditingSubcategoryId(subcategory.id);
    setEditSubcategoryName(subcategory.name);
    setEditSubcategoryColor(subcategory.color);
    setEditSubcategoryDescription(subcategory.description || '');
  };

  const handleCancelEditSubcategory = () => {
    setEditingSubcategoryId(null);
    setEditSubcategoryName('');
    setEditSubcategoryColor('#22C55E');
    setEditSubcategoryDescription('');
  };

  const handleSaveEditSubcategory = () => {
    if (!editSubcategoryName.trim() || !editSubcategoryDescription.trim() || !editingSubcategoryId) return;
    setSubcategories(prev => prev.map(sc => (
      sc.id === editingSubcategoryId
        ? { ...sc, name: editSubcategoryName.trim(), color: editSubcategoryColor, description: editSubcategoryDescription.trim() }
        : sc
    )));
    setEditingSubcategoryId(null);
    setEditSubcategoryName('');
    setEditSubcategoryColor('#22C55E');
    setEditSubcategoryDescription('');
  };

  const handleDeleteSubcategory = (id) => {
    setSubcategories(prev => prev.filter(s => s.id !== id));
    setPendingDeleteSubcategoryId(null);
  };

  const handleSelectSubcategory = (subcategory) => {
    setSelectedSubcategory(subcategory.name);
    toast({ description: `Subcategoria selecionada: ${subcategory.name}` });
  };

  // Tags: estados, dados e handlers
  const [showTagsDropdown, setShowTagsDropdown] = useState(false);
  const [tagsSearchTerm, setTagsSearchTerm] = useState('');
  const tagsDropdownRef = useRef(null);
  const [availableTags, setAvailableTags] = useState([
    { id: 1, name: 'Tag', color: '#FFC107', description: 'Marcador genérico' },
    { id: 2, name: 'Tag', color: '#2196F3', description: 'Etiqueta azul' },
    { id: 3, name: 'Tag', color: '#F44336', description: 'Etiqueta vermelha' },
    { id: 4, name: 'Tag Adicional', color: '#4CAF50', description: 'Etiqueta verde adicional' },
    { id: 5, name: 'Outra Tag', color: '#9C27B0', description: 'Outra etiqueta roxa' }
  ]);
  const [isCreatingNewTag, setIsCreatingNewTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#0EA5E9');
  const [newTagDescription, setNewTagDescription] = useState('');
  const [editingTagId, setEditingTagId] = useState(null);
  const [editTagName, setEditTagName] = useState('');
  const [editTagColor, setEditTagColor] = useState('#0EA5E9');
  const [editTagDescription, setEditTagDescription] = useState('');
  const [pendingDeleteTagId, setPendingDeleteTagId] = useState(null);

  const filteredTags = availableTags.filter(tag =>
    tag.name.toLowerCase().includes(tagsSearchTerm.toLowerCase())
  );

  const handleStartCreatingTag = () => {
    setIsCreatingNewTag(true);
    setTimeout(() => {
      if (tagsDropdownRef.current) {
        tagsDropdownRef.current.scrollTop = tagsDropdownRef.current.scrollHeight;
      }
    }, 100);
  };

  const handleCreateNewTag = () => {
    if (newTagName.trim() && newTagDescription.trim() &&
        !availableTags.some(t => t.name === newTagName.trim())) {
      const newTag = {
        id: availableTags.length + 1,
        name: newTagName.trim(),
        color: newTagColor,
        description: newTagDescription.trim()
      };
      setAvailableTags(prev => [...prev, newTag]);
      setNewTagName('');
      setNewTagColor('#0EA5E9');
      setNewTagDescription('');
      setIsCreatingNewTag(false);
      setShowTagsDropdown(false);
      setTagsSearchTerm('');
    }
  };

  const handleCancelNewTag = () => {
    setNewTagName('');
    setNewTagColor('#0EA5E9');
    setNewTagDescription('');
    setIsCreatingNewTag(false);
    setTagsSearchTerm('');
  };

  const handleStartEditTag = (tag) => {
    setEditingTagId(tag.id);
    setEditTagName(tag.name);
    setEditTagColor(tag.color);
    setEditTagDescription(tag.description || '');
  };

  const handleCancelEditTag = () => {
    setEditingTagId(null);
    setEditTagName('');
    setEditTagColor('#0EA5E9');
    setEditTagDescription('');
  };

  const handleSaveEditTag = () => {
    if (!editTagName.trim() || !editTagDescription.trim() || !editingTagId) return;
    setAvailableTags(prev => prev.map(t => (
      t.id === editingTagId
        ? { ...t, name: editTagName.trim(), color: editTagColor, description: editTagDescription.trim() }
        : t
    )));
    setEditingTagId(null);
    setEditTagName('');
    setEditTagColor('#0EA5E9');
    setEditTagDescription('');
  };

  const handleDeleteTag = (id) => {
    setAvailableTags(prev => prev.filter(t => t.id !== id));
    setPendingDeleteTagId(null);
  };

  const handleAddTag = (tag) => {
    setSelectedTags(prev => {
      if (prev.some(t => t.id === tag.id)) return prev; // evitar duplicatas
      return [...prev, tag];
    });
    toast({ description: `Tag adicionada: ${tag.name}` });
  };

  const handleRemoveSelectedTag = (id) => {
    setSelectedTags(prev => prev.filter(t => t.id !== id));
  };

  const handleCriarBanco = async () => {
    try {
      const questionBankData = {
        name: 'Banco de questões',
        category: selectedCategory || '',
        subcategory: selectedSubcategory || '',
        tags: selectedTags.map(t => t.name),
        description: ''
      };

      const { data, error } = await questionBankService.createQuestionBank(questionBankData);
      if (error) {
        toast({ description: 'Erro ao criar banco de questões: ' + error, variant: 'destructive' });
        return;
      }
      toast({ description: 'Banco de questões criado com sucesso!' });
      // Navegar para a página de banco de questões e mostrar o novo banco
      window.history.pushState({}, '', '/banco-de-questoes');
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (err) {
      console.error('Error creating question bank:', err);
      toast({ description: 'Erro ao conectar com o servidor', variant: 'destructive' });
    }
  };

  // Voltar para a página de Banco de Questões
  const handleVoltarParaBancoDeQuestoes = () => {
    toast({ description: 'Voltando para Banco de Questões' });
    window.history.pushState({}, '', '/banco-de-questoes');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Helmet>
        <title>Questões – Connekt</title>
        <meta name="description" content="Gerencie suas questões dentro do banco." />
      </Helmet>

      {/* Cabeçalho */}
      <div className="h-[59px] border-b border-gray-200 px-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            aria-label="Fechar"
            className="w-8 h-8 rounded-md bg-gray-100 border border-gray-200 text-gray-600 grid place-items-center"
            onClick={handleVoltarParaBancoDeQuestoes}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className="w-4 h-4"
              aria-hidden="true"
            >
              <g clipPath="url(#clip0_768_24326)">
                <path d="M12.5 3.5L3.5 12.5" stroke="#6B7588" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12.5 12.5L3.5 3.5" stroke="#6B7588" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </g>
              <defs>
                <clipPath id="clip0_768_24326">
                  <rect width="16" height="16" fill="white" />
                </clipPath>
              </defs>
            </svg>
          </button>

          <div className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              className="w-4 h-4"
              aria-hidden="true"
            >
              <g clipPath="url(#clip0_606_56057)">
                <path d="M7 7H11.8125" stroke="#0047BB" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7 3.5H11.8125" stroke="#0047BB" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7 10.5H11.8125" stroke="#0047BB" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2.1875 3.5L3.0625 4.375L4.8125 2.625" stroke="#0047BB" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2.1875 7L3.0625 7.875L4.8125 6.125" stroke="#0047BB" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2.1875 10.5L3.0625 11.375L4.8125 9.625" stroke="#0047BB" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </g>
              <defs>
                <clipPath id="clip0_606_56057">
                  <rect width="14" height="14" fill="white" />
                </clipPath>
              </defs>
            </svg>
            <span className="text-sm font-semibold text-black leading-[30px] break-words" style={{ fontFamily: 'Inter' }}>Questões</span>
          </div>
        </div>

        <div className="flex items-center gap-3 h-[35px]">
          <div className="w-px h-6 bg-gray-200" aria-hidden="true" />
          <button
            type="button"
            onClick={handleCriarBanco}
            className="h-[35px] px-4 rounded-[4px] border border-gray-200 bg-white text-[#0047BB] hover:bg-gray-50 font-semibold text-sm"
            style={{ fontSize: '14px', fontFamily: 'Inter', fontWeight: 600, lineHeight: '30px', wordWrap: 'break-word' }}
          >
            Criar banco
          </button>
        </div>
      </div>

      {/* Corpo */}
      <div className="flex flex-1 bg-gray-50">
        {/* Sidebar esquerda */}
        <aside className="w-72 border-r border-gray-200 bg-gray-100/60 px-5 py-6">
          <div className="flex items-center justify-between">
            <span
              className="text-sm font-semibold leading-[30px] break-words"
              style={{ color: 'var(--Miscellaneous-Window-Grabber, black)', fontFamily: 'Inter' }}
            >
              QUESTÕES
            </span>
            <button
              type="button"
              aria-label="Adicionar"
              className="w-6 h-6 rounded bg-white border border-gray-200 grid place-items-center"
              onClick={handleCriarDoZero}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                className="w-4 h-4"
                aria-hidden="true"
              >
                <g clipPath="url(#clip0_768_16604)">
                  <path d="M2.5 8H13.5" stroke="#6B7588" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M8 2.5V13.5" stroke="#6B7588" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </g>
                <defs>
                  <clipPath id="clip0_768_16604">
                    <rect width="16" height="16" fill="white" />
                  </clipPath>
                </defs>
              </svg>
            </button>
          </div>

          {/* Lista de questões */}
          <div
            className="mt-4 space-y-3"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                setSelectedQuestionIndex((prev) => {
                  if (prev === null || prev === undefined) return 0;
                  const next = Math.min(prev + 1, questions.length - 1);
                  return next;
                });
                setIsCreating(true);
              } else if (e.key === 'ArrowUp') {
                setSelectedQuestionIndex((prev) => {
                  if (prev === null || prev === undefined) return 0;
                  const next = Math.max(prev - 1, 0);
                  return next;
                });
                setIsCreating(true);
              }
            }}
          >
            {questions.map((q, idx) => (
              <div
                key={idx}
                className={`p-3 cursor-pointer border ${idx === selectedQuestionIndex ? 'rounded-[4px]' : 'rounded-[8px]'} ${idx === selectedQuestionIndex ? '' : 'bg-white border-gray-200'}`}
                style={idx === selectedQuestionIndex ? {
                  border: '1px solid var(--Stroke-Hover, #0047BB)',
                  background: 'var(--Background-Default, #F9FAFB)',
                  borderRadius: 'var(--Corner-Radius-4px, 4px)'
                } : undefined}
                onClick={() => { setSelectedQuestionIndex(idx); setIsCreating(true); }}
                role="button"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="flex items-center justify-center content-center flex-wrap w-[20px] h-[20px] aspect-square rounded-[var(--Corner-Radius-4px,4px)] bg-[var(--Button-Default,#0047BB)] text-white text-[12px] font-medium font-inter"
                      style={{ padding: 'var(--Spacing-0px, 0)', gap: '12px var(--Spacing-12px, 12px)' }}
                    >
                      {idx + 1}
                    </span>
                    <span className="text-[12px] font-medium" style={{ color: '#737780', fontFamily: 'Inter' }}>{q.name || 'Nome da questão'}</span>
                  </div>
                  <button type="button" className="w-6 h-6 rounded grid place-items-center hover:bg-gray-100">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 8.25C4.41421 8.25 4.75 7.91421 4.75 7.5C4.75 7.08579 4.41421 6.75 4 6.75C3.58579 6.75 3.25 7.08579 3.25 7.5C3.25 7.91421 3.58579 8.25 4 8.25Z" fill="#737780"/><path d="M8 8.25C8.41421 8.25 8.75 7.91421 8.75 7.5C8.75 7.08579 8.41421 6.75 8 6.75C7.58579 6.75 7.25 7.08579 7.25 7.5C7.25 7.91421 7.58579 8.25 8 8.25Z" fill="#737780"/><path d="M12 8.25C12.4142 8.25 12.75 7.91421 12.75 7.5C12.75 7.08579 12.4142 6.75 12 6.75C11.5858 6.75 11.25 7.08579 11.25 7.5C11.25 7.91421 11.5858 8.25 12 8.25Z" fill="#737780"/></svg>
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-4 h-4">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                      <g clipPath="url(#clip0_606_56476)">
                        <path d="M7 9.66895C7.09665 9.66895 7.1748 9.7471 7.1748 9.84375C7.1748 9.9404 7.09665 10.0186 7 10.0186C6.90335 10.0186 6.8252 9.9404 6.8252 9.84375C6.8252 9.7471 6.90335 9.66895 7 9.66895Z" fill="#0047BB" stroke="#0047BB" strokeWidth="1.4"/>
                        <path d="M7 12.25C9.8995 12.25 12.25 9.8995 12.25 7C12.25 4.10051 9.8995 1.75 7 1.75C4.10051 1.75 1.75 4.10051 1.75 7C1.75 9.8995 4.10051 12.25 7 12.25Z" stroke="#0047BB" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M7 7.65625V7.21875C7.96633 7.21875 8.75 6.53297 8.75 5.6875C8.75 4.84203 7.96633 4.15625 7 4.15625C6.03367 4.15625 5.25 4.84203 5.25 5.6875V5.90625" stroke="#0047BB" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      </g>
                      <defs>
                        <clipPath id="clip0_606_56476">
                          <rect width="14" height="14" fill="white"/>
                        </clipPath>
                      </defs>
                    </svg>
                  </span>
                  <span className="text-[12px] font-medium font-inter" style={{ color: '#22252B' }}>Questão de múltipla escolha</span>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Área principal */}
        <main className="flex-1 p-6">
          {questions.length > 0 ? (
            <div className="w-[951px] mx-auto">
              <div className="bg-white border border-gray-200 rounded-[8px] shadow-sm">
                {/* Header do card */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-4 h-4">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                        <g clipPath="url(#clip0_606_56476)">
                          <path d="M7 9.66895C7.09665 9.66895 7.1748 9.7471 7.1748 9.84375C7.1748 9.9404 7.09665 10.0186 7 10.0186C6.90335 10.0186 6.8252 9.9404 6.8252 9.84375C6.8252 9.7471 6.90335 9.66895 7 9.66895Z" fill="#0047BB" stroke="#0047BB" strokeWidth="1.4"/>
                          <path d="M7 12.25C9.8995 12.25 12.25 9.8995 12.25 7C12.25 4.10051 9.8995 1.75 7 1.75C4.10051 1.75 1.75 4.10051 1.75 7C1.75 9.8995 4.10051 12.25 7 12.25Z" stroke="#0047BB" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M7 7.65625V7.21875C7.96633 7.21875 8.75 6.53297 8.75 5.6875C8.75 4.84203 7.96633 4.15625 7 4.15625C6.03367 4.15625 5.25 4.84203 5.25 5.6875V5.90625" stroke="#0047BB" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                        </g>
                        <defs>
                          <clipPath id="clip0_606_56476">
                            <rect width="14" height="14" fill="white"/>
                          </clipPath>
                        </defs>
                      </svg>
                    </span>
                    <span className="text-[12px] font-medium font-inter" style={{ color: '#22252B' }}>Questão de múltipla escolha</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] font-inter" style={{ color: '#737780' }}>Obrigatório</span>
                    {/* Toggle real com cor ativa #0047BB */}
                    <div
                      className="w-9 h-5 rounded-full relative cursor-pointer"
                      style={{ backgroundColor: (selectedQuestionIndex !== null && questions[selectedQuestionIndex]?.required) ? '#0047BB' : '#E5E7EB' }}
                      onClick={() => {
                        if (selectedQuestionIndex !== null) {
                          const currentRequired = questions[selectedQuestionIndex]?.required || false;
                          updateSelectedQuestion({ required: !currentRequired });
                        }
                      }}
                      role="switch"
                      aria-checked={selectedQuestionIndex !== null && !!questions[selectedQuestionIndex]?.required}
                    >
                      <span
                        className="absolute top-0 w-5 h-5 rounded-full bg-white border shadow"
                        style={{
                          left: (selectedQuestionIndex !== null && questions[selectedQuestionIndex]?.required) ? 'calc(100% - 20px)' : 0,
                          borderColor: (selectedQuestionIndex !== null && questions[selectedQuestionIndex]?.required) ? '#0047BB' : '#D1D5DB'
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      className="flex flex-wrap items-center content-center p-[var(--Spacing-8px,8px)] gap-y-[12px] gap-x-[var(--Spacing-12px,12px)] rounded-[var(--Corner-Radius-4px,4px)] bg-[var(--Background-Content,#F6F5FA)]"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        className="w-4 h-4 aspect-square"
                        aria-hidden="true"
                      >
                        <g clipPath="url(#clip0_597_26184)">
                          <path d="M8 9C8.55228 9 9 8.55228 9 8C9 7.44772 8.55228 7 8 7C7.44772 7 7 7.44772 7 8C7 8.55228 7.44772 9 8 9Z" fill="#6B7588" />
                          <path d="M3.75 9C4.30228 9 4.75 8.55228 4.75 8C4.75 7.44772 4.30228 7 3.75 7C3.19772 7 2.75 7.44772 2.75 8C2.75 8.55228 3.19772 9 3.75 9Z" fill="#6B7588" />
                          <path d="M12.25 9C12.8023 9 13.25 8.55228 13.25 8C13.25 7.44772 12.8023 7 12.25 7C11.6977 7 11.25 7.44772 11.25 8C11.25 8.55228 11.6977 9 12.25 9Z" fill="#6B7588" />
                        </g>
                        <defs>
                          <clipPath id="clip0_597_26184">
                            <rect width="16" height="16" fill="white" />
                          </clipPath>
                        </defs>
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Corpo do card */}
                <div className="px-5 py-4">
                  {/* Campo título da questão */}
                  <div className="mb-4 flex items-start gap-3">
                  <div className="w-[523px] box-border">
                  <div className="flex items-center rounded-[8px] pl-0 pr-3 py-2 w-[523px] box-border">
                    <div className="flex items-center gap-2 w-[467px] shrink-0 box-border bg-[#F6F5FA] px-3 py-2 rounded-[4px]">
                      <span className="w-[20px] h-[20px] rounded bg-blue-600 text-white text-[12px] grid place-items-center">1</span>
                      <span className="text-[14px] font-semibold font-inter leading-[18px]" style={{ color: 'var(--Typography-Title, #22252B)', wordWrap: 'break-word' }}>Questão:</span>
                      <input
                        type="text"
                        placeholder="Digite aqui o nome de identificação da questão"
                        value={selectedQuestionIndex !== null && questions[selectedQuestionIndex] ? (questions[selectedQuestionIndex].name || '') : ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (selectedQuestionIndex !== null) {
                            setQuestions(prev => {
                              const next = [...prev];
                              if (next[selectedQuestionIndex]) {
                                next[selectedQuestionIndex] = { ...next[selectedQuestionIndex], name: val };
                              }
                              return next;
                            });
                          }
                        }}
                        className="flex-1 min-w-0 h-[30px] px-3 bg-transparent outline-none text-[14px] leading-[20px] font-normal font-inter break-words placeholder:text-[var(--Typography-Placeholder,#ABADB3)]"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="w-6 h-6"
                        style={{
                          display: 'flex',
                          padding: 'var(--Spacing-4px, 4px)',
                          alignItems: 'center',
                          alignContent: 'center',
                          gap: '12px var(--Spacing-12px, 12px)',
                          flexWrap: 'wrap',
                          borderRadius: 'var(--Corner-Radius-4px, 4px)',
                          border: '1px solid var(--Stroke-Default, #E3E4E5)',
                          background: 'var(--Background-Default, #F9FAFB)'
                        }}
                        onClick={handleRevealUploadBox}
                        aria-label="Selecionar imagem"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="13"
                          height="10"
                          viewBox="0 0 13 10"
                          fill="none"
                          className="w-[13px] h-[10px]"
                          aria-hidden="true"
                        >
                          <path
                            d="M11.2002 0.699219H1.2002C0.924053 0.699219 0.700195 0.923076 0.700195 1.19922V8.19922C0.700195 8.47536 0.924053 8.69922 1.2002 8.69922H11.2002C11.4763 8.69922 11.7002 8.47536 11.7002 8.19922V1.19922C11.7002 0.923076 11.4763 0.699219 11.2002 0.699219Z"
                            stroke="#6B7588"
                            strokeWidth="1.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="w-6 h-6"
                        style={{
                          display: 'flex',
                          padding: 'var(--Spacing-4px, 4px)',
                          alignItems: 'center',
                          alignContent: 'center',
                          gap: '12px var(--Spacing-12px, 12px)',
                          flexWrap: 'wrap',
                          borderRadius: 'var(--Corner-Radius-4px, 4px)',
                          border: '1px solid var(--Stroke-Default, #E3E4E5)',
                          background: 'var(--Background-Default, #F9FAFB)'
                        }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" className="w-4 h-4 aspect-square" aria-hidden="true">
                          <g clipPath="url(#clip0_597_7236)">
                            <path d="M13 2.5H3C2.72386 2.5 2.5 2.72386 2.5 3V13C2.5 13.2761 2.72386 13.5 3 13.5H13C13.2761 13.5 13.5 13.2761 13.5 13V3C13.5 2.72386 13.2761 2.5 13 2.5Z" stroke="#6B7588" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M6 7C6.55228 7 7 6.55228 7 6C7 5.44772 6.55228 5 6 5C5.44772 5 5 5.44772 5 6C5 6.55228 5.44772 7 6 7Z" stroke="#6B7588" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M3.54297 13.5004L10.3961 6.64664C10.4425 6.60015 10.4977 6.56328 10.5584 6.53811C10.6191 6.51295 10.6841 6.5 10.7498 6.5C10.8156 6.5 10.8806 6.51295 10.9413 6.53811C11.002 6.56328 11.0572 6.60015 11.1036 6.64664L13.4998 9.04352" stroke="#6B7588" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                          </g>
                          <defs>
                            <clipPath id="clip0_597_7236">
                              <rect width="16" height="16" fill="white"/>
                            </clipPath>
                          </defs>
                        </svg>
                      </button>
                      {/* Input de arquivo oculto para o botão de imagem */}
                      <input
                        ref={imageFileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/*"
                        className="hidden"
                        onChange={handleImageFileChange}
                      />
                    </div>
                  </div>
                    <textarea
                      placeholder="Adicione aqui a sua pergunta..."
                      className="w-[523px] h-[120px] px-3 py-2 rounded-[var(--Corner-Radius-4px,4px)] bg-[var(--Background-Content,#F6F5FA)] border border-gray-200 text-[12px] font-inter"
                      value={getSelectedQuestion()?.text || ''}
                      onChange={(e) => {
                        updateSelectedQuestion({ text: e.target.value });
                      }}
                    />
                  </div>
                  {/* Box de upload à direita do textarea (aparece ao clicar no botão) */}
                  {showUploadBox && (
                    <div
                      className="self-end mb-[2px] w-full h-[120px] p-6 rounded-md text-center text-[12px] bg-white border-2 border-dashed border-[#0047BB] cursor-pointer flex items-center justify-center"
                      onClick={handleOpenImageFileDialog}
                      role="button"
                      aria-label="Selecionar arquivo"
                    >
                      <div className="flex flex-col items-center justify-center gap-2">
                        <img src="/icone%20backup%20simulados.png" alt="Upload" className="w-[36px] h-[36px]" />
                        <p className="text-[#22252B]">
                          Arraste a capa aqui ou
                          <button type="button" className="text-[#0047BB] underline ml-1" onClick={handleOpenImageFileDialog}>selecione clicando aqui</button>
                        </p>
                        <p className="text-[#9AA0A6]">Max 10 MB, formato: PNG ou JPEG</p>
                      </div>
                    </div>
                  )}
                  </div>

                  {/* Escolhas */}
                  <div className="mb-4">
                    <span
                      className="block mb-2"
                      style={{
                        color: 'var(--Typography-Title, #22252B)',
                        fontFamily: 'var(--Font-Family-Family, Inter)',
                        fontSize: 'var(--Font-Size-Body-14px, 14px)',
                        fontStyle: 'normal',
                        fontWeight: 400,
                        lineHeight: '20px',
                      }}
                    >
                      Escolhas:
                    </span>

                    {(getSelectedQuestion()?.choices || []).map((value, idx) => (
                      <div key={idx} className="flex items-center gap-3 mb-2">
                        <span
                          onClick={() => {
                            const current = getSelectedQuestion();
                            if (!current) return;
                            const nextIndex = current.correctChoiceIndex === idx ? null : idx;
                            updateSelectedQuestion({ correctChoiceIndex: nextIndex });
                          }}
                          className={`inline-flex items-center justify-center h-[46px] w-[34px] rounded-[var(--Corner-Radius-4px,4px)] ${(getSelectedQuestion()?.correctChoiceIndex === idx) ? 'bg-[#06C270]' : 'bg-[var(--Background-Content,#F6F5FA)]'} cursor-pointer`}
                          style={{
                            color: (getSelectedQuestion()?.correctChoiceIndex === idx) ? '#EBEBEB' : 'var(--Typography-Title, #22252B)',
                            fontFamily: 'var(--Font-Family-Family, Inter)',
                            fontSize: 'var(--Font-Size-Body-14px, 14px)',
                            fontStyle: 'normal',
                            fontWeight: 600,
                            lineHeight: 'var(--Font-Size-Line-Height-Subtitle, 30px)'
                          }}
                          title="Marcar como correta"
                        >
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <input
                          type="text"
                          value={value}
                          placeholder="Digite sua escolha aqui."
                          className="flex-1 h-[32px] px-3 rounded-[var(--Corner-Radius-4px,4px)] bg-[var(--Background-Content,#F6F5FA)] text-[12px] font-inter"
                          onChange={(e) => {
                            const val = e.target.value;
                            const current = getSelectedQuestion();
                            if (!current) return;
                            const nextChoices = Array.isArray(current.choices) ? [...current.choices] : [];
                            nextChoices[idx] = val;
                            updateSelectedQuestion({ choices: nextChoices });
                          }}
                        />
                        <button
                          type="button"
                          className="flex flex-wrap items-center content-center p-[var(--Spacing-8px,8px)] gap-y-[12px] gap-x-[var(--Spacing-12px,12px)] rounded-[var(--Corner-Radius-4px,4px)] bg-[var(--Background-Content,#F6F5FA)]"
                          onClick={() => {
                            const current = getSelectedQuestion();
                            if (!current) return;
                            const nextChoices = (current.choices || []).filter((_, i) => i !== idx);
                            // Se remover a correta, limpa o índice
                            const nextCorrect = current.correctChoiceIndex === idx ? null : (
                              current.correctChoiceIndex !== null && current.correctChoiceIndex > idx
                                ? current.correctChoiceIndex - 1
                                : current.correctChoiceIndex
                            );
                            updateSelectedQuestion({ choices: nextChoices, correctChoiceIndex: nextCorrect });
                          }}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                            fill="none"
                            className="w-4 h-4 aspect-square"
                          >
                            <g clipPath="url(#clip0_597_16648)">
                              <path d="M13.5 3.5H2.5" stroke="#6B7588" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="M6.5 6.5V10.5" stroke="#6B7588" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="M9.5 6.5V10.5" stroke="#6B7588" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="M12.5 3.5V13C12.5 13.1326 12.4473 13.2598 12.3536 13.3536C12.2598 13.4473 12.1326 13.5 12 13.5H4C3.86739 13.5 3.74021 13.4473 3.64645 13.3536C3.55268 13.2598 3.5 13.1326 3.5 13V3.5" stroke="#6B7588" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="M10.5 3.5V2.5C10.5 2.23478 10.3946 1.98043 10.2071 1.79289C10.0196 1.60536 9.76522 1.5 9.5 1.5H6.5C6.23478 1.5 5.98043 1.60536 5.79289 1.79289C5.60536 1.98043 5.5 2.23478 5.5 2.5V3.5" stroke="#6B7588" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                            </g>
                            <defs>
                              <clipPath id="clip0_597_16648">
                                <rect width="16" height="16" fill="white" />
                              </clipPath>
                            </defs>
                          </svg>
                        </button>
                      </div>
                    ))}

                    <button
                      type="button"
                      className="mt-2 inline-flex items-center justify-center gap-2"
                      style={{
                        color: 'var(--Typography-Title-Color, #0047BB)',
                        textAlign: 'center',
                        fontFamily: 'var(--Font-Family-Family, Inter)',
                        fontSize: 'var(--Font-Size-Body-14px, 14px)',
                        fontStyle: 'normal',
                        fontWeight: 600,
                        lineHeight: 'var(--Font-Size-Line-Height-Subtitle, 30px)'
                      }}
                      onClick={() => {
                        const current = getSelectedQuestion();
                        if (!current) return;
                        const nextChoices = [...(current.choices || []), ''];
                        updateSelectedQuestion({ choices: nextChoices });
                      }}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        className="w-4 h-4 aspect-square"
                        aria-hidden="true"
                      >
                        <g clipPath="url(#clip0_300_24706)">
                          <path d="M2.5 8H13.5" stroke="#0047BB" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M8 2.5V13.5" stroke="#0047BB" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                        </g>
                        <defs>
                          <clipPath id="clip0_300_24706">
                            <rect width="16" height="16" fill="white"/>
                          </clipPath>
                        </defs>
                      </svg>
                      Add resposta
                    </button>
                  </div>

                  {/* Rodapé de pontos/tentativas */}
                  <div
                    className="flex items-start gap-[var(--Spacing-32px,32px)] pt-[var(--Spacing-22px,22px)]"
                    style={{ alignSelf: 'stretch', borderTop: '1px solid var(--Stroke-Default, #E3E4E5)' }}
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <span
                          className="font-inter"
                          style={{
                            color: 'var(--Typography-Title, #22252B)',
                            fontFamily: 'var(--Font-Family-Family, Inter)',
                            fontSize: 'var(--Font-Size-Body-14px, 14px)',
                            fontStyle: 'normal',
                            fontWeight: 400,
                            lineHeight: '20px'
                          }}
                        >
                          Pontos
                        </span>
                        <div className="mt-1 flex items-center h-[40px] py-[var(--Spacing-12px,12px)] px-[var(--Spacing-18px,18px)] gap-[var(--Spacing-16px,16px)] rounded-[var(--Corner-Radius-4px,4px)] bg-[var(--Background-Content,#F6F5FA)]">
                          <input
                            type="number"
                            value={getSelectedQuestion()?.points ?? 0}
                            onChange={(e) => {
                              const val = parseInt(e.target.value || '0', 10);
                              updateSelectedQuestion({ points: isNaN(val) ? 0 : val });
                            }}
                            className="w-[40px] h-[30px] px-2 rounded-[4px] bg-transparent"
                            style={{
                              color: 'var(--Typography-Title, #22252B)',
                              fontFamily: 'var(--Font-Family-Family, Inter)',
                              fontSize: 'var(--Font-Size-Body-12px, 12px)',
                              fontStyle: 'normal',
                              fontWeight: 500,
                              lineHeight: 'var(--Font-Size-Line-Height-Caption, 18px)'
                            }}
                          />
                          <span className="w-px h-[20px] bg-gray-200" aria-hidden="true"></span>
                          <div className="flex items-center gap-[var(--Spacing-0px,0)]">
                            <span
                              className="font-inter"
                              style={{
                                color: 'var(--Typography-Title, #22252B)',
                                fontFamily: 'var(--Font-Family-Family, Inter)',
                                fontSize: 'var(--Font-Size-Body-14px, 14px)',
                                fontStyle: 'normal',
                                fontWeight: 400,
                                lineHeight: '20px'
                              }}
                            >
                              Pontos
                            </span>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="14"
                              height="14"
                              viewBox="0 0 14 14"
                              fill="none"
                              className="w-[14px] h-[14px] aspect-square"
                              aria-hidden="true"
                            >
                              <rect width="14" height="14" rx="7" fill="#FFCC00" />
                              <g clipPath="url(#clip0_300_24719)">
                                <path d="M9.49165 6.69153L8.43696 7.60161L8.75829 8.96262C8.77602 9.03651 8.77145 9.11399 8.74517 9.18528C8.71888 9.25657 8.67206 9.31847 8.61062 9.36316C8.54917 9.40785 8.47586 9.43333 8.39994 9.43638C8.32402 9.43943 8.2489 9.4199 8.18407 9.38028L7.00047 8.65184L5.81618 9.38028C5.75136 9.41968 5.67633 9.43901 5.60054 9.43585C5.52475 9.43269 5.45159 9.40718 5.39027 9.36253C5.32895 9.31787 5.28222 9.25607 5.25595 9.18491C5.22968 9.11375 5.22506 9.03641 5.24266 8.96262L5.56516 7.60161L4.51047 6.69153C4.45312 6.64196 4.41164 6.5766 4.39122 6.5036C4.3708 6.43059 4.37233 6.35319 4.39563 6.28106C4.41894 6.20893 4.46297 6.14526 4.52225 6.098C4.58152 6.05075 4.6534 6.022 4.72891 6.01536L6.11172 5.9038L6.64516 4.61286C6.67403 4.5425 6.72318 4.48232 6.78634 4.43997C6.84951 4.39761 6.92384 4.375 6.99989 4.375C7.07594 4.375 7.15027 4.39761 7.21343 4.43997C7.2766 4.48232 7.32574 4.5425 7.35461 4.61286L7.88782 5.9038L9.27063 6.01536C9.34629 6.02176 9.41838 6.05034 9.47787 6.09753C9.53736 6.14472 9.5816 6.20842 9.60505 6.28064C9.62849 6.35286 9.63011 6.43039 9.60968 6.50353C9.58926 6.57666 9.54771 6.64214 9.49024 6.69176L9.49165 6.69153Z" fill="#22252B" />
                              </g>
                              <defs>
                                <clipPath id="clip0_300_24719">
                                  <rect width="6" height="6" fill="white" transform="translate(4 4)" />
                                </clipPath>
                              </defs>
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <span
                        className="font-inter"
                        style={{
                          color: 'var(--Typography-Title, #22252B)',
                          fontFamily: 'var(--Font-Family-Family, Inter)',
                          fontSize: 'var(--Font-Size-Body-14px, 14px)',
                          fontStyle: 'normal',
                          fontWeight: 400,
                          lineHeight: '20px'
                        }}
                      >
                        Tentativas
                      </span>
                      <div className="mt-1 flex items-center h-[40px] py-[var(--Spacing-12px,12px)] px-[var(--Spacing-18px,18px)] gap-[var(--Spacing-16px,16px)] rounded-[var(--Corner-Radius-4px,4px)] bg-[var(--Background-Content,#F6F5FA)]">
                        <input
                          type="number"
                          value={getSelectedQuestion()?.attempts ?? 0}
                          onChange={(e) => {
                            const val = parseInt(e.target.value || '0', 10);
                            updateSelectedQuestion({ attempts: isNaN(val) ? 0 : val });
                          }}
                          className="w-[40px] h-[30px] px-2 rounded-[4px] bg-transparent"
                          style={{
                            color: 'var(--Typography-Title, #22252B)',
                            fontFamily: 'var(--Font-Family-Family, Inter)',
                            fontSize: 'var(--Font-Size-Body-12px, 12px)',
                            fontStyle: 'normal',
                            fontWeight: 500,
                            lineHeight: 'var(--Font-Size-Line-Height-Caption, 18px)'
                          }}
                        />
                        <span className="w-px h-[20px] bg-gray-200" aria-hidden="true"></span>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                          className="w-[12px] h-[12px] aspect-square"
                          aria-hidden="true"
                        >
                          <g clipPath="url(#clip0_300_24727)">
                            <path d="M7.875 4.5H10.125V2.25" stroke="#0047BB" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M10.125 4.4986L8.79938 3.17297C8.03167 2.4053 6.99228 1.97123 5.90662 1.96491C4.82096 1.9586 3.77659 2.38054 3 3.13922" stroke="#0047BB" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M4.125 7.5H1.875V9.75" stroke="#0047BB" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M1.875 7.5L3.20062 8.82562C3.96833 9.5933 5.00772 10.0274 6.09338 10.0337C7.17904 10.04 8.22341 9.61806 9 8.85937" stroke="#0047BB" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                          </g>
                          <defs>
                            <clipPath id="clip0_300_24727">
                              <rect width="12" height="12" fill="white"/>
                            </clipPath>
                          </defs>
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ações abaixo do card */}
              <div className="flex items-center justify-center px-5 py-4">
                <button
                  type="button"
                  className="flex items-center justify-center h-[35px] py-[10px] px-[var(--Spacing-18px,18px)] gap-[6px] rounded-[var(--Corner-Radius-4px,4px)] bg-[var(--Background-Content,#F6F5FA)] text-[12px] text-[#22252B] font-inter"
                  onClick={handleCriarDoZero}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    className="w-[16px] h-[16px] aspect-square"
                    aria-hidden="true"
                  >
                    <g clipPath="url(#clip0_300_26333)">
                      <path d="M2.5 8H13.5" stroke="#0047BB" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M8 2.5V13.5" stroke="#0047BB" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </g>
                    <defs>
                      <clipPath id="clip0_300_26333">
                        <rect width="16" height="16" fill="white"/>
                      </clipPath>
                    </defs>
                  </svg>
                  <span
                    className="font-inter text-center"
                    style={{
                      color: 'var(--Typography-Title-Color, #0047BB)',
                      fontFamily: 'var(--Font-Family-Family, Inter)',
                      fontSize: 'var(--Font-Size-Body-14px, 14px)',
                      fontStyle: 'normal',
                      fontWeight: 600,
                      lineHeight: 'var(--Font-Size-Line-Height-Subtitle, 30px)',
                      textAlign: 'center'
                    }}
                  >
                    Add nova questão
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full grid place-items-center">
              <div className="text-center max-w-md flex flex-col justify-start gap-[22px]">
                <img
                  src="/1.svg"
                  alt="Ilustração banco vazio"
                  className="mx-auto w-[160px] h-[160px] opacity-80"
                />
                <div className="flex flex-col gap-[22px]">
                  <h2
                    className="text-base font-semibold"
                    style={{ color: 'var(--Typography-Title, #22252B)', fontSize: '16px', fontFamily: 'Inter', fontWeight: 600, lineHeight: '30px', wordWrap: 'break-word' }}
                  >
                    Banco vazio!
                  </h2>
                  <p
                    className="text-sm"
                    style={{ color: 'var(--Typography-Subtitle, #737780)', fontSize: '14px', fontFamily: 'Inter', fontWeight: 500, lineHeight: '18px', wordWrap: 'break-word' }}
                  >
                    Você não possui nenhuma questão neste banco de questões, adicione agora sua primeira questão
                  </p>
                </div>

                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleCriarDoZero}
                    className="inline-flex items-center justify-center gap-2 px-4 rounded border border-blue-600 hover:bg-blue-50"
                    style={{ width: '146px', height: '35px', color: 'var(--Typography-Title-Color, #0047BB)', fontSize: '14px', fontFamily: 'Inter', fontWeight: 600, lineHeight: '30px', wordWrap: 'break-word' }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <g clipPath="url(#clip0_606_56106)">
                        <path d="M5.79313 13.5001H3C2.86739 13.5001 2.74021 13.4474 2.64645 13.3536C2.55268 13.2599 2.5 13.1327 2.5 13.0001V10.207C2.50006 10.0745 2.55266 9.94753 2.64625 9.85383L10.3538 2.14633C10.4475 2.05263 10.5746 2 10.7072 2C10.8397 2 10.9669 2.05263 11.0606 2.14633L13.8538 4.93758C13.9474 5.03134 14.0001 5.15847 14.0001 5.29102C14.0001 5.42357 13.9474 5.5507 13.8538 5.64446L6.14625 13.3538C6.05255 13.4474 5.92556 13.5 5.79313 13.5001Z" stroke="#0047BB" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M8.5 4L12 7.5" stroke="#0047BB" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                      </g>
                      <defs>
                        <clipPath id="clip0_606_56106">
                          <rect width="16" height="16" fill="white"/>
                        </clipPath>
                      </defs>
                    </svg>
                    {' '}Criar do zero
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Sidebar direita com menu de categorias */}
        <aside
          className={`${isCategoriesOpen ? 'w-[300px] px-4 pt-4' : 'w-14 px-0 pt-[22px]'} bg-white`}
          style={{ borderLeft: '1px solid #E3E4E5' }}
        >
          {!isCategoriesOpen && (
            <div className="flex items-center justify-center">
              <button
                type="button"
                aria-label="Abrir menu de categorias"
                className="w-8 h-8 rounded grid place-items-center"
                style={{ backgroundColor: '#F6F5FA' }}
                onClick={() => setIsCategoriesOpen(true)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" className="w-4 h-4" aria-hidden="true">
                  <g clipPath="url(#clip0_768_18957)">
                    <path d="M12.1481 12.2775L15 8L12.1481 3.7225C12.1025 3.65409 12.0407 3.598 11.9682 3.55919C11.8957 3.52038 11.8147 3.50005 11.7325 3.5H2.5C2.36739 3.5 2.24021 3.55268 2.14645 3.64645C2.05268 3.74021 2 3.86739 2 4V12C2 12.1326 2.05268 12.2598 2.14645 12.3536C2.24021 12.4473 2.36739 12.5 2.5 12.5H11.7325C11.8147 12.5 11.8957 12.4796 11.9682 12.4408C12.0407 12.402 12.1025 12.3459 12.1481 12.2775Z" stroke="#22252B" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </g>
                  <defs>
                    <clipPath id="clip0_768_18957">
                      <rect width="16" height="16" fill="white" />
                    </clipPath>
                  </defs>
                </svg>
              </button>
            </div>
          )}

          {isCategoriesOpen && (
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold" style={{ color: '#22252B', fontFamily: 'Inter' }}>
                  Classificação do banco de questões
                </span>
                <button
                  type="button"
                  aria-label="Fechar menu de categorias"
                  className="w-7 h-7 rounded grid place-items-center hover:bg-gray-100"
                  onClick={() => setIsCategoriesOpen(false)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" className="w-4 h-4" aria-hidden="true">
                    <path d="M12 4L4 12" stroke="#6B7588" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M4 4L12 12" stroke="#6B7588" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>

              <div className="space-y-6 overflow-visible">
                {/* Categorias */}
                <div className="relative dropdown-container">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium" style={{ color: '#737780', fontFamily: 'Inter' }}>Categorias</span>
                    <button
                      type="button"
                      className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                      style={{ background: 'none' }}
                      aria-label="Adicionar categoria"
                      onClick={() => setShowCategoryDropdown(prev => !prev)}
                    >
                      <Plus className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>

                  {showCategoryDropdown && (
                    <div 
                      ref={categoryDropdownRef}
                      className="absolute top-8 left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[280px]"
                    >
                      <div className="p-3">
                        {/* Botão para fechar dropdown */}
                        <div className="flex items-center justify-end mb-2">
                          <button
                            type="button"
                            aria-label="Fechar dropdown"
                            className="w-6 h-6 rounded flex items-center justify-center hover:bg-gray-100"
                            onClick={() => {
                              setShowCategoryDropdown(false);
                              setIsCreatingNewCategory(false);
                              setCategorySearchTerm('');
                            }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" className="w-4 h-4" aria-hidden="true">
                              <path d="M12 4L4 12" stroke="#6B7588" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M4 4L12 12" stroke="#6B7588" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        </div>
                        {/* Campo de pesquisa */}
                        <div className="mb-3">
                          <input
                            type="text"
                            placeholder="Pesquisar categorias..."
                            value={categorySearchTerm}
                            onChange={(e) => setCategorySearchTerm(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            style={{ fontFamily: 'Inter', fontSize: '14px' }}
                          />
                        </div>

                        {/* Lista de categorias filtradas (apenas esta parte scrolla) */}
                        <div className="max-h-80 overflow-y-auto overflow-x-hidden">
                          {filteredCategories.map((category) => (
                            <div key={category.id} className="px-3 py-2 rounded-md transition-colors">
                              {editingCategoryId === category.id ? (
                                <div className="space-y-2">
                                  <input
                                    type="text"
                                    placeholder="Nome da categoria"
                                    value={editCategoryName}
                                    onChange={(e) => setEditCategoryName(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    style={{ fontFamily: 'Inter', fontSize: '14px' }}
                                  />
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      placeholder="Descrição"
                                      value={editCategoryDescription}
                                      onChange={(e) => setEditCategoryDescription(e.target.value)}
                                      className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                      style={{ fontFamily: 'Inter', fontSize: '14px' }}
                                    />
                                    <input
                                      type="color"
                                      value={editCategoryColor}
                                      onChange={(e) => setEditCategoryColor(e.target.value)}
                                      className="w-10 h-10 rounded-md border border-gray-200"
                                    />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button onClick={handleSaveEditCategory} className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">Salvar</button>
                                    <button onClick={handleCancelEditCategory} className="px-3 py-2 text-sm rounded-md hover:bg-gray-100">Cancelar</button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: category.color }}
                                  ></div>
                                  <div className="flex-1">
                                    <div className="font-medium" style={{ fontFamily: 'Inter', fontSize: '14px', color: '#374151' }}>{category.name}</div>
                                    <div className="text-xs text-gray-500 mt-0.5">{category.description}</div>
                                  </div>
                                  <div className="flex items-center gap-1 pr-2">
                                    <button
                                      onClick={() => handleSelectCategory(category)}
                                      className="px-2 py-1 text-xs rounded bg-blue-50 text-blue-600 hover:bg-blue-100"
                                    >
                                      Selecionar
                                    </button>
                                    <button
                                      onClick={() => setPendingDeleteCategoryId(category.id)}
                                      className="w-6 h-6 rounded flex items-center justify-center hover:bg-gray-100"
                                      aria-label="Excluir"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true" style={{ color: '#EF4444' }}>
                                        <polyline points="3 6 5 6 21 6"/>
                                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                        <path d="M10 11v6"/>
                                        <path d="M14 11v6"/>
                                        <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
                                      </svg>
                                    </button>
                                    <button
                                      onClick={() => handleStartEditCategory(category)}
                                      className="w-6 h-6 rounded flex items-center justify-center hover:bg-gray-100"
                                      aria-label="Editar"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
                                        <path d="M12 20h9"/>
                                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              )}

                              {pendingDeleteCategoryId === category.id && (
                                <div className="flex items-center justify-end gap-2 mt-2 pr-2">
                                  <button onClick={() => setPendingDeleteCategoryId(null)} className="text-xs px-2 py-1 rounded hover:bg-gray-100">Cancelar</button>
                                  <button onClick={() => handleDeleteCategory(category.id)} className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100">Excluir</button>
                                </div>
                              )}
                            </div>
                          ))}

                          {/* Mensagem quando não há categorias */}
                          {filteredCategories.length === 0 && categorySearchTerm && (
                            <div className="px-3 py-2 text-sm text-gray-500 text-center">
                              Nenhuma categoria encontrada
                            </div>
                          )}
                        </div>

                        {/* Separador */}
                        {filteredCategories.length > 0 && (
                          <div className="border-t border-gray-200 my-2"></div>
                        )}

                        {/* Opção para criar nova categoria */}
                        {!isCreatingNewCategory ? (
                          <button
                            onClick={handleStartCreatingCategory}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 rounded-md transition-colors flex items-center gap-2"
                            style={{ fontFamily: 'Inter', fontSize: '14px', color: '#2563eb' }}
                          >
                            <Plus className="w-4 h-4" />
                            Criar nova categoria
                          </button>
                        ) : (
                          <div className="space-y-3">
                            <input
                              type="text"
                              placeholder="Nome da nova categoria"
                              value={newCategoryName}
                              onChange={(e) => setNewCategoryName(e.target.value)}
                              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              style={{ fontFamily: 'Inter', fontSize: '14px' }}
                              autoFocus
                            />

                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                placeholder="Descrição"
                                value={newCategoryDescription}
                                onChange={(e) => setNewCategoryDescription(e.target.value)}
                                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                style={{ fontFamily: 'Inter', fontSize: '14px' }}
                              />
                              <input
                                type="color"
                                value={newCategoryColor}
                                onChange={(e) => setNewCategoryColor(e.target.value)}
                                className="w-10 h-10 rounded-md border border-gray-200"
                              />
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={handleCreateNewCategory}
                                className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                              >
                                Salvar
                              </button>
                              <button
                                onClick={handleCancelNewCategory}
                                className="px-3 py-2 text-sm rounded-md hover:bg-gray-100"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {/* Categoria: mesma aparência do span selecionado (Neurologia) */}
                    <span className="px-2 py-1 text-xs font-medium rounded flex items-center gap-1" style={{ backgroundColor: 'rgba(173, 137, 247, 0.1)', color: 'rgb(173, 137, 247)', fontFamily: 'Inter', fontSize: '12px', fontWeight: 500 }}>
                      <div className="w-[10px] h-[10px]" style={{ backgroundColor: 'rgb(173, 137, 247)' }}></div>
                      Neurologia
                      <button className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-black hover:bg-opacity-10 transition-colors ml-1" style={{ color: 'rgb(173, 137, 247)' }} aria-label="Remover">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3" aria-hidden="true">
                          <path d="M18 6 6 18"></path>
                          <path d="m6 6 12 12"></path>
                        </svg>
                      </button>
                    </span>
                  </div>
                </div>

                {/* Subcategorias */}
                <div className="relative dropdown-container">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium" style={{ color: '#737780', fontFamily: 'Inter' }}>Subcategorias</span>
                    <button
                      type="button"
                      className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                      style={{ background: 'none' }}
                      aria-label="Adicionar subcategoria"
                      onClick={() => setShowSubcategoryDropdown(prev => !prev)}
                    >
                      <Plus className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>

                  {showSubcategoryDropdown && (
                    <div 
                      ref={subcategoryDropdownRef}
                      className="absolute top-8 left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[280px]"
                    >
                      <div className="p-3">
                        {/* Botão para fechar dropdown */}
                        <div className="flex items-center justify-end mb-2">
                          <button
                            type="button"
                            aria-label="Fechar dropdown"
                            className="w-6 h-6 rounded flex items-center justify-center hover:bg-gray-100"
                            onClick={() => {
                              setShowSubcategoryDropdown(false);
                              setIsCreatingNewSubcategory(false);
                              setSubcategorySearchTerm('');
                            }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" className="w-4 h-4" aria-hidden="true">
                              <path d="M12 4L4 12" stroke="#6B7588" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M4 4L12 12" stroke="#6B7588" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        </div>
                        {/* Campo de pesquisa */}
                        <div className="mb-3">
                          <input
                            type="text"
                            placeholder="Buscar subcategoria"
                            value={subcategorySearchTerm}
                            onChange={(e) => setSubcategorySearchTerm(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            style={{ fontFamily: 'Inter', fontSize: '14px' }}
                          />
                        </div>

                        {/* Lista de subcategorias filtradas (apenas esta parte scrolla) */}
                        <div className="max-h-80 overflow-y-auto overflow-x-hidden">
                          {filteredSubcategories.map((subcategory) => (
                            <div key={subcategory.id} className="px-3 py-2 rounded-md transition-colors">
                              {editingSubcategoryId === subcategory.id ? (
                                <div className="space-y-2">
                                  <input
                                    type="text"
                                    placeholder="Nome da subcategoria"
                                    value={editSubcategoryName}
                                    onChange={(e) => setEditSubcategoryName(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    style={{ fontFamily: 'Inter', fontSize: '14px' }}
                                  />
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      placeholder="Descrição"
                                      value={editSubcategoryDescription}
                                      onChange={(e) => setEditSubcategoryDescription(e.target.value)}
                                      className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                      style={{ fontFamily: 'Inter', fontSize: '14px' }}
                                    />
                                    <input
                                      type="color"
                                      value={editSubcategoryColor}
                                      onChange={(e) => setEditSubcategoryColor(e.target.value)}
                                      className="w-10 h-10 rounded-md border border-gray-200"
                                    />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button onClick={handleSaveEditSubcategory} className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">Salvar</button>
                                    <button onClick={handleCancelEditSubcategory} className="px-3 py-2 text-sm rounded-md hover:bg-gray-100">Cancelar</button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: subcategory.color }}
                                  ></div>
                                  <div className="flex-1">
                                    <div className="font-medium" style={{ fontFamily: 'Inter', fontSize: '14px', color: '#374151' }}>{subcategory.name}</div>
                                    <div className="text-xs text-gray-500 mt-0.5">{subcategory.description}</div>
                                  </div>
                                  <div className="flex items-center gap-1 pr-2">
                                    <button
                                      onClick={() => handleSelectSubcategory(subcategory)}
                                      className="px-2 py-1 text-xs rounded bg-blue-50 text-blue-600 hover:bg-blue-100"
                                    >
                                      Selecionar
                                    </button>
                                    <button
                                      onClick={() => setPendingDeleteSubcategoryId(subcategory.id)}
                                      className="w-6 h-6 rounded flex items-center justify-center hover:bg-gray-100"
                                      aria-label="Excluir"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true" style={{ color: '#EF4444' }}>
                                        <polyline points="3 6 5 6 21 6"/>
                                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                        <path d="M10 11v6"/>
                                        <path d="M14 11v6"/>
                                        <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
                                      </svg>
                                    </button>
                                    <button
                                      onClick={() => handleStartEditSubcategory(subcategory)}
                                      className="w-6 h-6 rounded flex items-center justify-center hover:bg-gray-100"
                                      aria-label="Editar"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
                                        <path d="M12 20h9"/>
                                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              )}

                              {pendingDeleteSubcategoryId === subcategory.id && (
                                <div className="flex items-center justify-end gap-2 mt-2 pr-2">
                                  <button onClick={() => setPendingDeleteSubcategoryId(null)} className="text-xs px-2 py-1 rounded hover:bg-gray-100">Cancelar</button>
                                  <button onClick={() => handleDeleteSubcategory(subcategory.id)} className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100">Excluir</button>
                                </div>
                              )}
                            </div>
                          ))}

                          {/* Mensagem quando não há subcategorias */}
                          {filteredSubcategories.length === 0 && subcategorySearchTerm && (
                            <div className="px-3 py-2 text-sm text-gray-500 text-center">
                              Nenhuma subcategoria encontrada
                            </div>
                          )}
                        </div>

                        {/* Separador */}
                        {filteredSubcategories.length > 0 && (
                          <div className="border-t border-gray-200 my-2"></div>
                        )}

                        {/* Opção para criar nova subcategoria */}
                        {!isCreatingNewSubcategory ? (
                          <button
                            onClick={handleStartCreatingSubcategory}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 rounded-md transition-colors flex items-center gap-2"
                            style={{ fontFamily: 'Inter', fontSize: '14px', color: '#2563eb' }}
                          >
                            <Plus className="w-4 h-4" />
                            Criar nova subcategoria
                          </button>
                        ) : (
                          <div className="space-y-3">
                            <input
                              type="text"
                              placeholder="Nome da nova subcategoria"
                              value={newSubcategoryName}
                              onChange={(e) => setNewSubcategoryName(e.target.value)}
                              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              style={{ fontFamily: 'Inter', fontSize: '14px' }}
                              autoFocus
                            />

                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                placeholder="Descrição"
                                value={newSubcategoryDescription}
                                onChange={(e) => setNewSubcategoryDescription(e.target.value)}
                                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                style={{ fontFamily: 'Inter', fontSize: '14px' }}
                              />
                              <input
                                type="color"
                                value={newSubcategoryColor}
                                onChange={(e) => setNewSubcategoryColor(e.target.value)}
                                className="w-10 h-10 rounded-md border border-gray-200"
                              />
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={handleCreateNewSubcategory}
                                className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                              >
                                Salvar
                              </button>
                              <button
                                onClick={handleCancelNewSubcategory}
                                className="px-3 py-2 text-sm rounded-md hover:bg-gray-100"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {/* Subcategoria: mesma aparência do span selecionado (Subcategoria A) */}
                    <span className="px-2 py-1 text-xs font-medium rounded flex items-center gap-1" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: 'rgb(34, 197, 94)', fontFamily: 'Inter', fontSize: '12px', fontWeight: 500 }}>
                      <div className="w-[10px] h-[10px]" style={{ backgroundColor: 'rgb(34, 197, 94)' }}></div>
                      Subcategoria A
                      <button className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-black hover:bg-opacity-10 transition-colors ml-1" style={{ color: 'rgb(34, 197, 94)' }} aria-label="Remover">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3" aria-hidden="true">
                          <path d="M18 6 6 18"></path>
                          <path d="m6 6 12 12"></path>
                        </svg>
                      </button>
                    </span>
                  </div>
                </div>

                {/* Tags */}
                <div className="relative dropdown-container">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium" style={{ color: '#737780', fontFamily: 'Inter' }}>Tags</span>
                    <button
                      type="button"
                      className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                      style={{ background: 'none' }}
                      aria-label="Adicionar tag"
                      onClick={() => setShowTagsDropdown(prev => !prev)}
                    >
                      <Plus className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>

                  {showTagsDropdown && (
                    <div 
                      ref={tagsDropdownRef}
                      className="absolute top-8 left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[280px]"
                    >
                      <div className="p-3">
                        {/* Botão para fechar dropdown */}
                        <div className="flex items-center justify-end mb-2">
                          <button
                            type="button"
                            aria-label="Fechar dropdown"
                            className="w-6 h-6 rounded flex items-center justify-center hover:bg-gray-100"
                            onClick={() => {
                              setShowTagsDropdown(false);
                              setIsCreatingNewTag(false);
                              setTagsSearchTerm('');
                            }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" className="w-4 h-4" aria-hidden="true">
                              <path d="M12 4L4 12" stroke="#6B7588" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M4 4L12 12" stroke="#6B7588" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        </div>
                        {/* Campo de pesquisa */}
                        <div className="mb-3">
                          <input
                            type="text"
                            placeholder="Buscar tag"
                            value={tagsSearchTerm}
                            onChange={(e) => setTagsSearchTerm(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            style={{ fontFamily: 'Inter', fontSize: '14px' }}
                          />
                        </div>

                        {/* Lista de tags filtradas (apenas esta parte scrolla) */}
                        <div className="max-h-80 overflow-y-auto overflow-x-hidden">
                          {filteredTags.map((tag) => (
                            <div key={tag.id} className="px-3 py-2 rounded-md transition-colors">
                              {editingTagId === tag.id ? (
                                <div className="space-y-2">
                                  <input
                                    type="text"
                                    placeholder="Nome da tag"
                                    value={editTagName}
                                    onChange={(e) => setEditTagName(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    style={{ fontFamily: 'Inter', fontSize: '14px' }}
                                  />
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      placeholder="Descrição"
                                      value={editTagDescription}
                                      onChange={(e) => setEditTagDescription(e.target.value)}
                                      className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                      style={{ fontFamily: 'Inter', fontSize: '14px' }}
                                    />
                                    <input
                                      type="color"
                                      value={editTagColor}
                                      onChange={(e) => setEditTagColor(e.target.value)}
                                      className="w-10 h-10 rounded-md border border-gray-200"
                                    />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button onClick={handleSaveEditTag} className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">Salvar</button>
                                    <button onClick={handleCancelEditTag} className="px-3 py-2 text-sm rounded-md hover:bg-gray-100">Cancelar</button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: tag.color }}
                                  ></div>
                                  <div className="flex-1">
                                    <div className="font-medium" style={{ fontFamily: 'Inter', fontSize: '14px', color: '#374151' }}>{tag.name}</div>
                                    <div className="text-xs text-gray-500 mt-0.5">{tag.description}</div>
                                  </div>
                                  <div className="flex items-center gap-1 pr-2">
                                    <button
                                      onClick={() => handleAddTag(tag)}
                                      className="px-2 py-1 text-xs rounded bg-blue-50 text-blue-600 hover:bg-blue-100"
                                    >
                                      Adicionar
                                    </button>
                                    <button
                                      onClick={() => setPendingDeleteTagId(tag.id)}
                                      className="w-6 h-6 rounded flex items-center justify-center hover:bg-gray-100"
                                      aria-label="Excluir"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true" style={{ color: '#EF4444' }}>
                                        <polyline points="3 6 5 6 21 6"/>
                                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                        <path d="M10 11v6"/>
                                        <path d="M14 11v6"/>
                                        <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
                                      </svg>
                                    </button>
                                    <button
                                      onClick={() => handleStartEditTag(tag)}
                                      className="w-6 h-6 rounded flex items-center justify-center hover:bg-gray-100"
                                      aria-label="Editar"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
                                        <path d="M12 20h9"/>
                                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              )}

                              {pendingDeleteTagId === tag.id && (
                                <div className="flex items-center justify-end gap-2 mt-2 pr-2">
                                  <button onClick={() => setPendingDeleteTagId(null)} className="text-xs px-2 py-1 rounded hover:bg-gray-100">Cancelar</button>
                                  <button onClick={() => handleDeleteTag(tag.id)} className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100">Excluir</button>
                                </div>
                              )}
                            </div>
                          ))}

                          {/* Mensagem quando não há tags */}
                          {filteredTags.length === 0 && tagsSearchTerm && (
                            <div className="px-3 py-2 text-sm text-gray-500 text-center">
                              Nenhuma tag encontrada
                            </div>
                          )}
                        </div>

                        {/* Separador */}
                        {filteredTags.length > 0 && (
                          <div className="border-t border-gray-200 my-2"></div>
                        )}

                        {/* Opção para criar nova tag */}
                        {!isCreatingNewTag ? (
                          <button
                            onClick={handleStartCreatingTag}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 rounded-md transition-colors flex items-center gap-2"
                            style={{ fontFamily: 'Inter', fontSize: '14px', color: '#2563eb' }}
                          >
                            <Plus className="w-4 h-4" />
                            Criar nova tag
                          </button>
                        ) : (
                          <div className="space-y-3">
                            <input
                              type="text"
                              placeholder="Nome da nova tag"
                              value={newTagName}
                              onChange={(e) => setNewTagName(e.target.value)}
                              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              style={{ fontFamily: 'Inter', fontSize: '14px' }}
                              autoFocus
                            />

                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                placeholder="Descrição"
                                value={newTagDescription}
                                onChange={(e) => setNewTagDescription(e.target.value)}
                                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                style={{ fontFamily: 'Inter', fontSize: '14px' }}
                              />
                              <input
                                type="color"
                                value={newTagColor}
                                onChange={(e) => setNewTagColor(e.target.value)}
                                className="w-10 h-10 rounded-md border border-gray-200"
                              />
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={handleCreateNewTag}
                                className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                              >
                                Salvar
                              </button>
                              <button
                                onClick={handleCancelNewTag}
                                className="px-3 py-2 text-sm rounded-md hover:bg-gray-100"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {selectedTags.map(tag => (
                      <span key={tag.id} className="px-3 py-1 text-sm flex items-center gap-2" style={{ backgroundColor: 'rgba(255, 193, 7, 0.125)', color: 'rgb(255, 193, 7)', fontFamily: 'Inter', fontSize: '12px', fontWeight: 500, borderRadius: '4px' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                          <line x1="7" y1="7" x2="7.01" y2="7"></line>
                        </svg>
                        {tag.name}
                        <button type="button" className="ml-1 hover:bg-red-100 rounded-full p-0.5 transition-colors" style={{ color: 'rgb(255, 193, 7)' }} aria-label="Remover" onClick={() => handleRemoveSelectedTag(tag.id)}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Botão removido conforme solicitado */}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default QuestoesPage;