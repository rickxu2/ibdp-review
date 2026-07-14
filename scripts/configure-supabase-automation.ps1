$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$privateDir = Join-Path $root '.codex-private'
$credentialPath = Join-Path $privateDir 'supabase-automation.credential.xml'

New-Item -ItemType Directory -Force -Path $privateDir | Out-Null
$credential = Get-Credential -Message 'Supabase automation supervisor account' -UserName 'automation@example.com'
if (-not $credential) { throw 'No credential was supplied.' }
$credential | Export-Clixml -LiteralPath $credentialPath

Write-Host "Saved an encrypted Windows-user credential to $credentialPath" -ForegroundColor Green
Write-Host 'The file is ignored by Git and can only be decrypted by this Windows account.'
