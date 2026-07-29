param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[0-9a-fA-F-]{36}$')]
  [string]$StudentId,

  [switch]$OverwriteReviewProgress
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$publicConfig = Get-Content -Raw -Encoding UTF8 (Join-Path $root 'docs/supabase-config.js')
$urlMatch = [regex]::Match($publicConfig, 'url:\s*"([^"]+)"')
$keyMatch = [regex]::Match($publicConfig, 'anonKey:\s*"([^"]+)"')
$url = if ($env:SUPABASE_URL) { $env:SUPABASE_URL.TrimEnd('/') } else { $urlMatch.Groups[1].Value.TrimEnd('/') }
$apiKey = if ($env:SUPABASE_ANON_KEY) { $env:SUPABASE_ANON_KEY } else { $keyMatch.Groups[1].Value }
$token = $env:SUPABASE_SERVICE_ROLE_KEY
if ($token) {
  $apiKey = $token
} else {
  $credentialPath = Join-Path $root '.codex-private/supabase-automation.credential.xml'
  if (-not (Test-Path -LiteralPath $credentialPath)) {
    throw 'Automation credential is missing. Run scripts/configure-supabase-automation.ps1 once.'
  }
  $credential = Import-Clixml -LiteralPath $credentialPath
  $password = $credential.GetNetworkCredential().Password
  $authBody = @{ email = $credential.UserName; password = $password } | ConvertTo-Json -Compress
  try {
    $auth = Invoke-RestMethod -Method Post -Uri "$url/auth/v1/token?grant_type=password" -Headers @{ apikey = $apiKey } -ContentType 'application/json' -Body $authBody
  } finally {
    $password = $null
    $authBody = $null
  }
  $token = $auth.access_token
}
if (-not $url -or -not $apiKey -or -not $token) { throw 'Supabase URL, API key, or authentication token is unavailable.' }

$headers = @{
  apikey = $apiKey
  Authorization = "Bearer $token"
  'Content-Type' = 'application/json'
}

