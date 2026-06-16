# Connekt

Plataforma web para criação, gestão e venda de cursos (foco em Medicina), com área do produtor e área do aluno, incluindo simulados e banco de questões.

## Arquitetura

- **Frontend (SPA)**: Vite + React em `src/`.
- **API (Serverless na Vercel)**: roteamento em `api/index.js` com handlers em `api_handlers/`.
- **Banco e Auth**: Supabase (Postgres + Auth + Storage + Edge Functions) em `supabase/`.

## Pré-requisitos

- Node.js 20 (ver `package.json` → `engines`)
- npm (recomendado: `npm ci` para instalar)

## Setup local

1) Instalar dependências:

```bash
npm ci
```

2) Criar `.env.local`:

```bash
copy .env.production.example .env.local
```

3) Preencher no `.env.local`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_APP_BASE_URL` (ex.: `http://localhost:3000`)

4) Subir o app:

```bash
npm run dev
```

## Variáveis de ambiente

- `VITE_*` é exposto no navegador (não colocar segredos).
- Segredos (ex.: `SUPABASE_SERVICE_ROLE_KEY`, tokens, chaves de gateway) devem existir somente no server-side (Vercel).

## Documentação

- Produto: `docs/PRD.md`
- Deploy Vercel: `docs/vercel-deploy.md`
- OAuth (Supabase): `docs/google-oauth-supabase.md` e `docs/facebook-oauth-supabase.md`
- Integrações: `docs/integrations/`

## Scripts

- `npm run dev`: frontend (Vite)
- `npm run dev:api`: API local (porta 3001 por padrão)
- `npm run build`: build de produção
- `npm run test:backend`: smoke test da API local

## Deploy

- O projeto possui `vercel.json` com SPA rewrite, headers e rota `/api/*`.
- Em produção, configure as variáveis de ambiente no projeto da Vercel.
- Detalhes e checklist: `docs/vercel-deploy.md`.

## Licença

Código proprietário. Veja `LICENSE.md`.

## Suporte

Para contribuir: `CONTRIBUTING.md`. Para reporte de vulnerabilidades: `SECURITY.md`.
