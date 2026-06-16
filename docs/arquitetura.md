# Arquitetura técnica

## Visão geral

O Connekt é um SPA (React) com back-end orientado a:

- API serverless na Vercel (Node) para integrações e rotinas que exigem credenciais do lado do servidor.
- Supabase para autenticação, Postgres, Storage e Edge Functions.

## Componentes e responsabilidades

### SPA (Vite + React)

- Rotas e telas em `src/pages/`.
- Componentes compartilhados em `src/components/`.
- Integrações com Supabase no client em `src/lib/` e `src/contexts/`.

### API (Vercel)

- Ponto de entrada: `api/index.js`
- Handlers: `api_handlers/**`

Padrão:

- `/api/<rota>` é encaminhado para um handler em `api_handlers/`.
- Endpoints administrativos em `/api/admin/*` exigem autenticação e verificação de permissão (admin).

### Supabase

- Migrações SQL em `supabase/migrations/`.
- Edge Functions em `supabase/functions/` (webhooks, sincronizações e utilitários).
- Templates de e-mail em `supabase/templates/`.

## Segurança e isolamento

- `VITE_*` é público (bundle). Apenas `anon key` e URLs públicas ficam no front-end.
- Operações que exigem `service_role` (admin) são executadas na API serverless.
- Regras de acesso no banco devem ser aplicadas via RLS e policies (ver migrações).

## Multi-tenant / White label

- Fluxo de aluno e produtor é separado por rotas e por contexto (host / parâmetros).
- Subdomínios do tipo `*.app.connektco.com` podem carregar branding e contexto de produtor.

## Pagamentos (alto nível)

- Autenticação e criação de link de pagamento via gateway (MyGateway/whitelabel).
- Validação e liberação de acesso via webhooks/Edge Functions.
- Diagnóstico via endpoint admin de healthcheck do gateway (lado do servidor).
