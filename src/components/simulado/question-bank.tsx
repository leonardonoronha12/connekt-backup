import React from 'react';
import { Button } from '@/components/ui/button';

export interface Question {
  id: string;
  name: string;
  bankId: string;
}

export interface QuestionBank {
  id: string;
  name: string;
  questions: Question[];
  expanded: boolean;
}

interface Props {
  banks: QuestionBank[];
  selectedQuestions: Question[];
  onToggleBank: (bankId: string) => void;
  onAddQuestion: (question: Question) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export const QuestionBankComponent: React.FC<Props> = ({
  banks,
  selectedQuestions,
  onToggleBank,
  onAddQuestion,
  searchQuery,
  onSearchChange,
}) => {
  return (
    <div className="bg-white border border-[#E3E4E5] rounded-[10px] p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[16px] font-semibold text-[#000000]">Bancos de questões</h2>
        <span className="text-[12px] text-[#3A3D45]">Selecionadas: {selectedQuestions.length}</span>
      </div>

      <div className="mb-4">
        <input
          className="w-full px-3 py-2 border border-[#E3E4E5] rounded focus:outline-none focus:ring-2 focus:ring-[#0047BB]"
          placeholder="Buscar questões..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        {banks.map((bank) => (
          <div key={bank.id} className="border border-[#E3E4E5] rounded-[6px]">
            <button
              type="button"
              className="w-full flex items-center justify-between px-3 py-2 bg-[#F6F5FA]"
              onClick={() => onToggleBank(bank.id)}
            >
              <span className="text-[14px] text-[#22252B] font-medium">{bank.name}</span>
              <span className="text-[12px] text-[#ABADB3]">{bank.expanded ? 'Ocultar' : 'Mostrar'} ({bank.questions.length})</span>
            </button>
            {bank.expanded && (
              <ul className="p-3 space-y-2">
                {bank.questions.map((q) => (
                  <li key={q.id} className="flex items-center justify-between">
                    <span className="text-[13px] text-[#3A3D45]">{q.name}</span>
                    <Button size="sm" variant="outline" onClick={() => onAddQuestion(q)}>
                      Adicionar
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};