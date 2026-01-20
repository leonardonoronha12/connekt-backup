# Deploy produção (cPanel) + Google OAuth (Supabase)

## 1) Build de produção
- Garanta que existe `VITE_SITE_URL=https://app.connektco.com` em `.env.production`.
- Rode:
  - `npm run build`
- O resultado fica em `dist/`.

## 2) Publicar no cPanel
- cPanel → File Manager
- Vá em `public_html/` (ou a pasta do subdomínio `app`).
- Apague/renomeie os arquivos antigos do site.
- Faça upload do conteúdo de `dist/` (não a pasta inteira, e sim os arquivos dentro dela).
- Confirme que `public_html/index.html` (ou equivalente) existe após o upload.

## 3) SPA fallback
- Se o site usa rotas do React Router, mantenha o `.htaccess` que está dentro de `dist/` no servidor.

## 4) Supabase (produção)
- Supabase Dashboard → Authentication → URL Configuration
  - Site URL: `https://app.connektco.com`
  - Additional Redirect URLs:
    - `https://app.connektco.com`
    - `https://app.connektco.com/login`
    - `https://app.connektco.com/login-aluno`
    - `https://app.connektco.com/aluno/login`

## 5) Google OAuth (produção)
- Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client (Web)
  - Authorized JavaScript origins:
    - `https://app.connektco.com`
  - Authorized redirect URIs:
    - `https://<PROJECT_REF>.supabase.co/auth/v1/callback`
- Supabase Dashboard → Authentication → Providers → Google
  - Enable
  - Preencha Client ID e Client Secret do Google

## 6) Teste
- Acesse `https://app.connektco.com/login`
- Clique em “Entrar com Google”
- Após autenticar, você deve voltar para `https://app.connektco.com/...` (não `localhost`).

