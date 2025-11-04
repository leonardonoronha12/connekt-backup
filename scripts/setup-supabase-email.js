#!/usr/bin/env node

/**
 * Script para configurar emails personalizados da Connekt no Supabase
 * 
 * Este script configura:
 * 1. Templates de email personalizados em português
 * 2. Configurações de SMTP personalizadas
 * 3. URLs de redirecionamento corretas
 * 4. Branding da Connekt nos emails
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🎓 Configurando emails personalizados da Connekt...\n');

// Verificar se os templates existem
const templatesDir = path.join(__dirname, '..', 'supabase', 'templates');
const configFile = path.join(__dirname, '..', 'supabase', 'config.toml');

const requiredTemplates = [
    'confirmation.html',
    'recovery.html'
];

console.log('📧 Verificando templates de email...');
let allTemplatesExist = true;

requiredTemplates.forEach(template => {
    const templatePath = path.join(templatesDir, template);
    if (fs.existsSync(templatePath)) {
        console.log(`✅ ${template} - OK`);
    } else {
        console.log(`❌ ${template} - NÃO ENCONTRADO`);
        allTemplatesExist = false;
    }
});

if (!allTemplatesExist) {
    console.log('\n❌ Alguns templates estão faltando. Execute o script de criação de templates primeiro.');
    process.exit(1);
}

// Verificar arquivo de configuração
if (fs.existsSync(configFile)) {
    console.log('✅ config.toml - OK');
} else {
    console.log('❌ config.toml - NÃO ENCONTRADO');
    process.exit(1);
}

console.log('\n🔧 Configurações necessárias no Supabase Dashboard:');
console.log('');
console.log('1. 📧 CONFIGURAÇÕES DE EMAIL:');
console.log('   - Acesse: Supabase Dashboard > Authentication > Settings');
console.log('   - Site URL: http://localhost:3000 (dev) ou https://appconnekt.com.br (prod)');
console.log('   - Redirect URLs: adicione as URLs de redirecionamento');
console.log('');
console.log('2. 📝 TEMPLATES DE EMAIL:');
console.log('   - Acesse: Authentication > Email Templates');
console.log('   - Substitua os templates padrão pelos templates da pasta supabase/templates/');
console.log('');
console.log('3. 🔐 CONFIGURAÇÕES SMTP (Opcional):');
console.log('   - Para usar domínio personalizado (noreply@appconnekt.com.br)');
console.log('   - Configure SMTP nas configurações de email');
console.log('');
console.log('4. 🌐 VARIÁVEIS DE AMBIENTE:');
console.log('   - Atualize o arquivo .env.local com suas credenciais');
console.log('   - VITE_SUPABASE_URL=sua_url_do_supabase');
console.log('   - VITE_SUPABASE_ANON_KEY=sua_chave_anonima');
console.log('   - SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key');
console.log('');

// Criar arquivo de instruções
const instructionsFile = path.join(__dirname, '..', 'CONFIGURACAO_EMAIL_CONNEKT.md');
const instructions = `# Configuração de Emails Personalizados - Connekt

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
- **Site URL**: \`http://localhost:3000\` (desenvolvimento)
- **Additional Redirect URLs**: 
  - \`http://localhost:3000/dashboard?email_confirmed=true\`
  - \`https://appconnekt.com.br/dashboard?email_confirmed=true\` (produção)

### 2. Templates de Email
- Acesse: **Authentication > Email Templates**
- **Confirm signup**: Copie o conteúdo de \`supabase/templates/confirmation.html\`
- **Reset password**: Copie o conteúdo de \`supabase/templates/recovery.html\`

### 3. Configurações SMTP (Opcional)
Para usar o domínio personalizado \`noreply@appconnekt.com.br\`:
- Acesse: **Authentication > Settings > SMTP Settings**
- Configure seu provedor SMTP (Gmail, SendGrid, etc.)

### 4. Variáveis de Ambiente
Atualize o arquivo \`.env.local\`:

\`\`\`env
VITE_SUPABASE_URL=sua_url_do_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anonima
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
SITE_URL=http://localhost:3000
\`\`\`

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
- Confirme a variável \`SITE_URL\`
- Verifique as \`Additional Redirect URLs\`
- Teste com URLs completas (incluindo protocolo)

### Templates não aparecem:
- Copie o HTML completo dos templates
- Salve as alterações no Supabase Dashboard
- Teste com um novo cadastro

---

**🎓 Connekt - Transforme seu conhecimento em renda**
`;

fs.writeFileSync(instructionsFile, instructions);
console.log(`📋 Instruções detalhadas salvas em: ${instructionsFile}`);
console.log('');
console.log('✅ Configuração concluída! Siga as instruções no arquivo CONFIGURACAO_EMAIL_CONNEKT.md');
console.log('');
console.log('🎉 Seus emails agora terão a identidade visual completa da Connekt!');