param(
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$ErrorActionPreference = "Stop"
Push-Location $Root

try {
  if (-not (Get-Command gitleaks -ErrorAction SilentlyContinue)) {
    throw "gitleaks is required"
  }

  gitleaks detect --source . --config .gitleaks.toml --verbose
  if ($LASTEXITCODE -ne 0) { throw "gitleaks failed" }

  $patterns = @(
    'C:\\Users\\ogosh',
    'C:/Users/ogosh',
    '/Users/s30519',
    '100\.\d+\.\d+\.\d+',
    '56ff9e80ac5d2f0c2bc9d680fc7af395',
    'sk-[A-Za-z0-9_-]{20,}',
    'ghp_[A-Za-z0-9_]{20,}'
  )

  $files = git ls-files | Where-Object { $_ -ne 'scripts/publish-preflight.ps1' }
  foreach ($pattern in $patterns) {
    $hits = $files | ForEach-Object {
      if (Test-Path -LiteralPath $_) {
        Select-String -Path $_ -Pattern $pattern -ErrorAction SilentlyContinue
      }
    }
    if ($hits) {
      $hits | ForEach-Object { Write-Error "$($_.Path):$($_.LineNumber):$($_.Line.Trim())" }
      throw "tracked leak pattern matched: $pattern"
    }
  }

  if (git ls-files wrangler.toml) {
    throw "wrangler.toml must stay untracked"
  }

  npm run check
  if ($LASTEXITCODE -ne 0) { throw "npm run check failed" }
  npm test
  if ($LASTEXITCODE -ne 0) { throw "npm test failed" }

  Write-Host "publish preflight ok"
}
finally {
  Pop-Location
}
