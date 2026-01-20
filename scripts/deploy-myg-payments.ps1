param(
  [Parameter(Mandatory=$true)][string]$ProjectRef,
  [Parameter(Mandatory=$true)][string]$ServiceRoleKey,
  [Parameter(Mandatory=$true)][string]$SupabaseUrl,
  [Parameter(Mandatory=$true)][string]$MygBaseUrl,
  [Parameter(Mandatory=$true)][string]$MygApiKey,
  [Parameter(Mandatory=$false)][string]$MygAuthorization,
  [Parameter(Mandatory=$false)][string]$MygSession,
  [Parameter(Mandatory=$false)][string]$AppBaseUrl = "http://localhost:3000"
)

function Write-Step($msg) { Write-Host "[step] $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "[ok] $msg" -ForegroundColor Green }
function Write-Err($msg) { Write-Host "[err] $msg" -ForegroundColor Red }

Write-Step "Checando Supabase CLI"
$cliCmd = "supabase"
try {
  $ver = & $cliCmd --version 2>$null
  if (-not $ver) { throw "not found" }
  Write-Ok "Supabase CLI encontrado: $ver"
} catch {
  Write-Step "Instalando Supabase CLI local (download do binário)"
  $exePath = Join-Path $PSScriptRoot "supabase.exe"
  try {
    Invoke-WebRequest -Uri "https://github.com/supabase/cli/releases/latest/download/supabase_windows_amd64.exe" -OutFile $exePath -UseBasicParsing
    if (-not (Test-Path $exePath)) { throw "download failed" }
    $cliCmd = $exePath
    $ver = & $cliCmd --version
    Write-Ok "Supabase CLI baixado: $ver"
  } catch {
    Write-Err "Falha ao instalar Supabase CLI: $_"
    exit 1
  }
}

Write-Step "Configurando secrets"
try {
  & $cliCmd secrets set --project-ref $ProjectRef SUPABASE_URL=$SupabaseUrl | Out-Host
  & $cliCmd secrets set --project-ref $ProjectRef SUPABASE_SERVICE_ROLE_KEY=$ServiceRoleKey | Out-Host
  & $cliCmd secrets set --project-ref $ProjectRef MYG_BASE_URL=$MygBaseUrl | Out-Host
  & $cliCmd secrets set --project-ref $ProjectRef MYG_API_KEY=$MygApiKey | Out-Host
  if ($MygAuthorization -and $MygAuthorization.Length -gt 0) {
    & $cliCmd secrets set --project-ref $ProjectRef MYG_AUTHORIZATION=$MygAuthorization | Out-Host
  }
  if ($MygSession -and $MygSession.Length -gt 0) {
    & $cliCmd secrets set --project-ref $ProjectRef MYG_SESSION=$MygSession | Out-Host
  }
  & $cliCmd secrets set --project-ref $ProjectRef APP_BASE_URL=$AppBaseUrl | Out-Host
  Write-Ok "Secrets configurados"
} catch {
  Write-Err "Erro ao configurar secrets: $_"
  exit 1
}

Write-Step "Fazendo deploy da função myg-payments"
try {
  & $cliCmd functions deploy myg-payments --project-ref $ProjectRef | Out-Host
  Write-Ok "Deploy concluído"
} catch {
  Write-Err "Erro no deploy: $_"
  exit 1
}

Write-Step "Testando endpoint /health"
try {
  $healthUrl = "$SupabaseUrl/functions/v1/myg-payments/health"
  $resp = Invoke-WebRequest -Uri $healthUrl -Method GET -UseBasicParsing -TimeoutSec 30
  Write-Ok "Health status: $($resp.StatusCode) - $($resp.Content)"
} catch {
  Write-Err "Falha ao testar health: $_"
}

Write-Step "Pronto. Para criar checkout via função, use a UI em http://localhost:3000/planos"
