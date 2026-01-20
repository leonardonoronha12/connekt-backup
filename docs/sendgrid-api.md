# Envio de email via Vercel API (SendGrid)

Este projeto expõe um endpoint em `POST /api/send-email` para envio de emails transacionais via SendGrid.

Também existe `POST /api/auth/password-recovery` para envio do email de recuperação de senha do Supabase Auth via SendGrid (não depende do SMTP do Supabase).

## Variáveis de ambiente (Vercel)
- `SENDGRID_API_KEY` (obrigatório)
- `SENDGRID_FROM_EMAIL` (obrigatório, precisa ser verificado no SendGrid)
- `SENDGRID_FROM_NAME` (opcional, default: `Connekt`)
- `SENDGRID_REPLY_TO` (opcional)
- `SENDGRID_ALLOW_ANY_TO` (opcional, default `false`)
- `SUPABASE_SERVICE_ROLE_KEY` (obrigatório para `/api/auth/password-recovery`)
- `SUPABASE_URL` (ou `VITE_SUPABASE_URL`) (obrigatório para `/api/auth/password-recovery`)
- `SITE_URL` (ou `VITE_SITE_URL`) (opcional, para fallback do redirect)

## Autenticação
O endpoint exige `Authorization: Bearer <access_token>` do Supabase (o token da sessão do usuário).

Por padrão, ele só permite enviar para o próprio email do usuário (`to === user.email`).
Para liberar envio para qualquer destinatário, setar `SENDGRID_ALLOW_ANY_TO=true`.

## Exemplo de request

```bash
curl -X POST "https://app.connektco.com/api/send-email" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SUPABASE_ACCESS_TOKEN" \
  -d "{\"to\":\"seu-email@exemplo.com\",\"subject\":\"Teste\",\"text\":\"Olá!\"}"
```

## Exemplo: recuperação de senha (email via SendGrid)

```bash
curl -X POST "https://app.connektco.com/api/auth/password-recovery" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"seu-email@exemplo.com\"}"
```
