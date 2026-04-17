# Connekt — Product Specification (PRD)

## 1. Visão Geral
Connekt é uma plataforma web para venda e consumo de cursos (foco em Medicina), com dois fluxos principais:
- **Produtor**: cria e gerencia cursos, aulas, materiais, banco de questões e simulados; acompanha vendas e alunos; configura integrações (Vimeo/VdoCipher) e white label.
- **Aluno**: acessa cursos e aulas, consome materiais, realiza simulados e acompanha desempenho.

O sistema usa **Supabase** como backend (Auth, Postgres, Storage) e executa como aplicação web (SPA) com rotas dedicadas para produtor e aluno, incluindo suporte a white label.

## 2. Objetivos
- Permitir que produtores publiquem cursos e conteúdos com diferentes formatos (vídeo e materiais).
- Permitir que alunos acessem conteúdos conforme regras de acesso (plano/pagamento/entitlement).
- Suportar simulados e banco de questões, incluindo upload de mídia (imagem/vídeo) associada a questões.
- Integrar com gateways e webhooks para atualização de pagamentos/planos.
- Suportar operação com múltiplos tenants via white label (domínios/hosts dedicados).

## 3. Públicos e Papéis
### 3.1 Papéis
- **Aluno**: consome cursos, aulas, materiais e simulados.
- **Produtor**: gerencia cursos/conteúdo, alunos, vendas e configurações.
- **Admin da plataforma**: operações internas (painel admin, criação/gestão de usuários, deploy).

### 3.2 Identidade e autenticação
- Autenticação via **Supabase Auth**.
- Suporte a login por email/senha e login social (Google).
- Persistência e recuperação de sessão no frontend.

## 4. Escopo Funcional
### 4.1 Onboarding e Login
- Rotas públicas:
  - **Produtor**: `/login` (e variações internas)
  - **Aluno**: `/login-aluno` (com suporte a `producer_uid` e variações)
- Redirecionamento pós-login de acordo com o fluxo (aluno vs produtor) e host (white label).

### 4.2 Dashboard do Produtor
- Visão consolidada do produtor:
  - Indicadores (vendas, alunos, etc.)
  - Lista de cursos e ações rápidas

### 4.3 Gestão de Cursos (Produtor)
- Criar/editar curso com:
  - Dados básicos (nome, descrição, categoria/subcategoria/tags)
  - Estrutura em módulos e aulas
  - Upload de vídeo (provider: Vimeo/VdoCipher/Upload)
  - Upload de materiais (PDF/DOC/PPT/XLS/links)
  - Imagens de capa e assets do curso
- Publicação e disponibilidade para aluno.

### 4.4 Área do Aluno
- Dashboard do aluno:
  - Cursos disponíveis
  - Progresso e navegação
- Página de curso:
  - Lista de módulos/aulas
  - Acesso ao player do vídeo
  - Download/abertura de materiais

### 4.5 Banco de Questões e Simulados
- Produtor:
  - Criar banco de questões com metadados (categoria/subcategoria/tags)
  - Criar/editar questões (incluindo alternativas, resposta correta, pontuação)
  - Upload de **imagem/vídeo** associado à questão
  - Criar simulados (seleção de questões, regras, duração, nota)
- Aluno:
  - Realizar simulado
  - Visualizar resultado, desempenho e correções

### 4.6 Upload e Storage de Arquivos
- Uso do Supabase Storage para:
  - `courses-media` (materiais e mídias do curso, avatar e afins)
  - `question-images` (mídia de questões)
  - `images` (imagens gerais)
  - `imagens-logs` (logs e auditoria de uploads)
- Upload pode ocorrer:
  - Diretamente do cliente (com RLS e limites)
  - Via proxy/endpoint server-side quando necessário (ex.: dev ou casos específicos)

Requisitos de segurança:
- Sanitização de paths do Storage (prevenir path traversal).
- Permissões por usuário/tenant e logs de upload.

### 4.7 Planos, Entitlements e Pagamentos
- Planos e regras de acesso:
  - Limites de upload (bytes)
  - Regras de criação/uso por plano
- Integração com gateway de pagamentos e webhooks:
  - Atualização de status de pagamento
  - Ativação de plano/entitlement

### 4.8 Inbox / Mensagens
- Interface de inbox (threads) para comunicação e acompanhamento.

### 4.9 Notificações
- Registro e exibição de notificações no sistema.

### 4.10 White Label
- Configuração por produtor (metadados/branding):
  - Nome, cores, logo, mensagem/email de boas-vindas
- Hosts:
  - `app.connektco.com` (principal)
  - Subdomínios para white label (ex.: `*.app.connektco.com`)

### 4.11 Admin da Plataforma
- Login e painel admin:
  - Gestão de usuários (criar, listar, habilitar/desabilitar, bulk)
  - Geração de link de primeiro acesso
  - Operações de deploy/status
  - Gestão de solicitações de saque (withdraw requests)

## 5. Requisitos Não-Funcionais
### 5.1 Segurança
- Não versionar segredos no repositório.
- Segredos apenas via variáveis de ambiente (Supabase/Vercel/Edge Functions secrets).
- Sanitização de paths de Storage e validação de inputs.
- Tokens sensíveis nunca devem ser logados.

### 5.2 Performance e Confiabilidade
- Upload de arquivos grandes deve preferir método resumable quando aplicável.
- Retry/backoff em chamadas críticas onde faça sentido.
- Build e deploy automatizados com pipeline.

### 5.3 Observabilidade
- Logs de upload em bucket dedicado (imagens-logs) e/ou tabela.
- Endpoint de versão para diagnóstico.

## 6. Fluxos Principais
### 6.1 Login do Aluno
1. Usuário acessa `/login-aluno?producer_uid=...`
2. Autentica via email/senha ou Google
3. Sistema estabelece sessão e redireciona para área do aluno
4. Sistema aplica branding (se white label) e carrega cursos disponíveis

### 6.2 Upload de Mídia de Questão (Produtor)
1. Produtor cria/edita questão
2. Seleciona arquivo (imagem/vídeo)
3. Upload (direto ou via proxy)
4. Sistema registra URL/path em metadata da questão + log de auditoria

### 6.3 Webhook de Pagamento
1. Gateway chama endpoint webhook (Edge Function) com Authorization
2. Sistema valida segredo (env)
3. Atualiza pagamentos/entitlements conforme status
4. Libera acesso do aluno

## 7. Critérios de Aceite (exemplos)
- Um aluno que loga via `/login-aluno?producer_uid=...` entra na área do aluno e não é redirecionado para dashboard do produtor.
- Upload de mídia não permite `..`, `%2f`, `\` ou qualquer escape para fora do prefixo permitido.
- Webhooks rejeitam chamadas sem Authorization válido.
- Nenhum segredo (tokens, API keys, service role) está presente no git history.

## 8. Fora de Escopo (por agora)
- App mobile nativo.
- Marketplace público de cursos.
- Recursos avançados de autoria (certificados, DRM avançado além do provider).

## 9. Ambientes e Configuração (alto nível)
- Frontend: Vite/React (SPA)
- Backend: Supabase (Auth + DB + Storage) + Edge Functions
- Deploy: Vercel (produção)
- Variáveis de ambiente:
  - Supabase URL/Anon Key (cliente)
  - Supabase Service Role (server/edge)
  - Tokens de gateway/webhook (edge)

