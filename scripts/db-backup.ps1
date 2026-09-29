# ============================================================================
# scripts/db-backup.ps1
#
# Read-only backup/audit of the business data (nothing is ever modified).
# ASCII-only on purpose: works with every PowerShell version/encoding.
#
# Usage:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/db-backup.ps1
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/db-backup.ps1 -Action audit
#
# Credentials are read from (first found wins):
#   1) .db-admin.local  -> SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY   (gitignored)
#   2) .env.local       -> VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (RLS limited)
# ============================================================================
param(
  [ValidateSet('backup', 'audit')]
  [string]$Action = 'backup'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$tables = @(
  'items',
  'system_settings',
  'purchase_orders',
  'purchase_order_items',
  'goods_receipts',
  'goods_receipt_items',
  'stock_movements',
  'profiles'
)

function Read-SecretFile([string]$path) {
  $values = @{}
  if (-not (Test-Path $path)) { return $values }
  foreach ($line in Get-Content $path) {
    if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
    $parts = $line.Split('=', 2)
    $values[$parts[0].Trim()] = $parts[1].Trim()
  }
  return $values
}

$admin = Read-SecretFile '.db-admin.local'
$local = Read-SecretFile '.env.local'

$url = $admin['SUPABASE_URL']
if (-not $url) { $url = $local['VITE_SUPABASE_URL'] }

$key = $admin['SUPABASE_SERVICE_ROLE_KEY']
$keyKind = 'service_role'
if (-not $key) {
  $key = $local['VITE_SUPABASE_ANON_KEY']
  $keyKind = 'anon'
}

if (-not $url -or -not $key) {
  Write-Host 'Missing credentials. Create .db-admin.local with:' -ForegroundColor Yellow
  Write-Host '  SUPABASE_URL=https://<project-ref>.supabase.co'
  Write-Host '  SUPABASE_SERVICE_ROLE_KEY=<service-role-key>'
  exit 1
}

$headers = @{
  apikey        = $key
  Authorization = 'Bearer ' + $key
  Prefer        = 'count=exact'
}

$pageSize = 1000
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$targetDir = Join-Path $root ('backups\' + $stamp)

if ($Action -eq 'backup' -and -not (Test-Path $targetDir)) {
  New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
}

Write-Host ('Project  : ' + $url)
Write-Host ('Key type : ' + $keyKind)
if ($keyKind -eq 'anon') {
  Write-Host 'WARNING: anon key cannot read RLS-protected rows. Use service_role for a full backup.' -ForegroundColor Yellow
}
Write-Host ''

$summary = @{}
$totalRows = 0

foreach ($table in $tables) {
  $rows = New-Object System.Collections.Generic.List[object]
  $offset = 0
  $failed = $false

  while ($true) {
    $uri = $url + '/rest/v1/' + $table + '?select=*&limit=' + $pageSize + '&offset=' + $offset
    try {
      $response = Invoke-RestMethod -Uri $uri -Headers $headers -Method Get -TimeoutSec 60
    } catch {
      $status = $_.Exception.Response.StatusCode.value__
      $summary[$table] = 'ERR:' + $status
      Write-Host ($table.PadRight(22) + ' read failed (HTTP ' + $status + ')') -ForegroundColor Red
      $failed = $true
      break
    }

    if ($null -eq $response) { break }
    $batch = @($response)
    if ($batch.Count -eq 0) { break }

    $rows.AddRange($batch)
    if ($batch.Count -lt $pageSize) { break }
    $offset += $pageSize
  }

  if (-not $failed) {
    $summary[$table] = $rows.Count
    $totalRows += $rows.Count
    Write-Host ($table.PadRight(22) + ' ' + $rows.Count + ' rows')

    if ($Action -eq 'backup') {
      $file = Join-Path $targetDir ($table + '.json')
      $rows | ConvertTo-Json -Depth 25 | Set-Content -Path $file -Encoding UTF8
    }
  }
}

Write-Host ''
Write-Host ('Total rows read: ' + $totalRows)

if ($Action -eq 'backup') {
  $summary | ConvertTo-Json -Depth 3 | Set-Content -Path (Join-Path $targetDir 'counts.json') -Encoding UTF8

  $notes = @(
    'Backup: ' + $stamp,
    'Project: ' + $url,
    'Key type: ' + $keyKind,
    '',
    'Files: one JSON per table + counts.json',
    '',
    'This is an emergency read-only copy, not a replacement for a full Supabase backup:',
    '  supabase link --project-ref <project-ref>',
    '  supabase db dump -f backups/' + $stamp + '/full-dump.sql',
    'or Supabase dashboard -> Database -> Backups (daily + PITR).',
    '',
    'Emergency restore inside the database (after the snapshots migration):',
    "  select public.snapshot_business_data('before-restore');",
    "  select public.restore_business_data('<snapshot-name>', true);"
  )
  $notes | Set-Content -Path (Join-Path $targetDir 'README.txt') -Encoding UTF8

  Write-Host ('Saved to: ' + $targetDir) -ForegroundColor Green
}
