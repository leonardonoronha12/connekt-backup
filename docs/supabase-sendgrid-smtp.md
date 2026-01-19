# Configurar SMTP (SendGrid) no Supabase

Este projeto usa Supabase Auth para login e recuperação de senha. Para o e-mail de “Esqueci minha senha” chegar, é necessário configurar um provedor SMTP no Supabase.

## 1) Preparar o SendGrid

1. Acesse o painel do SendGrid.
2. Configure um remetente válido:
   - **Single Sender Verification** (mais rápido) ou
   - **Domain Authentication** (recomendado para produção).
3. Crie uma API Key:
   - Menu: **Settings → API Keys**
   - Permissão: **Full Access** ou pelo menos **Mail Send**
   - Copie a chave e guarde em local seguro.

## 2) Preencher SMTP no Supabase

No Supabase:
- Menu: **Authentication → Settings → SMTP** (ou “Email / SMTP”, dependendo do layout do painel)

Preencha com os valores do SendGrid:
- **Host**: `smtp.sendgrid.net`
- **Porta**: `587`
- **Usuário**: `apikey`
- **Senha**: `SUA_SENDGRID_API_KEY`
- **Secure / Encryption**: `STARTTLS` (TLS)
- **From email**: um e-mail verificado no SendGrid (ex.: `no-reply@seudominio.com`)
- **From name**: `Connekt` (ou o nome que você quiser)

Alternativas:
- Porta `465` com SSL/TLS (se o painel permitir escolher “SSL” em vez de STARTTLS).

## 3) DNS (recomendado)

Se estiver usando domínio próprio, configure “Domain Authentication” no SendGrid e aplique os registros DNS:
- SPF / DKIM (CNAMEs e/ou TXT conforme o SendGrid gerar)

Sem isso, é comum cair no spam ou falhar por reputação.

## 4) URLs de redirect no Supabase (reset de senha)

No Supabase:
- Menu: **Authentication → URL Configuration**

Configure:
- **Site URL**: `https://app.connektco.com`
- **Additional Redirect URLs**:
  - `https://app.connektco.com/reset-password`
  - (dev) `http://localhost:3000/reset-password`

O app já tem a rota `/reset-password` para o usuário definir a nova senha.

## 5) Teste ponta a ponta

1. Rode o app e vá em `/login`.
2. Clique em **Esqueci minha senha**.
3. Informe um e-mail que exista no Supabase Auth.
4. Verifique:
   - Caixa de entrada
   - Spam / Promoções
5. Abra o link do e-mail e finalize em `/reset-password`.

Se não chegar:
- Confira se o e-mail está realmente cadastrado no Supabase Auth.
- Verifique os logs do Supabase (Auth / Logs) para tentativas de envio SMTP.
- Confirme se o “From email” está verificado no SendGrid.

