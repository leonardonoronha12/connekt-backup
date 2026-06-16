# Testes

## Build (compilação)

Valida bundling, imports, rotas e configuração geral:

```bash
npm run build
```

## API (teste de fumaça)

1) Subir a API local:

```bash
npm run dev:api
```

2) Rodar teste de fumaça:

```bash
npm run test:api
```

O teste de fumaça valida respostas básicas e garante que payloads não vazem `Authorization`/segredos.
