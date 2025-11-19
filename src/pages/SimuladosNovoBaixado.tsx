"use client"

import { useState } from "react"
import { QuestionBankComponent } from "@/components/simulado/question-bank"
import { SelectedQuestionsComponent } from "@/components/simulado/selected-questions"
import { SimulationMetadataComponent } from "@/components/simulado/simulation-metadata"
import { ConfigurationsSidebarComponent } from "@/components/simulado/configurations-sidebar"
import { Button } from "@/components/ui/button"
import { Info } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Question {
  id: string
  name: string
  bankId: string
}

interface QuestionBank {
  id: string
  name: string
  questions: Question[]
  expanded: boolean
}

const mockBanks: QuestionBank[] = [
  {
    id: "1",
    name: "Cardiologia",
    expanded: false,
    questions: [
      { id: "q1", name: "Nome da questão", bankId: "1" },
      { id: "q2", name: "Nome da questão", bankId: "1" },
      { id: "q3", name: "Nome da questão", bankId: "1" },
      { id: "q4", name: "Nome da questão", bankId: "1" },
      { id: "q5", name: "Nome da questão", bankId: "1" },
    ],
  },
  {
    id: "2",
    name: "Neurologia",
    expanded: false,
    questions: [
      { id: "q6", name: "Nome da questão", bankId: "2" },
      { id: "q7", name: "Nome da questão", bankId: "2" },
      { id: "q8", name: "Nome da questão", bankId: "2" },
      { id: "q9", name: "Nome da questão", bankId: "2" },
      { id: "q10", name: "Nome da questão", bankId: "2" },
    ],
  },
  {
    id: "3",
    name: "Obstetrícia",
    expanded: false,
    questions: [
      { id: "q11", name: "Nome da questão", bankId: "3" },
      { id: "q12", name: "Nome da questão", bankId: "3" },
      { id: "q13", name: "Nome da questão", bankId: "3" },
      { id: "q14", name: "Nome da questão", bankId: "3" },
      { id: "q15", name: "Nome da questão", bankId: "3" },
    ],
  },
  {
    id: "4",
    name: "Cirurgia",
    expanded: false,
    questions: [
      { id: "q16", name: "Nome da questão", bankId: "4" },
      { id: "q17", name: "Nome da questão", bankId: "4" },
      { id: "q18", name: "Nome da questão", bankId: "4" },
      { id: "q19", name: "Nome da questão", bankId: "4" },
      { id: "q20", name: "Nome da questão", bankId: "4" },
    ],
  },
]

export default function NovoSimuladoPage() {
  const [banks, setBanks] = useState<QuestionBank[]>(mockBanks)
  const [selectedQuestions, setSelectedQuestions] = useState<Question[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const { toast } = useToast()

  const toggleBank = (bankId: string) => {
    setBanks(banks.map((bank) => (bank.id === bankId ? { ...bank, expanded: !bank.expanded } : bank)))
  }

  const addQuestion = (question: Question) => {
    if (!selectedQuestions.find((q) => q.id === question.id)) {
      setSelectedQuestions([...selectedQuestions, question])
      toast({
        description: "Questão adicionada com sucesso",
      })
    }
  }

  const removeQuestion = (questionId: string) => {
    setSelectedQuestions(selectedQuestions.filter((q) => q.id !== questionId))
    toast({
      description: "Questão removida com sucesso",
    })
  }

  const filteredBanks = banks
    .map((bank) => ({
      ...bank,
      questions: bank.questions.filter((q) => q.name.toLowerCase().includes(searchQuery.toLowerCase())),
    }))
    .filter((bank) => bank.questions.length > 0 || bank.name.toLowerCase().includes(searchQuery.toLowerCase()))

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-[#E3E4E5]">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-pink-500 rounded flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h1 className="text-lg font-semibold">Criar novo simulado</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="default">
              Cancelar
            </Button>
            <Button size="default">Continuar</Button>
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto px-6 py-6">
        {/* Metadata Section */}
        <div className="mb-6">
          <SimulationMetadataComponent />
        </div>

        {/* Three Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] xl:grid-cols-[1fr_auto] gap-6">
          {/* Left side: Question Bank + Selected Questions */}
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-6">
            {/* Column 1: Question Bank */}
            <QuestionBankComponent
              banks={filteredBanks}
              selectedQuestions={selectedQuestions}
              onToggleBank={toggleBank}
              onAddQuestion={addQuestion}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />

            {/* Column 2: Selected Questions */}
            <SelectedQuestionsComponent questions={selectedQuestions} onRemoveQuestion={removeQuestion} />
          </div>

          {/* Column 3: Configurations Sidebar */}
          <ConfigurationsSidebarComponent />
        </div>

        {/* Footer */}
        <footer className="mt-6 flex items-center justify-between py-4 border-t border-[#E3E4E5]">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Info className="w-4 h-4" />
            <span>Selecione pelo menos uma questão para conseguir criar o seu simulado</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="default">
              Cancelar
            </Button>
            <Button size="default" disabled={selectedQuestions.length === 0}>
              Adicionar questões
            </Button>
          </div>
        </footer>
      </div>
    </div>
  )
}