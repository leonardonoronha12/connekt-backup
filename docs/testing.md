# Testes

## Build

Valida bundling, imports, rotas e configuração geral:

```bash
npm run build
```

## API (smoke test)

1) Subir a API local:

```bash
npm run dev:api
```

2) Rodar smoke test:

```bash
npm run test:backend
```

O smoke test valida respostas básicas e garante que payloads não vazem `Authorization`/segredos.

