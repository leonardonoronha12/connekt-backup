# PRD — Connekt (Plataforma de Cursos e Simulados)

## 1. Resumo
Connekt é uma plataforma web para **produtores** criarem e venderem cursos (foco em Medicina) e para **alunos** consumirem aulas, materiais e simulados. A solução usa **Supabase** (Auth + Postgres + Storage) como back-end e executa como aplicação web (SPA) com implantação em produção (Vercel).

Este PRD descreve o produto “como um todo”: objetivos, escopo, requisitos funcionais, integrações, regras, segurança, métricas e critérios de aceite.

## 2. Contexto e Problema
Produtores precisam de um sistema completo para:
- Estruturar cursos em módulos/aulas, adicionar vídeos e materiais.
- Vender acesso e liberar o conteúdo automaticamente após pagamento.
- Organizar banco de questões e simulados, com mídia associada às questões.
- Operar em formato white label, com identidade visual por produtor.

Alunos precisam de um sistema para:
- Entrar de forma simples (email/senha e login social).
- Acessar cursos/aulas conforme plano e pagamento.
- Realizar simulados e acompanhar desempenho.

## 3. Objetivos
### 3.1 Objetivos de Negócio
- Aumentar conversão de vendas e retenção de alunos por melhor experiência de consumo.
- Reduzir suporte operacional automatizando liberação de acesso via webhooks.
- Permitir expansão via white label.

### 3.2 Objetivos de Produto
- Separar claramente fluxos de **produtor** e **aluno**, incluindo login e rotas.
- Garantir upload seguro e rastreável de mídias e materiais.
- Suportar simulados completos (execução, resultado, correção).
- Fornecer painel admin para operações internas e implantação.

### 3.3 Não-Objetivos (fora de escopo imediato)
- App mobile nativo.
- Marketplace público de cursos.
- Ferramentas avançadas de autoria (certificados, editor de templates sofisticado, DRM além do provider).

## 4. Personas e Permissões
### 4.1 Personas
- **Aluno**: consome conteúdo, realiza simulados, consulta progresso.
- **Produtor**: cria/edita cursos, aulas, materiais, questões, simulados; acompanha alunos e vendas; configura integrações e branding.
- **Admin da Plataforma**: gerenciamento interno de usuários, implantação/status, solicitações e manutenção operacional.

### 4.2 Permissões (alto nível)
- Aluno: leitura do conteúdo liberado para seu usuário.
- Produtor: CRUD em seus recursos e leitura de dados relacionados ao seu negócio.
- Admin: ações administrativas e acesso a endpoints internos protegidos.

## 5. Jornada do Usuário (alto nível)
### 5.1 Login e Sessão
- Entrada por email/senha e login social (Google).
- Persistência de sessão no cliente.
- Roteamento pós-login baseado no fluxo:
  - **Aluno**: rotas de aluno (ex.: `/login-aluno`, `/aluno/...`).
  - **Produtor**: rotas de produtor (ex.: `/login`, `/dashboard`, `/cursos`, etc.).
- Suporte a hosts de white label (subdomínios).

### 5.2 Produtor: Criar e Publicar Curso
1. Produtor autentica e acessa área do produtor.
2. Cria curso com dados básicos e estrutura de módulos/aulas.
3. Faz upload de capa, vídeos e materiais.
4. Publica (ou torna disponível).

### 5.3 Aluno: Consumir Curso e Aulas
1. Aluno entra pelo link de aluno (com `producer_uid` quando aplicável).
2. Autentica e acessa área do aluno.
3. Visualiza cursos liberados.
4. Assiste aulas e acessa materiais.

### 5.4 Simulados e Banco de Questões
- Produtor cria banco, cadastra questões e associa mídia (imagem/vídeo).
- Produtor cria simulados com seleção de questões e regras.
- Aluno executa simulado e vê resultado/correção.

### 5.5 Pagamentos e Liberação de Acesso
- Gateway chama webhook(s) com Authorization.
- Back-end valida segredo e atualiza pagamentos/permissões (payments/entitlements).
- Aluno passa a ter acesso ao conteúdo/plano.