function Send-Upsert([string]$Table, [string]$Conflict, $Rows, [switch]$IgnoreDuplicates) {
  if (-not $Rows -or $Rows.Count -eq 0) { return }
  $body = ConvertTo-Json -InputObject @($Rows) -Depth 30 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($body)
  $requestHeaders = @{} + $headers
  $resolution = if ($IgnoreDuplicates) { 'ignore-duplicates' } else { 'merge-duplicates' }
  $requestHeaders.Prefer = "resolution=$resolution,return=minimal"
  try {
    Invoke-RestMethod -Method Post -Uri "$url/rest/v1/$Table`?on_conflict=$Conflict" -Headers $requestHeaders `
      -ContentType 'application/json; charset=utf-8' -Body $bytes | Out-Null
  } catch {
    throw "Supabase upsert failed for table '$Table': $($_.Exception.Message)"
  }
}

function ConvertTo-SupportingFilePaths($Value) {
  if ($null -eq $Value -or $Value -eq '') { return @() }
  if ($Value -is [string]) {
    try { $Value = $Value | ConvertFrom-Json -ErrorAction Stop }
    catch { return @([ordered]@{ path = $Value }) }
  }
  if ($Value -is [System.Array]) { return @($Value) }
  return @($Value)
}

function Get-ResourcePathSubject([string]$Path) {
  if (-not $Path) { return $null }
  $match = [regex]::Match($Path, '/resources/(?:papers|textbooks)/([^/]+)/')
  if ($match.Success) { return $match.Groups[1].Value }
  return $null
}

function Get-SafeResourcePath([string]$Path, [string]$ExpectedSubject) {
  $linkedSubject = Get-ResourcePathSubject $Path
  if ($linkedSubject -and $linkedSubject -ne $ExpectedSubject) { return $null }
  return $Path
}

function ConvertTo-SafeSupportingFilePaths($Value, [string]$ExpectedSubject) {
  $safe = @()
  foreach ($item in @(ConvertTo-SupportingFilePaths $Value)) {
    $path = if ($item -is [string]) { $item } else { $item.path }
    if (Get-SafeResourcePath $path $ExpectedSubject) { $safe += $item }
  }
  return $safe
}

$meta = Get-Content -Raw -Encoding UTF8 (Join-Path $root 'docs/data/meta.json') | ConvertFrom-Json
$attemptRows = @()
$contentRows = @()
$reviewRows = @()

$resourceSelect = [uri]::EscapeDataString('subject,resource_key,title,kind,file_role,bucket_path')
$resourceUri = "$url/rest/v1/learning_resources?student_id=eq.$StudentId&select=$resourceSelect&limit=1000"
$resourceRows = Invoke-RestMethod -Method Get -Uri $resourceUri -Headers $headers
$resourcesByPaper = @{}
foreach ($resource in $resourceRows) {
  if (-not $resource.subject -or -not $resource.resource_key) { continue }
  $lookupKey = "$($resource.subject)|$($resource.resource_key)"
  if (-not $resourcesByPaper.ContainsKey($lookupKey)) { $resourcesByPaper[$lookupKey] = @() }
  $resourcesByPaper[$lookupKey] += $resource
}

$submissionSelect = [uri]::EscapeDataString('id,subject,resource_key,status,submitted_at,submission_files(bucket_path,file_name)')
$submissionUri = "$url/rest/v1/submissions?student_id=eq.$StudentId&select=$submissionSelect&limit=1000"
$submissionRows = Invoke-RestMethod -Method Get -Uri $submissionUri -Headers $headers
$submissionsByPaper = @{}
foreach ($submission in $submissionRows) {
  if (-not $submission.subject -or -not $submission.resource_key -or -not $submission.submission_files) { continue }
  $lookupKey = "$($submission.subject)|$($submission.resource_key)"
  if (-not $submissionsByPaper.ContainsKey($lookupKey)) { $submissionsByPaper[$lookupKey] = @() }
  $submissionsByPaper[$lookupKey] += $submission
}

foreach ($relative in $meta.attempt_files) {
  $attemptPath = Join-Path (Join-Path $root 'docs') $relative
  $items = Get-Content -Raw -Encoding UTF8 $attemptPath | ConvertFrom-Json
  $privatePath = $attemptPath.Replace('\attempts\', '\private\').Replace('.json', '.content.json')
  $private = if (Test-Path $privatePath) { Get-Content -Raw -Encoding UTF8 $privatePath | ConvertFrom-Json } else { $null }

  foreach ($a in $items) {
    $attemptRows += [ordered]@{
      id = $a.id; student_id = $StudentId; date = $a.date; subject = $a.subject
      source = $a.source; kps = @($a.kps); command_term = $a.command_term
      max = $a.max; earned = $a.earned; verdict = $a.verdict; error_type = $a.error_type
      analysis = $a.analysis; textbook_ref = $a.textbook_ref; uncertain = [bool]$a.uncertain
    }
    if ($a.review) {
      $reviewRows += [ordered]@{
        attempt_id = $a.id; student_id = $StudentId; stage = $a.review.stage
        next_review = $a.review.next; done = [bool]$a.review.done; history = @($a.review.history)
      }
    }
    if ($private -and $private.items.PSObject.Properties.Name -contains $a.id) {
      $c = $private.items.($a.id)
      $paperKey = if ($a.source.paper) { $a.source.paper } else { $c.paper }
      $paperMetaKey = if ($c.paper) { $c.paper } else { $a.source.paper }
      $paperMeta = if ($paperMetaKey) { $private.papers.$paperMetaKey } else { $null }
      if ($paperMeta) {
        $metaSubjects = @($paperMeta.qp_storage, $paperMeta.ms_storage, $paperMeta.textbook_storage) |
          ForEach-Object { Get-ResourcePathSubject $_ } | Where-Object { $_ }
        if (@($metaSubjects | Where-Object { $_ -ne $a.subject }).Count -gt 0) { $paperMeta = $null }
      }
      $paperResources = @()
      $resourceLookupKey = "$($a.subject)|$paperKey"
      if ($paperKey -and $resourcesByPaper.ContainsKey($resourceLookupKey)) {
        $paperResources = @($resourcesByPaper[$resourceLookupKey])
      }
      $questionResource = @($paperResources |
        Where-Object { $_.kind -eq 'question_paper' -and $_.file_role -ne 'source_booklet' } |
        Sort-Object @{ Expression = {
          if ($_.file_role -in @('question_booklet', 'question_paper')) { 0 } else { 1 }
        } } |
        Select-Object -First 1)
      $markschemeResource = @($paperResources |
        Where-Object { $_.kind -eq 'markscheme' } |
        Select-Object -First 1)
      $questionPath = if ($paperMeta.qp_storage) { $paperMeta.qp_storage } elseif ($questionResource.Count) { $questionResource[0].bucket_path } else { $null }
      $markschemePath = if ($paperMeta.ms_storage) { $paperMeta.ms_storage } elseif ($markschemeResource.Count) { $markschemeResource[0].bucket_path } else { $null }
      $supportingPaths = @(ConvertTo-SafeSupportingFilePaths $c.supporting_file_paths $a.subject)
      foreach ($sourceResource in @($paperResources | Where-Object { $_.file_role -eq 'source_booklet' })) {
        if (-not @($supportingPaths | Where-Object { $_.path -eq $sourceResource.bucket_path }).Count) {
          $supportingPaths += [ordered]@{
            path = $sourceResource.bucket_path
            title = $sourceResource.title
            page = $null
          }
        }
      }
      $submissionId = $c.submission_id
      $answerPath = if ($c.answer_file_path) { $c.answer_file_path } else { $paperMeta.answer_storage }
      if (-not $answerPath -and $submissionsByPaper.ContainsKey($resourceLookupKey)) {
        $submissionCandidates = @($submissionsByPaper[$resourceLookupKey] |
          Where-Object { $_.status -eq 'marked' } |
          Sort-Object submitted_at -Descending)
        if ($submissionId) {
          $matchingSubmission = @($submissionCandidates | Where-Object { $_.id -eq $submissionId } | Select-Object -First 1)
        } else {
          $matchingSubmission = @($submissionCandidates | Select-Object -First 1)
        }
        if ($matchingSubmission.Count) {
          $answerFile = @($matchingSubmission[0].submission_files | Select-Object -First 1)
          if ($answerFile.Count) {
            $answerPath = $answerFile[0].bucket_path
            $submissionId = $matchingSubmission[0].id
          }
        }
      }
      # Some submissions are completed copies of the question paper. When a
      # separate clean booklet was never uploaded, that file is still the
      # authoritative source for both the question and submitted answer.
      if (-not $questionPath -and $answerPath) { $questionPath = $answerPath }
      if (-not $submissionId -and $answerPath -match '/submissions/([0-9a-fA-F-]{36})/') {
        $submissionId = $Matches[1]
      }
      $contentRows += [ordered]@{
        attempt_id = $a.id; student_id = $StudentId; question_text = $c.q
        answer_text = $c.ans; markscheme_text = $c.ms; paper_key = $paperKey
        qp_page = $c.qp_page; ms_page = $c.ms_page
        question_file_path = Get-SafeResourcePath $questionPath $a.subject
        markscheme_file_path = Get-SafeResourcePath $markschemePath $a.subject
        answer_file_path = Get-SafeResourcePath $answerPath $a.subject
        textbook_file_path = Get-SafeResourcePath $paperMeta.textbook_storage $a.subject
        supporting_file_paths = $supportingPaths
        submission_id = $submissionId
      }
    }
  }
}

$contentByAttempt = @{}
foreach ($row in $contentRows) { $contentByAttempt[$row.attempt_id] = $row }
$contentIssues = @()
foreach ($attempt in $attemptRows) {
  if (-not $contentByAttempt.ContainsKey($attempt.id)) {
    $contentIssues += "$($attempt.id): missing private content record"
    continue
  }
  $content = $contentByAttempt[$attempt.id]
  $missingFields = @()
  if ([string]::IsNullOrWhiteSpace($content.question_text)) { $missingFields += 'question_text' }
  if ([string]::IsNullOrWhiteSpace($content.answer_text)) { $missingFields += 'answer_text' }
  if ([string]::IsNullOrWhiteSpace($content.markscheme_text)) { $missingFields += 'markscheme_text' }
  if ($attempt.source.type -eq 'paper') {
    if ([string]::IsNullOrWhiteSpace($content.question_file_path)) { $missingFields += 'question_file_path' }
    if ([string]::IsNullOrWhiteSpace($content.markscheme_file_path)) { $missingFields += 'markscheme_file_path' }
    if ([string]::IsNullOrWhiteSpace($content.answer_file_path)) { $missingFields += 'answer_file_path' }
    if ([string]::IsNullOrWhiteSpace($content.submission_id)) { $missingFields += 'submission_id' }
  }
  if ($missingFields.Count -gt 0) {
    $contentIssues += "$($attempt.id): missing $($missingFields -join ', ')"
  }
}
if ($contentIssues.Count -gt 0) {
  throw "Private review content is incomplete. Nothing was synced.`n$($contentIssues -join "`n")"
}

Send-Upsert 'attempts' 'id' $attemptRows
Send-Upsert 'attempt_content' 'attempt_id' $contentRows
if ($OverwriteReviewProgress) {
  Send-Upsert 'review_progress' 'attempt_id' $reviewRows
  $reviewMessage = "$($reviewRows.Count) review records overwritten intentionally"
} else {
  Send-Upsert 'review_progress' 'attempt_id' $reviewRows -IgnoreDuplicates
  $reviewMessage = "$($reviewRows.Count) review seeds checked without overwriting cloud progress"
}

$cloudContentUri = "$url/rest/v1/attempt_content?student_id=eq.$StudentId&select=attempt_id,question_text,answer_text,markscheme_text,question_file_path,markscheme_file_path,answer_file_path,submission_id&limit=1000"
$cloudContent = Invoke-RestMethod -Method Get -Uri $cloudContentUri -Headers $headers
$cloudContentByAttempt = @{}
foreach ($row in $cloudContent) { $cloudContentByAttempt[$row.attempt_id] = $row }
$cloudIssues = @()
foreach ($attempt in $attemptRows) {
  if (-not $cloudContentByAttempt.ContainsKey($attempt.id)) {
    $cloudIssues += "$($attempt.id): row absent after sync"
    continue
  }
  $content = $cloudContentByAttempt[$attempt.id]
  $missingFields = @()
  if ([string]::IsNullOrWhiteSpace($content.question_text)) { $missingFields += 'question_text' }
  if ([string]::IsNullOrWhiteSpace($content.answer_text)) { $missingFields += 'answer_text' }
  if ([string]::IsNullOrWhiteSpace($content.markscheme_text)) { $missingFields += 'markscheme_text' }
  if ($attempt.source.type -eq 'paper') {
    if ([string]::IsNullOrWhiteSpace($content.question_file_path)) { $missingFields += 'question_file_path' }
    if ([string]::IsNullOrWhiteSpace($content.markscheme_file_path)) { $missingFields += 'markscheme_file_path' }
    if ([string]::IsNullOrWhiteSpace($content.answer_file_path)) { $missingFields += 'answer_file_path' }
    if ([string]::IsNullOrWhiteSpace($content.submission_id)) { $missingFields += 'submission_id' }
  }
  if ($missingFields.Count -gt 0) {
    $cloudIssues += "$($attempt.id): cloud missing $($missingFields -join ', ')"
  }
}
if ($cloudIssues.Count -gt 0) {
  throw "Supabase private review verification failed after sync.`n$($cloudIssues -join "`n")"
}

Write-Host "Synced $($attemptRows.Count) attempts, $($contentRows.Count) private content records, and $reviewMessage." -ForegroundColor Green
