# Login com Facebook (Supabase)

Quando o Facebook mostra a tela:

> **Aplicativo inativo**  
> “Este aplicativo não está acessível no momento…”

isso não é erro do app front-end. É configuração/status do app no **Meta Developers**.

## 1) Ativar o app no Meta Developers

1. Abra **Meta for Developers** → **My Apps** → selecione seu app
2. Em **App Settings → Basic**:
   - Confirme **App ID** e **App Secret**
3. Em **Facebook Login → Settings**:
   - Ative **Client OAuth Login**
   - Ative **Web OAuth Login**
4. Coloque o app em **Live** (toggle no topo)  
   - Se estiver em modo Development, seu usuário precisa estar como **Tester/Admin/Developer** no app do Meta

## 2) Configurar Redirect URI (obrigatório)

No Meta Developers, em **Valid OAuth Redirect URIs**, adicione:

- `https://<SEU_PROJECT_REF>.supabase.co/auth/v1/callback`

Exemplo:
- `https://<PROJECT_REF>.supabase.co/auth/v1/callback`

## 3) Habilitar Facebook no Supabase

Supabase Dashboard → **Authentication → Providers → Facebook**
- Ative o provedor
- Configure:
  - **Facebook App ID**
  - **Facebook App Secret**

## 4) URLs de produção no Supabase

Supabase → Authentication → URL Configuration:
- Site URL: `https://app.connektco.com` (ou seu domínio)
- Additional Redirect URLs:
  - `https://app.connektco.com/login`
  - `https://app.connektco.com/`

