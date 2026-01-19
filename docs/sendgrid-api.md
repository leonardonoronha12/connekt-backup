# Envio de email via Vercel API (SendGrid)

Este projeto expõe um endpoint em `POST /api/send-email` para envio de emails transacionais via SendGrid.

## Variáveis de ambiente (Vercel)
- `SENDGRID_API_KEY` (obrigatório)
- `SENDGRID_FROM_EMAIL` (obrigatório, precisa ser verificado no SendGrid)
- `SENDGRID_FROM_NAME` (opcional, default: `Connekt`)
- `SENDGRID_REPLY_TO` (opcional)
- `SENDGRID_ALLOW_ANY_TO` (opcional, default `false`)

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

