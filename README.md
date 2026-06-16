# Connekt

Plataforma web para criação, gestão e venda de cursos (foco em Medicina), com área do produtor e área do aluno, incluindo simulados e banco de questões.

## Componentes

- **Frontend (SPA)**: Vite + React em `src/`.
- **API (Serverless na Vercel)**: roteamento em `api/index.js` com handlers em `api_handlers/`.
- **Supabase**: Auth + Postgres + Storage + Edge Functions em `supabase/`.

## Quickstart

1) Instalar dependências:

```bash
npm ci
```

2) Criar variáveis locais:

```bash
copy .env.production.example .env.local
```

Preencha no `.env.local`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_APP_BASE_URL` (ex.: `http://localhost:3000`)

3) Subir o app:

```bash
npm run dev
```

## Variáveis de ambiente (importante)

- Variáveis `VITE_*` vão para o navegador (não colocar segredos).
- Segredos e chaves de admin devem existir apenas no ambiente server-side (Vercel).

## Documentação

- Produto: `docs/PRD.md`
- Deploy Vercel: `docs/vercel-deploy.md`
- OAuth (Supabase): `docs/google-oauth-supabase.md` e `docs/facebook-oauth-supabase.md`

## Scripts úteis

- `npm run build`: build de produção
- `node scripts/api-dev-server.js`: sobe a API localmente (porta 3001 por padrão)
- `node scripts/backend-smoke-test.js`: valida endpoints básicos da API local

## Renomear repositório no GitHub

Para trocar o nome do repositório de `appcodigo` para `connekt` no GitHub:

- GitHub → Settings → General → Repository name → `connekt`

git remote add origin <URL-do-repositorio.git>
git push -u origin main
```

### O que mudou nesta versão
- Botão selecionado com largura 220px, altura 36px, raio 4px, gap 12, paddings 8/16 e cor `#F9FAFB`.
- `span` das bolinhas de status igual ao tamanho das imagens (16.25px), imagens ocupam todo o `span`.
- Tipografia do texto "Questão N": Inter 500, 14px, line-height 16px, tracking 0, cor `#22252B`.
- Desativação do `SpeedInsights` em localhost.

Para detalhes, consulte `CHANGELOG.md`.

## 🤝 Contribuição

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto é privado e proprietário.

## 🆘 Suporte

Para suporte, entre em contato com a equipe de desenvolvimento.

---

**Desenvolvido com ❤️ pela equipe AppCódigo**
