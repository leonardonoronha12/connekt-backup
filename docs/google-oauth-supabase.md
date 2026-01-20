# Login com Google (Supabase)

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

