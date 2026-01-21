# Backup

## Backup no Git (recomendado)

- Branch: `backup/20260121`
- Tag: `backup-20260121-3b15742`

## Backup local em ZIP

```powershell
pwsh -File .\\tools\\backup.ps1
```

O arquivo ZIP é criado em `backups/` e inclui apenas arquivos versionados (sem `node_modules`).

