# Configuração de Emails Personalizados - Connekt

## 📧 Resumo das Alterações

Este projeto agora inclui emails personalizados da Connekt em português, substituindo completamente a identidade visual do Supabase.

### ✨ O que foi implementado:

1. **Templates HTML personalizados** em português
2. **Branding completo da Connekt** (logo, cores, mensagens)
3. **Configurações de redirecionamento** para o dashboard
4. **Mensagens de boas-vindas** personalizadas
5. **Design responsivo** e moderno

## 🚀 Como configurar no Supabase Dashboard:

### 1. Configurações Básicas
- Acesse: **Supabase Dashboard > Authentication > Settings**
- **Site URL**: `http://localhost:3000` (desenvolvimento)
- **Additional Redirect URLs**: 
  - `http://localhost:3000/dashboard?email_confirmed=true`
  - `https://appconnekt.com.br/dashboard?email_confirmed=true` (produção)

### 2. Templates de Email
- Acesse: **Authentication > Email Templates**
- **Confirm signup**: Copie o conteúdo de `supabase/templates/confirmation.html`
- **Reset password**: Copie o conteúdo de `supabase/templates/recovery.html`

### 3. Configurações SMTP (Opcional)
Para usar o domínio personalizado `noreply@appconnekt.com.br`:
- Acesse: **Authentication > Settings > SMTP Settings**
- Configure seu provedor SMTP (Gmail, SendGrid, etc.)

### 4. Variáveis de Ambiente
Atualize o arquivo `.env.local`:

```env
VITE_SUPABASE_URL=sua_url_do_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anonima
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
SITE_URL=http://localhost:3000
```

## 📱 Resultado Final:

### Email de Confirmação:
- ✅ Assunto: "Confirme seu cadastro na Connekt"
- ✅ Remetente: "Connekt" <noreply@appconnekt.com.br>
- ✅ Design: Branding completo da Connekt
- ✅ Idioma: Português brasileiro
- ✅ Call-to-action: "Confirmar meu email"
- ✅ Redirecionamento: Dashboard com banner de boas-vindas

### Email de Recuperação:
- ✅ Assunto: "Redefinir senha - Connekt"
- ✅ Design: Tema de segurança da Connekt
- ✅ Instruções: Claras e em português
- ✅ Expiração: Aviso de 1 hora

## 🎯 Próximos Passos:

1. **Teste os emails** em ambiente de desenvolvimento
2. **Configure o domínio SMTP** para produção
3. **Atualize as URLs** para o domínio final
4. **Teste o fluxo completo** de cadastro e confirmação

## 🔧 Troubleshooting:

### Emails não chegam:
- Verifique as configurações SMTP
- Confirme as URLs de redirecionamento
- Verifique a pasta de spam

### Redirecionamento não funciona:
- Confirme a variável `SITE_URL`
- Verifique as `Additional Redirect URLs`
- Teste com URLs completas (incluindo protocolo)

### Templates não aparecem:
- Copie o HTML completo dos templates
- Salve as alterações no Supabase Dashboard
- Teste com um novo cadastro

---

**🎓 Connekt - Transforme seu conhecimento em renda**
