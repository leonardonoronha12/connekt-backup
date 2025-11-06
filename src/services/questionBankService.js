import { supabase } from '@/lib/supabaseClient'

// Dados mock para o frontend (fallback)
const mockQuestionBanks = [
  {
    id: 1,
    name: 'Nome do banco de questões',
    category: 'Neurologia',
    subcategory: 'Subcategoria A',
    tags: [
      { id: 1, name: 'Tag', color: '#FFC107' },
      { id: 2, name: 'Tag', color: '#2196F3' }
    ],
    description: 'Descrição que foi adicionada no ato da criação do banco de questões',
    question_count: 50,
    created_at: '2025-08-20T10:00:00Z',
    updated_at: '2025-08-20T10:00:00Z'
  },
  {
    id: 2,
    name: 'Nome do banco de questões',
    category: 'Cardiologia',
    subcategory: 'Subcategoria B',
    tags: [
      { id: 3, name: 'Tag', color: '#F44336' },
      { id: 4, name: 'Tag Adicional', color: '#4CAF50' }
    ],
    description: 'Descrição que foi adicionada no ato da criação do banco de questões',
    question_count: 50,
    created_at: '2025-08-20T10:00:00Z',
    updated_at: '2025-08-20T10:00:00Z'
  }
];

async function getCurrentUserExternalId() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || '';
  } catch {
    return '';
  }
}

function mapDbRowToUi(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    tags: Array.isArray(row.tags) ? row.tags : [],
    category: row.category || '',
    subcategory: row.subcategory || '',
    questionCount: row.question_count ?? 0,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }
}

function isUuid(v) {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

class QuestionBankService {
  constructor() {
    // Tentar usar Supabase; fallback para mock em caso de erro
    this.isSupabaseAvailable = true;
  }

  async getQuestionBanks() {
    try {
      const producerExternalId = await getCurrentUserExternalId();
      let query = supabase
        .from('question_banks')
        .select('id,name,description,tags,category,subcategory,question_count,created_at,updated_at,producer_external_id')
        .order('created_at', { ascending: false });

      if (producerExternalId) {
        query = query.eq('producer_external_id', producerExternalId);
      }

      const { data, error } = await query;
      if (error) throw error;
      const mapped = (data || []).map(mapDbRowToUi);
      // Confiar na coluna question_count mantida por triggers; não consultar a tabela questions aqui
      return { data: mapped, error: null };
    } catch (error) {
      console.warn('getQuestionBanks fallback to mock:', error?.message || error);
      return { data: mockQuestionBanks.map(mapDbRowToUi), error: null };
    }
  }

  async getQuestionBankById(id) {
    try {
      // Se o ID não for UUID, evitar consulta ao Supabase e tentar localizar no mock
      if (!isUuid(id)) {
        const found = mockQuestionBanks.find(b => String(b.id) === String(id));
        if (found) return { data: mapDbRowToUi(found), error: null };
        return { data: null, error: 'Invalid question bank id' };
      }
      const { data, error } = await supabase
        .from('question_banks')
        .select('id,name,description,tags,category,subcategory,question_count,created_at,updated_at,producer_external_id')
        .eq('id', id)
        .single();

      if (error) throw error;
      const bank = mapDbRowToUi(data);
      // Confiar na coluna question_count mantida por triggers; não consultar a tabela questions aqui
      return { data: bank, error: null };
    } catch (error) {
      console.warn('getQuestionBankById fallback to mock:', error?.message || error);
      const found = mockQuestionBanks.find(b => String(b.id) === String(id));
      if (!found) {
        return { data: null, error: 'Question bank not found' };
      }
      return { data: mapDbRowToUi(found), error: null };
    }
  }

  async createQuestionBank(questionBankData) {
    // Normalizar tags: aceitar array de objetos (com name/color) ou strings
    const normalizedTags = Array.isArray(questionBankData.tags)
      ? questionBankData.tags
      : typeof questionBankData.tags === 'string'
        ? questionBankData.tags.split(',').map(t => ({ name: t.trim() })).filter(t => t.name.length > 0)
        : [];

    const payload = {
      name: (questionBankData.name || '').trim(),
      description: (questionBankData.description || '').trim(),
      category: (questionBankData.category || '').trim(),
      subcategory: (questionBankData.subcategory || '').trim(),
      tags: normalizedTags,
      question_count: 0,
      producer_external_id: await getCurrentUserExternalId(),
    };

    try {
      const { data, error } = await supabase
        .from('question_banks')
        .insert(payload)
        .select('id,name,description,tags,category,subcategory,question_count,created_at,updated_at,producer_external_id')
        .single();

      if (error) throw error;
      return { data: mapDbRowToUi(data), error: null };
    } catch (error) {
      console.warn('createQuestionBank fallback to mock:', error?.message || error);
      const newBank = {
        ...payload,
        id: Date.now(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      mockQuestionBanks.unshift(newBank);
      return { data: mapDbRowToUi(newBank), error: null };
    }
  }

  async updateQuestionBank(id, updates) {
    // Normalizar campos
    const normalizedUpdates = { ...updates };
    if (normalizedUpdates.tags && !Array.isArray(normalizedUpdates.tags)) {
      normalizedUpdates.tags = String(normalizedUpdates.tags)
        .split(',')
        .map(t => ({ name: t.trim() }))
        .filter(t => t.name.length > 0);
    }

    try {
      const { data, error } = await supabase
        .from('question_banks')
        .update({
          ...normalizedUpdates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('id,name,description,tags,category,subcategory,question_count,created_at,updated_at,producer_external_id')
        .single();

      if (error) throw error;
      return { data: mapDbRowToUi(data), error: null };
    } catch (error) {
      console.warn('updateQuestionBank fallback to mock:', error?.message || error);
      const index = mockQuestionBanks.findIndex(bank => bank.id === id);
      if (index !== -1) {
        mockQuestionBanks[index] = {
          ...mockQuestionBanks[index],
          ...normalizedUpdates,
          updated_at: new Date().toISOString()
        };
        return { data: mapDbRowToUi(mockQuestionBanks[index]), error: null };
      }
      return { data: null, error: 'Question bank not found' };
    }
  }

  async deleteQuestionBank(id) {
    try {
      const { error } = await supabase
        .from('question_banks')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { data: { id }, error: null };
    } catch (error) {
      console.warn('deleteQuestionBank fallback to mock:', error?.message || error);
      const index = mockQuestionBanks.findIndex(bank => bank.id === id);
      if (index !== -1) {
        const deletedBank = mockQuestionBanks.splice(index, 1)[0];
        return { data: mapDbRowToUi(deletedBank), error: null };
      }
      return { data: null, error: 'Question bank not found' };
    }
  }
}

export const questionBankService = new QuestionBankService();
export default questionBankService;