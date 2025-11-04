// Dados mock para o frontend (sem Supabase)
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

class QuestionBankService {
  constructor() {
    // Usando apenas dados mock, sem Supabase
    this.isSupabaseAvailable = false;
  }

  async getQuestionBanks() {
    // Sempre usar dados mock (sem Supabase)
    console.log('Using mock data for question banks');
    return { data: mockQuestionBanks, error: null };
  }

  async createQuestionBank(questionBankData) {
    const newBank = {
      ...questionBankData,
      id: Date.now(), // ID temporário para mock
      question_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Sempre usar dados mock (sem Supabase)
    console.log('Creating question bank with mock data');
    mockQuestionBanks.unshift(newBank);
    return { data: newBank, error: null };
  }

  async updateQuestionBank(id, updates) {
    // Sempre usar dados mock (sem Supabase)
    console.log('Updating question bank with mock data');
    const index = mockQuestionBanks.findIndex(bank => bank.id === id);
    if (index !== -1) {
      mockQuestionBanks[index] = {
        ...mockQuestionBanks[index],
        ...updates,
        updated_at: new Date().toISOString()
      };
      return { data: mockQuestionBanks[index], error: null };
    }
    return { data: null, error: 'Question bank not found' };
  }

  async deleteQuestionBank(id) {
    // Sempre usar dados mock (sem Supabase)
    console.log('Deleting question bank with mock data');
    const index = mockQuestionBanks.findIndex(bank => bank.id === id);
    if (index !== -1) {
      const deletedBank = mockQuestionBanks.splice(index, 1)[0];
      return { data: deletedBank, error: null };
    }
    return { data: null, error: 'Question bank not found' };
  }
}

export const questionBankService = new QuestionBankService();
export default questionBankService;