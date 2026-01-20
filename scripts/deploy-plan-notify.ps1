param(
  [Parameter(Mandatory=$true)][string]$ProjectRef,
  [Parameter(Mandatory=$false)][string]$AppBaseUrl = ""
)

function Write-Step($msg) { Write-Host "[step] $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "[ok] $msg" -ForegroundColor Green }
function Write-Err($msg) { Write-Host "[err] $msg" -ForegroundColor Red }

function Require($name, $value) {
  if (-not $value -or $value.Trim().Length -eq 0) {
    Write-Err "Variável obrigatória ausente: $name"
    exit 1
  }
}

Write-Step "Checando Supabase CLI"
$cliCmd = "supabase"
$cliMode = "global"
try {
  $ver = & $cliCmd --version 2>$null
  if (-not $ver) { throw "not found" }
  Write-Ok "Supabase CLI encontrado: $ver"
} catch {
  # Preferir CLI local via npm (npx) quando disponível para evitar download bloqueado.
  try {
    $npx = "npx"
    $ver = & $npx supabase --version 2>$null
    if ($ver) {
      $cliCmd = $npx
      $cliMode = "npx"
      Write-Ok "Supabase CLI encontrado via npx: $ver"
    } else {
      throw "npx supabase not available"
    }
  } catch {
  }

  if ($cliMode -eq "npx") {
    # segue usando npx, sem baixar exe
  } else {
  $exePath = Join-Path $PSScriptRoot "supabase.exe"
  if (Test-Path $exePath) {
    $cliCmd = $exePath
    try {
      $ver = & $cliCmd --version
      Write-Ok "Supabase CLI local encontrado: $ver"
    } catch {
      Write-Err "Supabase CLI local encontrado, mas falhou ao executar: $exePath"
      exit 1
    }
  } else {
    Write-Step "Supabase CLI não encontrado. Baixando binário local (Windows)..."
  }

  try {
    try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}
    if (Test-Path $exePath) { throw "skip download" }
    $headers = @{
      "User-Agent" = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      "Accept" = "application/octet-stream"
    }
    $url = $null
    try {
      $rel = Invoke-RestMethod -Uri "https://api.github.com/repos/supabase/cli/releases/latest" -Headers $headers -Method GET
      $tag = $rel.tag_name
      if ($tag -and $tag.Trim().Length -gt 0) {
        $url = "https://github.com/supabase/cli/releases/download/$tag/supabase_windows_amd64.exe"
      }
    } catch {
    }
    if (-not $url) {
      $url = "https://github.com/supabase/cli/releases/latest/download/supabase_windows_amd64.exe"
    }
    $attempt = 0
    while ($attempt -lt 3) {
      $attempt++
      try {
        Invoke-WebRequest -Uri $url -Headers $headers -OutFile $exePath -UseBasicParsing -MaximumRedirection 10
        break
      } catch {
        if ($attempt -ge 3) { throw $_ }
        Start-Sleep -Seconds (2 * $attempt)
      }
    }
    if (-not (Test-Path $exePath)) { throw "download failed" }
    $cliCmd = $exePath
    $ver = & $cliCmd --version
    Write-Ok "Supabase CLI baixado: $ver"
  } catch {
    Write-Err "Falha ao baixar Supabase CLI: $_"
    Write-Err "Instale manualmente em https://supabase.com/docs/guides/cli"
    exit 1
  }
  }
}

$sendgridApiKey = $env:SENDGRID_API_KEY
$sendgridFromEmail = $env:SENDGRID_FROM_EMAIL
$sendgridFromName = $env:SENDGRID_FROM_NAME

if (-not $sendgridFromName -or $sendgridFromName.Trim().Length -eq 0) {
  $sendgridFromName = "Connekt"
}

if (-not $AppBaseUrl -or $AppBaseUrl.Trim().Length -eq 0) {
  $AppBaseUrl = $env:APP_BASE_URL
}

Require "SENDGRID_API_KEY (env)" $sendgridApiKey
Require "SENDGRID_FROM_EMAIL (env)" $sendgridFromEmail
Require "APP_BASE_URL (param ou env)" $AppBaseUrl

Write-Step "Configurando secrets (plan-notify)"
try {
  if ($cliMode -eq "npx") {
    & $cliCmd supabase secrets set --project-ref $ProjectRef SENDGRID_API_KEY=$sendgridApiKey | Out-Host
    & $cliCmd supabase secrets set --project-ref $ProjectRef SENDGRID_FROM_EMAIL=$sendgridFromEmail | Out-Host
    & $cliCmd supabase secrets set --project-ref $ProjectRef SENDGRID_FROM_NAME=$sendgridFromName | Out-Host
    & $cliCmd supabase secrets set --project-ref $ProjectRef APP_BASE_URL=$AppBaseUrl | Out-Host
  } else {
    & $cliCmd secrets set --project-ref $ProjectRef SENDGRID_API_KEY=$sendgridApiKey | Out-Host
    & $cliCmd secrets set --project-ref $ProjectRef SENDGRID_FROM_EMAIL=$sendgridFromEmail | Out-Host
    & $cliCmd secrets set --project-ref $ProjectRef SENDGRID_FROM_NAME=$sendgridFromName | Out-Host
    & $cliCmd secrets set --project-ref $ProjectRef APP_BASE_URL=$AppBaseUrl | Out-Host
  }
  Write-Ok "Secrets configurados"
} catch {
  Write-Err "Erro ao configurar secrets: $_"
  exit 1
}

Write-Step "Fazendo deploy da função plan-notify"
try {
  if ($cliMode -eq "npx") {
    & $cliCmd supabase functions deploy plan-notify --project-ref $ProjectRef | Out-Host
  } else {
    & $cliCmd functions deploy plan-notify --project-ref $ProjectRef | Out-Host
  }
  Write-Ok "Deploy concluído"
} catch {
  Write-Err "Erro no deploy: $_"
  exit 1
}

Write-Ok "Pronto. Emails de contratação/cancelamento serão enviados via SendGrid."
