import React from 'react';
import { Button } from '@/components/ui/button';

export interface Question {
  id: string;
  name: string;
  bankId: string;
}

interface Props {
  questions: Question[];
  onRemoveQuestion: (questionId: string) => void;
}

export const SelectedQuestionsComponent: React.FC<Props> = ({ questions, onRemoveQuestion }) => {
  return (
    <div className="bg-white border border-[#E3E4E5] rounded-[10px] p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[16px] font-semibold text-[#000000]">Selecionadas</h2>
        <span className="text-[12px] text-[#3A3D45]">Total: {questions.length}</span>
      </div>

      {questions.length === 0 ? (
        <div className="text-[13px] text-[#ABADB3]">Nenhuma questão selecionada</div>
      ) : (
        <ul className="space-y-2">
          {questions.map((q) => (
            <li key={q.id} className="flex items-center justify-between">
              <span className="text-[13px] text-[#3A3D45]">{q.name}</span>
              <Button size="sm" variant="outline" onClick={() => onRemoveQuestion(q.id)}>
                Remover
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};