import { Database, GraduationCap, Monitor, Settings } from 'lucide-react'

export const ALUNO_NAV_SECTIONS = [
  {
    title: 'MENU',
    items: [
      { label: 'Painel', Icon: GraduationCap, path: '/aluno' },
      { label: 'Simulados', Icon: Monitor, path: '/aluno/simulados' },
      { label: 'Banco de Questões', Icon: Database, path: '/aluno/banco-de-questoes' },
    ],
  },
  {
    title: 'GERAL',
    items: [{ label: 'Configurações', Icon: Settings, path: '/aluno/configuracoes' }],
  },
]