## 6. Escopo Funcional (Requisitos)
### 6.1 Autenticação e Autorização
**RF-001**: Login por email/senha (produtor e aluno).  
**RF-002**: Login social (Google) com retorno correto de sessão.  
**RF-003**: Persistência e recuperação de sessão no cliente.  
**RF-004**: Redirecionamento pós-login respeitando fluxo aluno/produtor e host white label.  
**RF-005**: Rotas públicas e privadas claramente separadas.

### 6.2 Área do Produtor
**RF-010**: Painel com navegação para principais módulos.  
**RF-011**: Gestão de cursos (CRUD).  
**RF-012**: Gestão de módulos e aulas.  
**RF-013**: Upload e associação de vídeos e materiais às aulas/curso.  
**RF-014**: Página/relatórios de vendas (visão de pagamentos e performance).  
**RF-015**: Gestão de alunos (listagem, pesquisa, exportação quando aplicável).  

### 6.3 Área do Aluno
**RF-020**: Dashboard com cursos disponíveis.  
**RF-021**: Página de curso com módulos e aulas.  
**RF-022**: Página de aula com player de vídeo (via provider configurado).  
**RF-023**: Acesso a materiais com URL pública ou signed URL (quando aplicável).  
**RF-024**: Visualização de progresso e estados de consumo (quando disponível).

### 6.4 Banco de Questões e Simulados
**RF-030**: CRUD de bancos de questões (produtor).  
**RF-031**: CRUD de questões e metadados (alternativas, correta, pontos).  
**RF-032**: Upload de imagem/vídeo por questão com persistência de path/url e log.  
**RF-033**: Criação de simulados com seleção de questões e regras (tempo, pontuação etc.).  
**RF-034**: Execução de simulado pelo aluno.  
**RF-035**: Resultado do simulado e visualização de desempenho/correção.  

### 6.5 Uploads e Storage
**RF-040**: Upload de arquivos para buckets do Supabase Storage conforme tipo:
- `courses-media`: materiais e mídias de curso (incluindo avatar e assets correlatos).
- `question-images`: mídia de questões.
- `images`: imagens gerais.
- `imagens-logs`: logs/auditoria (quando aplicável).

**RF-041**: Registrar log de upload (tabela e/ou bucket de logs), contendo: path, url, tipo, tamanho, usuário e timestamp.  
**RF-042**: Sanitização de paths de Storage para impedir path traversal e escapes.  
**RF-043**: Para links/URLs assinadas expiradas, permitir estratégia de refresh controlada (apenas bucket permitido).  

### 6.6 Planos, Entitlements e Limites
**RF-050**: Regras de acesso e limites por plano (ex.: limite de upload em bytes).  
**RF-051**: Bloquear ações (ex.: upload/criação de recurso) quando limites do plano forem atingidos.  
**RF-052**: Atualizar entitlements via webhooks de pagamento.  

### 6.7 Integrações
**RF-060**: Integração com provedores de vídeo (Vimeo, VdoCipher) por produtor.  
**RF-061**: Integração com gateway(s) de pagamento com webhooks:
- `payment-webhook` (segredo `WEBHOOK_SECRET`)
- `myg-payment-webhook` (segredo `MYG_WEBHOOK_TOKEN`)
**RF-062**: Email transacional (ex.: SendGrid) para fluxos relevantes (quando configurado).

### 6.8 Admin da Plataforma
**RF-070**: Login e painel admin.  
**RF-071**: Gestão de usuários (criar, atualizar, listar, habilitar/desabilitar, bulk).  
**RF-072**: Geração de link de primeiro acesso.  
**RF-073**: Gestão de implantação (acionar implantação, acompanhar status) e páginas de status.  
**RF-074**: Gestão de solicitações de saque (withdraw requests).  

