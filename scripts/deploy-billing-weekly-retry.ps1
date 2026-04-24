param(
  [Parameter(Mandatory=$false)][string]$ProjectRef = "",
  [Parameter(Mandatory=$false)][string]$Cron = "0 12 * * 1"
)

function Write-Step($msg) { Write-Host "[step] $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "[ok] $msg" -ForegroundColor Green }
function Write-Err($msg) { Write-Host "[err] $msg" -ForegroundColor Red }

function Read-ProjectRefFromRepo() {
  try {
    $p = Join-Path (Join-Path $PSScriptRoot "..\\supabase\\supabase\\.temp") "project-ref"
    if (Test-Path $p) {
      $v = Get-Content $p -Raw
      if ($v) { return $v.Trim() }
    }
  } catch {}
  return ""
}

Write-Step "Resolvendo ProjectRef"
if (-not $ProjectRef -or $ProjectRef.Trim().Length -eq 0) {
  $ProjectRef = Read-ProjectRefFromRepo
}
if (-not $ProjectRef -or $ProjectRef.Trim().Length -eq 0) {
  Write-Err "ProjectRef não encontrado. Passe -ProjectRef ou configure em supabase/.temp."
  exit 1
}
Write-Ok "ProjectRef: $ProjectRef"

Write-Step "Checando Supabase CLI"
$cliCmd = "supabase"
$cliMode = "global"
$cliPrefix = @()
function Invoke-SupabaseCli([string[]]$CliArgs) {
  if ($cliMode -eq "npx") {
    & $cliCmd @($cliPrefix + $CliArgs) | Out-Host
  } else {
    & $cliCmd @CliArgs | Out-Host
  }
}
function SupabaseVersion() {
  try {
    if ($cliMode -eq "npx") {
      return & $cliCmd @($cliPrefix + @("--version")) 2>$null
    }
    return & $cliCmd --version 2>$null
  } catch { return $null }
}

$localCmd = Join-Path (Join-Path $PSScriptRoot "..\\node_modules\\.bin") "supabase.cmd"
if (Test-Path $localCmd) {
  $cliCmd = $localCmd
  $cliMode = "local"
  $ver = SupabaseVersion
  if ($ver) {
    Write-Ok "Supabase CLI local (node_modules) encontrado: $ver"
  }
}
try {
  if ($cliMode -ne "local") { $ver = SupabaseVersion }
  if (-not $ver) { throw "not found" }
  if ($cliMode -ne "local") { Write-Ok "Supabase CLI encontrado: $ver" }
} catch {
  try {
    $npx = "npx"
    $cliCmd = $npx
    $cliMode = "npx"
    $cliPrefix = @("--yes","supabase")
    $ver = SupabaseVersion
    if ($ver) {
      Write-Ok "Supabase CLI encontrado via npx: $ver"
    } else {
      throw "npx supabase not available"
    }
  } catch {
  }

  if ($cliMode -eq "npx") {
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

Write-Step "Gerando CRON_SECRET"
$cronSecret = ""
try { $cronSecret = [Guid]::NewGuid().ToString("N") } catch { $cronSecret = "cron_" + (Get-Random) }
Write-Ok "CRON_SECRET gerado"

Write-Step "Configurando secrets (Edge Functions)"
try {
  Invoke-SupabaseCli @("secrets","set","--project-ref",$ProjectRef,"CRON_SECRET=$cronSecret")
  if ($env:APP_BASE_URL -and $env:APP_BASE_URL.Trim().Length -gt 0) { Invoke-SupabaseCli @("secrets","set","--project-ref",$ProjectRef,"APP_BASE_URL=$env:APP_BASE_URL") }
  if ($env:SENDGRID_API_KEY -and $env:SENDGRID_API_KEY.Trim().Length -gt 0) { Invoke-SupabaseCli @("secrets","set","--project-ref",$ProjectRef,"SENDGRID_API_KEY=$env:SENDGRID_API_KEY") }
  if ($env:SENDGRID_FROM_EMAIL -and $env:SENDGRID_FROM_EMAIL.Trim().Length -gt 0) { Invoke-SupabaseCli @("secrets","set","--project-ref",$ProjectRef,"SENDGRID_FROM_EMAIL=$env:SENDGRID_FROM_EMAIL") }
  if ($env:SENDGRID_FROM_NAME -and $env:SENDGRID_FROM_NAME.Trim().Length -gt 0) { Invoke-SupabaseCli @("secrets","set","--project-ref",$ProjectRef,"SENDGRID_FROM_NAME=$env:SENDGRID_FROM_NAME") }
  Write-Ok "Secrets configurados"
} catch {
  Write-Err "Erro ao configurar secrets: $_"
  exit 1
}

Write-Step "Fazendo deploy das funções"
try {
  Invoke-SupabaseCli @("functions","deploy","billing-weekly-retry","--project-ref",$ProjectRef)
  Invoke-SupabaseCli @("functions","deploy","myg-payments","--project-ref",$ProjectRef)
  Write-Ok "Deploy concluído"
} catch {
  Write-Err "Erro no deploy: $_"
  exit 1
}

Write-Step "Configurando cron semanal (pg_cron + pg_net)"
try {
  $env:SUPABASE_PROJECT_REF = $ProjectRef
  $env:CRON_SECRET = $cronSecret
  $env:BILLING_WEEKLY_RETRY_CRON = $Cron
  node (Join-Path $PSScriptRoot "setup-billing-weekly-retry-cron.js") | Out-Host
  Write-Ok "Cron configurado"
} catch {
  Write-Err "Erro ao configurar cron: $_"
  exit 1
}

Write-Ok "Pronto. Rotina semanal ativa para cobrança pendente + email."
