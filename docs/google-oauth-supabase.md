# Login com Google (Supabase)

## 0) Trocar o “Prosseguir para <...>” do Google para seu domínio (ex: app.connekt)

Na tela do Google, o texto “Prosseguir para …” usa o **domínio do Redirect URI do OAuth**.

Se você está vendo algo como:

- `Prosseguir para <SEU_PROJECT_REF>.supabase.co`

isso acontece porque o redirect do Google está apontando para:

- `https://<SEU_PROJECT_REF>.supabase.co/auth/v1/callback`

Para o Google mostrar seu domínio (ex.: `app.connekt`, `app.connektco.com`), você precisa que o callback do Supabase rode em um **domínio seu**. Isso exige **Custom Domain** no Supabase (ou um proxy equivalente).

Passos (com Supabase Custom Domain):

1. No Supabase, configure um domínio customizado para o projeto (ex.: `auth.app.connektco.com`).
2. Atualize o Google Cloud → OAuth client → **Authorized redirect URIs** para:
   - `https://auth.app.connektco.com/auth/v1/callback`
3. Atualize as variáveis de ambiente do app para usar o domínio customizado do Supabase:
   - `VITE_SUPABASE_URL=https://auth.app.connektco.com`
4. No Supabase → Authentication → URL Configuration:
   - **Site URL**: `https://app.connektco.com`
   - **Additional Redirect URLs**: inclua `https://app.connektco.com/*` (ou as rotas necessárias)

Sem Custom Domain (ou proxy), **não dá** para trocar esse texto só com código no front-end.

Este erro:

```json
{
  "code": 400,
  "error_code": "validation_failed",
  "msg": "Unsupported provider: provider is not enabled"
}
```

significa que o provedor Google não está habilitado no Supabase.

## 1) Habilitar Google no Supabase

1. Abra **Supabase Dashboard** → **Authentication** → **Providers**
2. Encontre **Google**
3. Ative o provedor e preencha:
   - **Client ID**
   - **Client Secret**
4. Salve

## 2) Criar credenciais no Google Cloud

1. Google Cloud Console → APIs & Services → Credentials
2. Create Credentials → OAuth client ID → Web application
3. Configure **Authorized redirect URIs**:
   - `https://<SEU_PROJECT_REF>.supabase.co/auth/v1/callback`

## 3) Configurar URLs no Supabase (produção)

Supabase → Authentication → URL Configuration:
- Site URL: `https://app.connektco.com` (ou seu domínio)
- Additional Redirect URLs:
  - `https://app.connektco.com/login`
  - `https://app.connektco.com/`

## 4) Código do app

O app usa `supabase.auth.signInWithOAuth({ provider: 'google' })` com `redirectTo` apontando para `/login`.
Depois de habilitar o provedor, o login com Google passa a funcionar sem alterações adicionais.

