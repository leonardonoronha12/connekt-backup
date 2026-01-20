# Configuração de Email (Planos: contratação e cancelamento)

Este projeto envia emails para o usuário quando:
- um plano é **contratado/ativado**
- um plano é **cancelado**

O envio é feito pela função Supabase **plan-notify** via **SendGrid**.

## Secrets necessários (Supabase)

Configure no Supabase (Function Secrets):
- `SENDGRID_API_KEY`
- `SENDGRID_FROM_EMAIL`
- `SENDGRID_FROM_NAME` (opcional; padrão: `Connekt`)
- `APP_BASE_URL` (ex: `https://appconnekt.com.br`)

## Como configurar e fazer deploy (Windows / PowerShell)

1) Faça login no Supabase CLI (abre o navegador). Este projeto já inclui o CLI como dependência, então você pode usar `npx`:

```powershell
npx supabase login
```

2) Exporte as variáveis de ambiente (não cole em arquivos versionados):

```powershell
$env:SENDGRID_API_KEY="SUA_CHAVE_AQUI"
$env:SENDGRID_FROM_EMAIL="noreply@seu-dominio.com"
$env:SENDGRID_FROM_NAME="Connekt"
$env:APP_BASE_URL="https://appconnekt.com.br"
```

⚠️ Não copie/cole a chave em chat. Se você compartilhar o comando completo com a key, ela fica comprometida e deve ser revogada.

3) Rode o script de deploy (ele baixa o Supabase CLI automaticamente se necessário):

```powershell
.\scripts\deploy-plan-notify.ps1 -ProjectRef "SEU_PROJECT_REF"
```

### Se o download do Supabase CLI falhar

Algumas redes bloqueiam o download pelo GitHub. Nesse caso:

1) Baixe manualmente no navegador:
- https://github.com/supabase/cli/releases/latest
- Arquivo: `supabase_windows_amd64.exe`

2) Renomeie para `supabase.exe` e salve em:
- `.\scripts\supabase.exe`

3) Rode novamente:

```powershell
.\scripts\deploy-plan-notify.ps1 -ProjectRef "SEU_PROJECT_REF"
```

## Observações

- Não compartilhe `SENDGRID_API_KEY` em chat ou commit.
- Sem as secrets acima, a função responde `skipped` e não envia email.
