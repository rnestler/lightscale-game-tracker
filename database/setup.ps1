$ErrorActionPreference = "Stop"

$dir = Split-Path -Parent $MyInvocation.MyCommand.Path

Get-Content "$dir\..\.env" -Encoding UTF8 | ForEach-Object {
  if ($_ -match '^([^#=]+)=(.*)$') {
    $name = $Matches[1].Trim()
    $value = $Matches[2].Trim()
    if ($value -match '^"(.*)"$' -or $value -match "^'(.*)'$") { $value = $Matches[1] }
    [Environment]::SetEnvironmentVariable($name, $value, "Process")
  }
}

if (-not $env:DB_HOST) { $env:DB_HOST = "localhost" }
if (-not $env:DB_PORT) { $env:DB_PORT = "5432" }
if (-not $env:DB_ADMIN_USER) { $env:DB_ADMIN_USER = "postgres" }
if (-not $env:DB_ADMIN_DATABASE) { $env:DB_ADMIN_DATABASE = "postgres" }

$adminDatabase = $env:DB_ADMIN_DATABASE
$probe = @'
\getenv probe_db_name DB_NAME
SELECT :'probe_db_name';
'@

function Test-AdminConnection {
  param([string[]]$ConnectionArgs)
  # A failing rung must fall through to the next one, not throw: PowerShell 7.4+ defaults
  # $PSNativeCommandUseErrorActionPreference to true, which turns psql's non-zero exit into a
  # terminating error under "Stop". Local scope only; harmless on 5.1, where it doesn't exist.
  $PSNativeCommandUseErrorActionPreference = $false
  $probe | psql @ConnectionArgs -w -q -v ON_ERROR_STOP=1 -d "$adminDatabase" -f - 2>$null | Out-Null
  return $LASTEXITCODE -eq 0
}

$adminArgs = $null

$priorPgPassword = $env:PGPASSWORD
if ($env:DB_ADMIN_PASSWORD) {
  $env:PGPASSWORD = $env:DB_ADMIN_PASSWORD
  $candidate = @("-h", $env:DB_HOST, "-p", $env:DB_PORT, "-U", $env:DB_ADMIN_USER)
  if (Test-AdminConnection $candidate) { $adminArgs = $candidate }
  if (-not $adminArgs) {
    # Restore, don't destroy, any PGPASSWORD the user already had: the next rung falls back to an
    # ambient PGPASSWORD, and clearing it here would erase a working credential just because
    # DB_ADMIN_PASSWORD was wrong.
    if ($priorPgPassword) { $env:PGPASSWORD = $priorPgPassword } else { Remove-Item Env:PGPASSWORD }
  }
}
if (-not $adminArgs) {
  $candidate = @("-h", $env:DB_HOST, "-p", $env:DB_PORT, "-U", $env:DB_ADMIN_USER)
  if (Test-AdminConnection $candidate) { $adminArgs = $candidate }
}
if (-not $adminArgs) {
  $candidate = @("-U", $env:DB_ADMIN_USER)
  if (Test-AdminConnection $candidate) { $adminArgs = $candidate }
}

if (-not $adminArgs) {
  Write-Host ""
  Write-Host "Could not connect to PostgreSQL as an administrator. Tried $env:DB_ADMIN_USER@$($env:DB_HOST):$($env:DB_PORT) (with DB_ADMIN_PASSWORD from .env, if set) and the default local connection."
  Write-Host "Set DB_HOST/DB_PORT/DB_ADMIN_USER/DB_ADMIN_PASSWORD/DB_ADMIN_DATABASE in .env for a remote host, a container, or a non-default install."
  exit 1
}

Write-Host "Creating database and user..."
psql @adminArgs -w -v ON_ERROR_STOP=1 -d $adminDatabase -f "$dir\setup.sql"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Done. Next: npm run migrate, then npm run setup:auth."
