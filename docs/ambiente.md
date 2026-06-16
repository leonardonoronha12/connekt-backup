# Ambiente e variáveis

## Convenções

- `VITE_*`: variáveis expostas no bundle do front-end (visíveis no navegador). Não armazenar segredos.
- Lado do servidor: variáveis usadas apenas em tempo de execução na Vercel (API/Edge Functions). Devem conter segredos.

## Variáveis do front-end (SPA)

Obrigatórias:

- `VITE_SUPABASE_URL`: URL do projeto Supabase (ex.: `https://<ref>.supabase.co`).
- `VITE_SUPABASE_ANON_KEY`: chave pública (anon key) do Supabase.
- `VITE_APP_BASE_URL`: base URL do app em desenvolvimento/local (ex.: `http://localhost:3000`).

Opcionais (dependendo dos módulos habilitados):

- `VITE_SUPABASE_QUESTION_IMAGES_BUCKET`: bucket de imagens de questões (padrão usado em telas do banco de questões).
- `VITE_TESTER_EMAILS`: lista de e-mails (separados por vírgula) que habilita comportamento de plano QA em alguns fluxos.

## Variáveis do lado do servidor (API na Vercel)

Obrigatórias para endpoints administrativos e rotinas que usam Supabase Admin:

- `SUPABASE_SERVICE_ROLE_KEY`: chave de service role (admin). Nunca expor no front-end.

Integrações (exemplos; variáveis variam conforme feature ligada):

- Gateway de pagamentos: `PLANS_GATEWAY_*` / `MYG_*` (URL/base, chave de API, authdata).
- E-mail (SendGrid/SMTP): variáveis relacionadas a chave de API / SMTP e templates (ver `docs/sendgrid-api.md` e `docs/supabase-sendgrid-smtp.md`).

## Observações de segurança

- Nunca colocar `SUPABASE_SERVICE_ROLE_KEY`, tokens de gateway, tokens Vercel, secrets OAuth em `VITE_*`.
- Preferir configurar segredos diretamente no painel da Vercel (Project → Settings → Environment Variables).
