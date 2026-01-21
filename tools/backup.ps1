$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $repoRoot

$sha = (git rev-parse --short HEAD).Trim()
$date = (Get-Date).ToString('yyyyMMdd-HHmmss')
$outDir = Join-Path $repoRoot 'backups'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$archiveName = "backup-$date-$sha.zip"
$archivePath = Join-Path $outDir $archiveName

$tmp = Join-Path $env:TEMP ("connekt-backup-" + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

try {
  $files = git ls-files
  foreach ($f in $files) {
    if (-not $f) { continue }
    $src = Join-Path $repoRoot $f
    if (-not (Test-Path $src)) { continue }
    $dst = Join-Path $tmp $f
    $dstDir = Split-Path -Parent $dst
    if (-not (Test-Path $dstDir)) { New-Item -ItemType Directory -Force -Path $dstDir | Out-Null }
    Copy-Item -Force $src $dst
  }

  if (Test-Path $archivePath) { Remove-Item -Force $archivePath }
  Compress-Archive -Path (Join-Path $tmp '*') -DestinationPath $archivePath -CompressionLevel Optimal
} finally {
  if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
}

Write-Output $archivePath

