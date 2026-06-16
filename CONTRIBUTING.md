# Contribuindo

## Fluxo de trabalho

- Crie uma branch a partir de `main` (ex.: `feat/...`, `fix/...`, `chore/...`).
- Abra um Pull Request com descrição objetiva (o quê e por quê).
- Garanta que o build passa antes de pedir revisão.

## Qualidade

- Evite alterações não relacionadas no mesmo PR.
- Não adicione segredos em `VITE_*` (variáveis `VITE_*` são expostas ao navegador).
- Não faça commit de chaves, tokens, `service_role`, dumps ou artefatos gerados.

## Checks locais

```bash
npm ci
npm run build
```

