# Authenticate and push to ammarwebdev0001/Restaurant-Saas
$ErrorActionPreference = "Stop"
$gh = "C:\Program Files\GitHub CLI\gh.exe"

if (-not (Test-Path $gh)) {
  Write-Error "GitHub CLI not found. Install with: winget install GitHub.cli"
}

Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host "Checking GitHub login..." -ForegroundColor Cyan
& $gh auth status 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Sign in as ammarwebdev0001 in the browser when prompted." -ForegroundColor Yellow
  & $gh auth login --hostname github.com --git-protocol https --web --skip-ssh-key
}

& $gh auth setup-git
Write-Host "Pushing main..." -ForegroundColor Cyan
git push -u origin main
Write-Host "Done." -ForegroundColor Green
