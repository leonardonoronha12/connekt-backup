param(
  [Parameter(Mandatory=$false)][string]$ProjectRef = "ucsijwfarkrljbkdvrbd",
  [Parameter(Mandatory=$false)][string]$WebhookToken,
  [Parameter(Mandatory=$false)][switch]$DeployFunction = $true
)

function Write-Step($msg) { Write-Host "[step] $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "[ok] $msg" -ForegroundColor Green }
function Write-Err($msg) { Write-Host "[err] $msg" -ForegroundColor Red }

function New-RandomToken() {
  $bytes = New-Object byte[] 48
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $b64 = [Convert]::ToBase64String($bytes)
  $b64url = $b64.TrimEnd('=').Replace('+', '-').Replace('/', '_')
  return "mgw_$($ProjectRef)_$($b64url)"
}

Write-Step "Checando Supabase CLI"
$cliMode = "bin"
try {
  $ver = & supabase --version 2>$null
  if (-not $ver) { throw "not found" }
  Write-Ok "Supabase CLI encontrado: $ver"
} catch {
  try {
    $ver = & npm exec --yes supabase -- --version 2>$null
    if (-not $ver) { throw "not found" }
    $cliMode = "npmexec"
    Write-Ok "Supabase CLI via npm exec: $ver"
  } catch {
    Write-Err "Supabase CLI não encontrado. Rode: npm i e tente novamente."
    exit 1
  }
}

function Invoke-Supabase {
  param([Parameter(Mandatory=$true)][string[]]$Args)
  if ($cliMode -eq "npmexec") {
    & npm exec --yes supabase -- @Args
  } else {
    & supabase @Args
  }
}

if (-not $WebhookToken -or $WebhookToken.Trim().Length -lt 16) {
  $WebhookToken = New-RandomToken
}

Write-Step "Configurando secret MYG_WEBHOOK_TOKEN"
try {
  Invoke-Supabase -Args @("secrets","set","--project-ref",$ProjectRef,"MYG_WEBHOOK_TOKEN=$WebhookToken") | Out-Host
  Write-Ok "Secret MYG_WEBHOOK_TOKEN configurada"
} catch {
  Write-Err "Erro ao configurar secret: $_"
  Write-Host "Dica: execute 'supabase login' e tente novamente." -ForegroundColor Yellow
  exit 1
}

if ($DeployFunction) {
  Write-Step "Fazendo deploy da função myg-payment-webhook"
  try {
    Invoke-Supabase -Args @("functions","deploy","myg-payment-webhook","--project-ref",$ProjectRef) | Out-Host
    Write-Ok "Deploy concluído"
  } catch {
    Write-Err "Erro no deploy: $_"
    exit 1
  }
}

Write-Ok "Pronto"
Write-Host "Webhook URL: https://$ProjectRef.supabase.co/functions/v1/myg-payment-webhook"
Write-Host "Header na MyGateway: Authorization: $WebhookToken"
