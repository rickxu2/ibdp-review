param(
  [ValidatePattern('^[0-9a-fA-F-]{36}$')]
  [string]$StudentId,

  [switch]$Json
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$configPath = Join-Path $root 'docs/supabase-config.js'
$credentialPath = Join-Path $root '.codex-private/supabase-automation.credential.xml'

function Get-AllRows([string]$Url, $Headers, [string]$Table, [string]$Select, [string]$Filter = '') {
  $rows = @()
  $offset = 0
  $pageSize = 1000
  do {
    $query = "select=$([uri]::EscapeDataString($Select))&limit=$pageSize&offset=$offset"
    if ($Filter) { $query += "&$Filter" }
    $batch = @(Invoke-RestMethod -Method Get -Uri "$Url/rest/v1/$Table`?$query" -Headers $Headers)
    $rows += $batch
    $offset += $batch.Count
  } while ($batch.Count -eq $pageSize)
  return $rows
}

function Get-PathIdentity([string]$Path, $SubmissionByPath) {
  if (-not $Path) { return $null }
  $resource = [regex]::Match($Path, '/resources/papers/([^/]+)/([^/]+)/')
  if ($resource.Success) {
    return [pscustomobject]@{ subject = $resource.Groups[1].Value; resource_key = $resource.Groups[2].Value }
  }
  if ($SubmissionByPath.ContainsKey($Path)) {
    $submission = $SubmissionByPath[$Path]
    return [pscustomobject]@{ subject = $submission.subject; resource_key = $submission.resource_key }
  }
  return $null
}

$source = Get-Content -Raw -Encoding UTF8 $configPath
$url = [regex]::Match($source, 'url:\s*"([^"]+)"').Groups[1].Value.TrimEnd('/')
$apiKey = [regex]::Match($source, 'anonKey:\s*"([^"]+)"').Groups[1].Value
if (-not (Test-Path -LiteralPath $credentialPath)) {
  throw 'Automation credential is missing. Run scripts/configure-supabase-automation.ps1 once.'
}
$credential = Import-Clixml -LiteralPath $credentialPath
$password = $credential.GetNetworkCredential().Password
$authBody = @{ email = $credential.UserName; password = $password } | ConvertTo-Json -Compress
try {
  $auth = Invoke-RestMethod -Method Post -Uri "$url/auth/v1/token?grant_type=password" `
    -Headers @{ apikey = $apiKey } -ContentType 'application/json' -Body $authBody
} finally {
  $password = $null
  $authBody = $null
}
$headers = @{ apikey = $apiKey; Authorization = "Bearer $($auth.access_token)" }
$filter = if ($StudentId) { "student_id=eq.$StudentId" } else { '' }

$attempts = Get-AllRows $url $headers 'attempts' 'id,student_id,subject,source' $filter
$content = Get-AllRows $url $headers 'attempt_content' 'attempt_id,student_id,paper_key,question_file_path,markscheme_file_path,answer_file_path,supporting_file_paths' $filter
$resources = Get-AllRows $url $headers 'learning_resources' 'id,student_id,subject,resource_key,bucket_path,file_name' $filter
$submissions = Get-AllRows $url $headers 'submissions' 'id,student_id,subject,resource_key' $filter
$submissionFiles = Get-AllRows $url $headers 'submission_files' 'submission_id,student_id,bucket_path' $filter

$attemptById = @{}
foreach ($attempt in $attempts) { $attemptById[$attempt.id] = $attempt }
$submissionById = @{}
foreach ($submission in $submissions) { $submissionById[$submission.id] = $submission }
$submissionByPath = @{}
foreach ($file in $submissionFiles) {
  if ($submissionById.ContainsKey($file.submission_id)) { $submissionByPath[$file.bucket_path] = $submissionById[$file.submission_id] }
}

$issues = @()
foreach ($row in $content) {
  if (-not $attemptById.ContainsKey($row.attempt_id)) { continue }
  $attempt = $attemptById[$row.attempt_id]
  $expectedKey = $attempt.source.paper
  $links = @(
    [pscustomobject]@{ field = 'question_file_path'; path = $row.question_file_path },
    [pscustomobject]@{ field = 'markscheme_file_path'; path = $row.markscheme_file_path },
    [pscustomobject]@{ field = 'answer_file_path'; path = $row.answer_file_path }
  )
  foreach ($item in @($row.supporting_file_paths)) {
    if ($item) {
      $path = if ($item -is [string]) { $item } else { $item.path }
      $links += [pscustomobject]@{ field = 'supporting_file_paths'; path = $path }
    }
  }
  foreach ($link in $links) {
    $identity = Get-PathIdentity $link.path $submissionByPath
    if (-not $identity) { continue }
    $reason = if ($identity.subject -ne $attempt.subject) {
      'cross_subject'
    } elseif ($identity.resource_key -and $expectedKey -and $identity.resource_key -ne $expectedKey) {
      'cross_paper'
    } else {
      $null
    }
    if ($reason) {
      $issues += [pscustomobject]@{
        reason = $reason
        attempt_id = $row.attempt_id
        expected_subject = $attempt.subject
        expected_key = $expectedKey
        field = $link.field
        linked_subject = $identity.subject
        linked_key = $identity.resource_key
        path = $link.path
      }
    }
  }
}

$resourceIssues = @()
foreach ($resource in $resources) {
  $identity = Get-PathIdentity $resource.bucket_path $submissionByPath
  if ($identity -and $identity.subject -ne $resource.subject) {
    $resourceIssues += [pscustomobject]@{
      resource_id = $resource.id
      metadata_subject = $resource.subject
      path_subject = $identity.subject
      resource_key = $resource.resource_key
      path = $resource.bucket_path
    }
  }
}

$summary = @($issues | Group-Object expected_subject,expected_key,reason | ForEach-Object {
  [pscustomobject]@{
    attempts = @($_.Group.attempt_id | Sort-Object -Unique).Count
    links = $_.Count
    subject = $_.Group[0].expected_subject
    paper_key = $_.Group[0].expected_key
    reason = $_.Group[0].reason
  }
})
$result = [pscustomobject]@{
  checked = [pscustomobject]@{
    attempts = $attempts.Count
    content_records = $content.Count
    resources = $resources.Count
    submissions = $submissions.Count
  }
  issue_summary = $summary
  resource_metadata_path_mismatches = $resourceIssues
  issues = $issues
}

if ($Json) {
  $result | ConvertTo-Json -Depth 8
} else {
  Write-Host "Checked $($attempts.Count) attempts, $($content.Count) content records, and $($resources.Count) resources."
  if ($summary.Count) { $summary | Format-Table -AutoSize } else { Write-Host 'No cross-subject or cross-paper links found.' -ForegroundColor Green }
  if ($resourceIssues.Count) { $resourceIssues | Format-Table -AutoSize }
}

if ($issues.Count -or $resourceIssues.Count) { exit 1 }
