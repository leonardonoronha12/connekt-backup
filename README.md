# AppCódigo - Plataforma Educacional

Uma aplicação web moderna para gestão de conversas educacionais, banco de questões e administração de cursos, desenvolvida com React e Supabase.

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Funcionalidades](#funcionalidades)
- [Tecnologias Utilizadas](#tecnologias-utilizadas)
- [Pré-requisitos](#pré-requisitos)
- [Instalação](#instalação)
- [Configuração](#configuração)
- [Uso](#uso)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Arquitetura](#arquitetura)
- [Scripts Disponíveis](#scripts-disponíveis)
- [Contribuição](#contribuição)

## 🎯 Visão Geral

O AppCódigo é uma plataforma educacional que oferece:

- **Sistema de Inbox**: Gerenciamento de conversas entre estudantes e professores
- **Banco de Questões**: Criação e organização de questões por categorias
- **Painel Administrativo**: Configurações e monitoramento da plataforma
- **Autenticação**: Sistema completo de login e registro via Supabase

## ✨ Funcionalidades

### 📬 Sistema de Inbox
- Visualização de conversas em tempo real
- Chat interativo com estudantes
- Filtros por curso, caderno e comunidade
- Sidebar com informações do estudante
- Avatares de conversas não lidas

### 📚 Banco de Questões
- Criação e edição de bancos de questões
- Categorização por tags
- Busca e filtros avançados
- Contagem automática de questões
- Interface intuitiva para gestão

### ⚙️ Painel Administrativo
- Configurações do sistema
- Monitoramento de páginas
- Logs de atividades
- Controles de funcionalidades

### 🔐 Autenticação
- Login e registro de usuários
- Sessões persistentes
- Integração com Supabase Auth
- Contexto global de autenticação

## 🛠 Tecnologias Utilizadas

### Frontend
- **React 18.2.0** - Biblioteca principal
- **Vite 4.4.5** - Build tool e dev server
- **React Router DOM 7.1.1** - Roteamento
- **Tailwind CSS 3.3.3** - Estilização
- **Framer Motion 10.16.4** - Animações

### UI Components
- **Radix UI** - Componentes acessíveis
- **Lucide React** - Ícones
- **Class Variance Authority** - Variantes de componentes

### Backend/Database
- **Supabase 2.30.0** - Backend as a Service
- **PostgreSQL** - Banco de dados (via Supabase)

### Desenvolvimento
- **ESLint** - Linting
- **PostCSS** - Processamento CSS
- **Autoprefixer** - Prefixos CSS automáticos

## 📋 Pré-requisitos

- Node.js (versão especificada em `.nvmrc`)
- npm ou yarn
- Conta no Supabase

## 🚀 Instalação

1. **Clone o repositório**
```bash
git clone <url-do-repositorio>
cd appcodigo
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure as variáveis de ambiente**
```bash
# Crie um arquivo .env.local com as configurações do Supabase
VITE_SUPABASE_URL=sua_url_do_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anonima
VITE_SUPABASE_QUESTION_IMAGES_BUCKET=question-images # nome do bucket de imagens das questões
```

## ⚙️ Configuração

### Supabase Setup

1. Crie um projeto no [Supabase](https://supabase.com)
2. Configure as tabelas necessárias:
   - `v_posts_with_replies` (view para posts com respostas)
   - Tabelas de usuários e autenticação
3. Atualize as credenciais em `src/lib/supabaseClient.js`
4. Crie um bucket de Storage para imagens das questões (padrão: `question-images`)
   - Permissions: público para leitura (URLs públicas)
   - Configure o nome via `VITE_SUPABASE_QUESTION_IMAGES_BUCKET`

### Configuração do Vite

O projeto inclui plugins customizados para:
- Editor visual inline
- Modo de edição
- Restauração de rotas em iframe
- Tratamento de erros personalizado

## 🎮 Uso

### Desenvolvimento
```bash
npm run dev
```
Inicia o servidor de desenvolvimento na porta 3000

### Build
```bash
npm run build
```
Gera a build de produção

### Preview
```bash
npm run preview
```
Visualiza a build de produção

## 📁 Estrutura do Projeto

```
appcodigo/
├── public/
│   └── .htaccess              # Configurações Apache
├── src/
│   ├── components/            # Componentes React
│   │   ├── ui/               # Componentes de UI base
│   │   ├── CallToAction.jsx
│   │   ├── ChatArea.jsx
│   │   ├── EmptyInbox.jsx
│   │   ├── HeroImage.jsx
│   │   ├── MainLayout.jsx
│   │   ├── MainSidebar.jsx
│   │   ├── Sidebar.jsx
│   │   ├── StudentInfoSidebar.jsx
│   │   ├── UnreadAvatarsBar.jsx
│   │   └── WelcomeMessage.jsx
│   ├── contexts/             # Contextos React
│   │   └── SupabaseAuthContext.jsx
│   ├── lib/                  # Utilitários e configurações
│   │   ├── customSupabaseClient.js
│   │   ├── supabaseClient.js
│   │   └── utils.js
│   ├── pages/                # Páginas principais
│   │   ├── AdminPage.jsx
│   │   ├── InboxPage.jsx
│   │   └── QuestionBankPage.jsx
│   ├── services/             # Serviços de API
│   │   └── conversationService.js
│   ├── App.jsx               # Componente principal
│   ├── main.jsx              # Ponto de entrada
│   └── index.css             # Estilos globais
├── plugins/                  # Plugins Vite customizados
│   ├── visual-editor/
│   └── vite-plugin-iframe-route-restoration.js
├── tools/                    # Ferramentas de build
│   └── generate-llms.js
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

## 🏗 Arquitetura

### Roteamento
- **Inbox** (`/`) - Página principal com conversas
- **Banco de Questões** (`/banco-de-questoes`) - Gestão de questões
- **Admin** (`/?view=dev-admin`) - Painel administrativo

### Estado Global
- **AuthContext** - Gerenciamento de autenticação
- **Supabase Client** - Conexão com backend

### Componentes Principais
- **InboxPage** - Interface principal de conversas
- **QuestionBankPage** - Gestão de bancos de questões  
- **AdminPage** - Painel de administração
- **ChatArea** - Área de chat interativo
- **Sidebar** - Navegação lateral

### Serviços
- **conversationService** - Operações de conversas
- **supabaseClient** - Cliente configurado do Supabase

## 📜 Scripts Disponíveis

- `npm run dev` - Inicia servidor de desenvolvimento
- `npm run build` - Gera build de produção
- `npm run preview` - Visualiza build de produção

## 🚢 Publicação desta versão

### Build e Preview
- Execute `npm run build` e depois `npm run preview`.
- Acesse `http://localhost:3000/`. Para validar esta versão, use a rota `http://localhost:3000/reposta-correta-simulado`.
- Observação: o `SpeedInsights` está desativado em `localhost` para evitar erros de script no ambiente local.

### Push para `main`
Em ambientes Windows/PowerShell, rode os comandos separadamente:

```
git checkout main
git pull origin main
git add -A
git commit -m "chore: desabilitar SpeedInsights em localhost; botão F9FAFB; tipografia 'Questão N'; span=img nas bolinhas"
git push origin main
```

Se não houver remoto configurado:

```
git remote add origin <URL-do-repositorio.git>
git push -u origin main
```

### O que mudou nesta versão
- Botão selecionado com largura 220px, altura 36px, raio 4px, gap 12, paddings 8/16 e cor `#F9FAFB`.
- `span` das bolinhas de status igual ao tamanho das imagens (16.25px), imagens ocupam todo o `span`.
- Tipografia do texto "Questão N": Inter 500, 14px, line-height 16px, tracking 0, cor `#22252B`.
- Desativação do `SpeedInsights` em localhost.

Para detalhes, consulte `CHANGELOG.md`.

## 🤝 Contribuição

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto é privado e proprietário.

## 🆘 Suporte

Para suporte, entre em contato com a equipe de desenvolvimento.

---

**Desenvolvido com ❤️ pela equipe AppCódigo**