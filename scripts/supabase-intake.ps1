param(
  [ValidateSet('Pull', 'Complete', 'Release')]
  [string]$Action = 'Pull',

  [ValidatePattern('^[0-9a-fA-F-]{36}$')]
  [string]$SubmissionId
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$configPath = Join-Path $root 'docs/supabase-config.js'
$credentialPath = Join-Path $root '.codex-private/supabase-automation.credential.xml'
$bucket = 'private-study-files'

function Get-PublicConfig {
  $source = Get-Content -Raw -Encoding UTF8 $configPath
  $urlMatch = [regex]::Match($source, 'url:\s*"([^"]+)"')
  $keyMatch = [regex]::Match($source, 'anonKey:\s*"([^"]+)"')
  $bucketMatch = [regex]::Match($source, 'bucket:\s*"([^"]+)"')
  if (-not $urlMatch.Success -or -not $keyMatch.Success) {
    throw 'Could not read Supabase URL and publishable key from docs/supabase-config.js.'
  }
  return @{
    Url = if ($env:SUPABASE_URL) { $env:SUPABASE_URL.TrimEnd('/') } else { $urlMatch.Groups[1].Value.TrimEnd('/') }
    Key = if ($env:SUPABASE_ANON_KEY) { $env:SUPABASE_ANON_KEY } else { $keyMatch.Groups[1].Value }
    Bucket = if ($bucketMatch.Success) { $bucketMatch.Groups[1].Value } else { $bucket }
  }
}

function Get-AutomationCredential {
  if ($env:SUPABASE_AUTOMATION_EMAIL -and $env:SUPABASE_AUTOMATION_PASSWORD) {
    return [pscredential]::new(
      $env:SUPABASE_AUTOMATION_EMAIL,
      (ConvertTo-SecureString $env:SUPABASE_AUTOMATION_PASSWORD -AsPlainText -Force)
    )
  }
  if (-not (Test-Path -LiteralPath $credentialPath)) {
    throw "Automation credential is missing. Run scripts/configure-supabase-automation.ps1 once as this Windows user."
  }
  return Import-Clixml -LiteralPath $credentialPath
}

function Get-AccessToken($Config) {
  $credential = Get-AutomationCredential
  $password = $credential.GetNetworkCredential().Password
  $body = @{ email = $credential.UserName; password = $password } | ConvertTo-Json -Compress
  try {
    $response = Invoke-RestMethod -Method Post -Uri "$($Config.Url)/auth/v1/token?grant_type=password" `
      -Headers @{ apikey = $Config.Key } -ContentType 'application/json' -Body $body
  } finally {
    $password = $null
    $body = $null
  }
  if (-not $response.access_token) { throw 'Supabase authentication returned no access token.' }
  return $response.access_token
}

function Get-Headers($Config, [string]$Token, [string]$Prefer = $null) {
  $headers = @{ apikey = $Config.Key; Authorization = "Bearer $Token" }
  if ($Prefer) { $headers.Prefer = $Prefer }
  return $headers
}

function ConvertTo-StorageUriPath([string]$Path) {
  return (($Path -split '/') | ForEach-Object { [uri]::EscapeDataString($_) }) -join '/'
}

function Set-SubmissionStatus($Config, [string]$Token, [string]$Id, [string]$Status) {
  $body = @{ status = $Status } | ConvertTo-Json -Compress
  Invoke-RestMethod -Method Patch -Uri "$($Config.Url)/rest/v1/submissions?id=eq.$Id" `
    -Headers (Get-Headers $Config $Token 'return=minimal') -ContentType 'application/json' -Body $body | Out-Null
}

$config = Get-PublicConfig
$token = Get-AccessToken $config
$projectRef = ([uri]$config.Url).Host.Split('.')[0]
$storageUrl = "https://$projectRef.storage.supabase.co"

if ($Action -in @('Complete', 'Release')) {
  if (-not $SubmissionId) { throw "-SubmissionId is required for $Action." }
  $status = if ($Action -eq 'Complete') { 'marked' } else { 'submitted' }
  Set-SubmissionStatus $config $token $SubmissionId $status
  [pscustomobject]@{ submission_id = $SubmissionId; status = $status } | ConvertTo-Json -Compress
  exit 0
}

$select = [uri]::EscapeDataString('id,student_id,subject,resource_key,title,note,status,submitted_at,submission_files(id,bucket_path,file_name,mime_type,size_bytes)')
$uri = "$($config.Url)/rest/v1/submissions?status=in.(submitted,marking)&select=$select&order=submitted_at.asc"
$responseRows = Invoke-RestMethod -Method Get -Uri $uri -Headers (Get-Headers $config $token)
$rows = @($responseRows) | Where-Object { $_ -and $_.id }
$downloaded = @()

foreach ($submission in $rows) {
  $folder = Join-Path $root ("inbox/submissions/{0}" -f $submission.id)
  New-Item -ItemType Directory -Force -Path $folder | Out-Null
  $localFiles = @()
  $index = 0
  foreach ($file in (@($submission.submission_files) | Where-Object { $_ -and $_.bucket_path })) {
    $index++
    $safeName = [regex]::Replace([IO.Path]::GetFileName($file.file_name), '[^A-Za-z0-9._ -]', '_')
    if (-not $safeName) { $safeName = "submission-file-$index" }
    $localName = '{0:D2}-{1}' -f $index, $safeName
    $destination = Join-Path $folder $localName
    $storagePath = ConvertTo-StorageUriPath $file.bucket_path
    Invoke-WebRequest -Uri "$storageUrl/storage/v1/object/authenticated/$($config.Bucket)/$storagePath" `
      -Headers (Get-Headers $config $token) -OutFile $destination
    if ($file.size_bytes -and (Get-Item -LiteralPath $destination).Length -ne [long]$file.size_bytes) {
      throw "Downloaded size mismatch for submission $($submission.id), file $($file.file_name)."
    }
    $localFiles += [ordered]@{
      file_name = $file.file_name
      local_file = $localName
      bucket_path = $file.bucket_path
      mime_type = $file.mime_type
      size_bytes = $file.size_bytes
    }
  }
  if ($localFiles.Count -eq 0) { continue }
  $metadata = [ordered]@{
    submission_id = $submission.id
    student_id = $submission.student_id
    subject = $submission.subject
    resource_key = $submission.resource_key
    title = $submission.title
    note = $submission.note
    submitted_at = $submission.submitted_at
    files = $localFiles
  }
  $metadata | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $folder '_supabase.json') -Encoding UTF8
  if ($submission.status -eq 'submitted') { Set-SubmissionStatus $config $token $submission.id 'marking' }
  $downloaded += [pscustomobject]@{
    submission_id = $submission.id
    student_id = $submission.student_id
    folder = $folder
    files = $localFiles.Count
    subject = $submission.subject
    resource_key = $submission.resource_key
  }
}

[pscustomobject]@{ count = $downloaded.Count; submissions = $downloaded } | ConvertTo-Json -Depth 10
