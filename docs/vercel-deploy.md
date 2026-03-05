# Deploy na Vercel (modo Live)

Este projeto é um SPA React + Vite (build em `dist/`) e precisa de rewrite para `index.html` para rotas como `/login`, `/dashboard`, `/termos`, etc.

## 1) Configuração já incluída no repositório

O arquivo `vercel.json` já está configurado com:
- build: `npm run build`
- output: `dist`
- rewrite SPA: `/(.*)` → `/index.html`

## 2) Variáveis de ambiente na Vercel

No painel da Vercel (Project → Settings → Environment Variables), configure:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_QUESTION_IMAGES_BUCKET` (ex.: `question-images`)
- (opcional) `VITE_TESTER_EMAILS` (lista separada por vírgula para liberar plano QA)

Necessário para rotas `/api/*` que usam Supabase Admin:
- `SUPABASE_SERVICE_ROLE_KEY`

## 3) Ajustes no Supabase para produção

Supabase → Authentication → URL Configuration:
- **Site URL**: `https://SEU_DOMINIO_DA_VERCEL`
- **Additional Redirect URLs**:
  - `https://SEU_DOMINIO_DA_VERCEL/login`
  - `https://SEU_DOMINIO_DA_VERCEL/reset-password`
  - (opcional) `https://SEU_DOMINIO_DA_VERCEL/`

## 3.2) Policies do bucket question-images (upload de mídia nas questões)

Para permitir upload direto (sem proxy) no bucket `question-images`, aplique a migração:
- `supabase/migrations/20260102232000_question_images_storage_policies.sql`

Atalho:
```bash
npm run migrate:question-images
```

## 3.1) Google Login (OAuth)

Se você usar login com Google, habilite o provedor em:
- Supabase → Authentication → Providers → Google

E no Google Cloud Console configure o redirect:
- `https://SEU_PROJECT_REF.supabase.co/auth/v1/callback`

## 4) Ajustes no Facebook (Meta) para produção

No Facebook Developers (Meta):
- Facebook Login → Settings
- **Valid OAuth Redirect URIs**:
  - `https://SEU_PROJECT_REF.supabase.co/auth/v1/callback`

E garanta que o app esteja em **Live** ou que seu usuário esteja como Tester/Admin enquanto estiver em modo dev.

Para troubleshooting do erro “Aplicativo inativo”, veja:
- `docs/facebook-oauth-supabase.md`

## 5) Publicar (Vercel)

Opção A — via painel (recomendado):
1. Import Project (GitHub/GitLab/Bitbucket)
2. Framework preset: Vite
3. Build command: `npm run build`
4. Output directory: `dist`
5. Adicionar variáveis de ambiente
6. Deploy

Opção B — via CLI:
```bash
npx vercel
npx vercel --prod
```
