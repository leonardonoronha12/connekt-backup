# Connekt

Plataforma web para criação, gestão e venda de cursos (foco em Medicina), com área do produtor e área do aluno, incluindo simulados e banco de questões.

## Visão do sistema

O sistema é dividido em três camadas principais:

- **Web (SPA)**: interface do produtor, aluno e administrador da plataforma.
- **API**: endpoints serverless (Vercel) que encapsulam integrações, lógica administrativa e operações que exigem credenciais do lado do servidor.
- **Supabase**: autenticação, Postgres, Storage e Edge Functions (webhooks, jobs e rotinas de sincronização).

### Fluxo de requisição (alto nível)

1) Navegador → SPA (`src/`)  
2) SPA → `/api/*` quando precisa de operação do lado do servidor (ex.: admin, proxy de upload, integrações)  
3) API → Supabase (Auth/Admin, Postgres, Storage) e/ou provedores externos (gateway, vídeo, e-mail)

- **Front-end (SPA)**: Vite + React em `src/`.
- **API (Serverless na Vercel)**: roteamento em `api/index.js` com handlers em `api_handlers/`.
- **Banco e Auth**: Supabase (Postgres + Auth + Storage + Edge Functions) em `supabase/`.

## Pré-requisitos

- Node.js 20 (ver `package.json` → `engines`)
- npm (recomendado: `npm ci` para instalar)

## Estrutura do repositório

Principais diretórios:

- `src/`: SPA (produtor/aluno/admin), roteamento e UI.
- `api/` e `api_handlers/`: API serverless; `api/index.js` faz o roteamento por caminho.
- `supabase/`: migrações SQL, templates de e-mail e Edge Functions.
- `scripts/`: scripts operacionais (migrações, configuração de storage, testes de fumaça).
- `docs/`: documentação técnica e guias operacionais.

## Configuração local (front-end)

1) Instalar dependências:

```bash
npm ci
```

2) Criar `.env.local`:

```bash
copy .env.production.example .env.local
```

3) Preencher no `.env.local` (mínimo para subir a SPA):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_APP_BASE_URL` (ex.: `http://localhost:3000`)

4) Subir o app:

```bash
npm run dev
```

## Configuração local (API)

Para rodar a API localmente (útil para teste de fumaça e debug de handlers do lado do servidor):

```bash
npm run dev:api
```

A API local sobe em `http://127.0.0.1:3001` por padrão. A SPA em desenvolvimento usa Vite.

## Variáveis de ambiente (política)

- **Front-end (`VITE_*`)**: qualquer `VITE_*` é embutido no bundle e fica visível no navegador. Nunca colocar segredos.
- **Lado do servidor (Vercel)**: segredos e credenciais devem existir apenas como variáveis do projeto na Vercel (ex.: `SUPABASE_SERVICE_ROLE_KEY`, chaves de gateway, tokens de provedores).

Variáveis mínimas em produção:

- `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (SPA)
- `SUPABASE_SERVICE_ROLE_KEY` (API / endpoints admin / rotinas do lado do servidor)

Para lista e detalhes, consulte `docs/ambiente.md`.

## Documentação

- Índice: `docs/README.md`
- Produto: `docs/PRD.md`
- Arquitetura técnica: `docs/arquitetura.md`
- Ambiente e variáveis: `docs/ambiente.md`
- Implantação (Vercel): `docs/implantacao-vercel.md`
- Testes: `docs/testes.md`
- OAuth (Supabase): `docs/google-oauth-supabase.md` e `docs/facebook-oauth-supabase.md`
- Integrações: `docs/integracoes/`

## Scripts

- `npm run dev`: front-end (Vite)
- `npm run dev:api`: API local (porta 3001 por padrão)
- `npm run build`: build de produção
- `npm run test:backend`: teste de fumaça da API local

## Implantação

- Implantação padrão via Vercel conectado ao GitHub (produção acompanha `main`).
- O projeto possui `vercel.json` com SPA rewrite, headers e roteamento `/api/*`.
- Detalhes e checklist: `docs/implantacao-vercel.md`.

## Licença

Código proprietário. Veja `LICENSE.md`.

## Suporte

Para contribuir: `CONTRIBUTING.md`. Para reporte de vulnerabilidades: `SECURITY.md`.