### 6.9 White Label
**RF-080**: Configurar branding por produtor (nome, cores, logos, mensagem de boas-vindas).  
**RF-081**: Aplicar branding na área do aluno conforme host ou parâmetros do fluxo.  
**RF-082**: Rotas e experiência do aluno em host white label.

### 6.10 Inbox / Comunicação
**RF-090**: Tela de inbox com threads e visualização de conversas (quando habilitado).  

## 7. Requisitos Não-Funcionais
### 7.1 Segurança
- Segredos apenas via variáveis de ambiente / secrets (Supabase/Vercel).
- Nunca logar `Authorization` e tokens sensíveis.
- Sanitização e validação de entradas em rotas do lado do servidor, especialmente em operações de Storage.
- Webhooks devem exigir Authorization válido.
- Histórico do git não deve conter segredos (tokens, keys, JWTs).

### 7.2 Performance e Escalabilidade
- Upload de arquivos grandes deve suportar estratégia resumable quando aplicável.
- Listagens devem ser paginadas/limitadas.
- Cache em assets e URLs públicas onde possível.

### 7.3 Observabilidade
- Endpoint de versão para diagnóstico.
- Logs de upload e eventos importantes (sem segredos).

### 7.4 Confiabilidade
- Retry/backoff em chamadas críticas de rede quando fizer sentido.
- Fluxos de login devem tolerar condições de corrida e garantir sessão consistente.

## 8. Dados (Alto nível)
### 8.1 Entidades principais (conceitual)
- **users/profiles**: usuário e metadados (inclui whitelabel em metadata quando aplicável).
- **courses**: cursos.
- **lessons**: aulas e conteúdo associado.
- **question_banks**: bancos de questões.
- **questions**: questões (metadata com imageUrl/imagePath/videoUrl/videoPath).
- **simulados**: simulados e regras.
- **payments**: pagamentos e status.
- **entitlements/plans**: regras de acesso por plano e limites.
- **imagens_logs**: auditoria de uploads.
- **notifications**: notificações do sistema.
- **conversations/threads**: inbox e mensagens.

## 9. APIs e Endpoints (alto nível)
### 9.1 API (server)
- Endpoints de upload e resolução de mídia (curso/questão).
- Endpoints de admin (usuários, implantação, withdraw requests).

### 9.2 Edge Functions (Supabase)
- Webhooks de pagamento e sincronização (planos/pagamentos).
- Funções auxiliares (envio de email/verificação etc.).

## 10. Métricas e KPIs
### 10.1 Produto
- Taxa de login bem-sucedido (produtor/aluno).
- Taxa de conclusão de aula e consumo de curso.
- Taxa de execução de simulados e conclusão.

### 10.2 Operação
- Falhas de webhook (401/500) por gateway.
- Falhas de upload por tipo e tamanho.
- Incidentes de segurança (ex.: tentativas de path traversal bloqueadas).

## 11. Critérios de Aceite (exemplos)
- Aluno que acessa `/login-aluno?producer_uid=...` é direcionado para área do aluno, não para o painel do produtor.
- Uploads e Signed URL refresh não aceitam `..`, `%2f`, `\` e não escapam do prefixo/bucket permitido.
- Webhooks rejeitam chamadas sem Authorization válido (401) e não registram segredos em logs.
- Build em produção passa e `npm audit --omit=dev` não acusa vulnerabilidades em tempo de execução.

## 12. Riscos e Mitigações
- **Risco**: Segredos expostos em repositório/histórico.  
  **Mitigação**: secrets via ambiente, rewrite de histórico, rotação de chaves.
- **Risco**: Upload abusivo/DoS por arquivos grandes.  
  **Mitigação**: limites por plano, validação de tamanho, resumable.
- **Risco**: Confusão de fluxos aluno/produtor em rotas.  
  **Mitigação**: regras explícitas de roteamento por fluxo + testes E2E.

## 13. Plano de Entrega (alto nível)
- Manter integração contínua com build e auditoria.
- Automatizar testes E2E de login e fluxos críticos (aluno/produtor, upload, webhook).
- Rollout incremental em produção com monitoração de erros e métricas.
