param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[0-9a-fA-F-]{36}$')]
  [string]$StudentId
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
  Prefer = 'resolution=merge-duplicates,return=minimal'
  'Content-Type' = 'application/json'
}

function Send-Upsert([string]$Table, [string]$Conflict, $Rows) {
  if (-not $Rows -or $Rows.Count -eq 0) { return }
  $body = ConvertTo-Json -InputObject @($Rows) -Depth 30 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($body)
  try {
    Invoke-RestMethod -Method Post -Uri "$url/rest/v1/$Table`?on_conflict=$Conflict" -Headers $headers `
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

$meta = Get-Content -Raw -Encoding UTF8 (Join-Path $root 'docs/data/meta.json') | ConvertFrom-Json
$attemptRows = @()
$contentRows = @()
$reviewRows = @()

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
      $paper = if ($c.paper) { $c.paper } else { $a.source.paper }
      $paperMeta = if ($paper) { $private.papers.$paper } else { $null }
      $answerPath = if ($c.answer_file_path) { $c.answer_file_path } else { $paperMeta.answer_storage }
      $submissionId = $c.submission_id
      if (-not $submissionId -and $answerPath -match '/submissions/([0-9a-fA-F-]{36})/') {
        $submissionId = $Matches[1]
      }
      $contentRows += [ordered]@{
        attempt_id = $a.id; student_id = $StudentId; question_text = $c.q
        answer_text = $c.ans; markscheme_text = $c.ms; paper_key = $paper
        qp_page = $c.qp_page; ms_page = $c.ms_page
        question_file_path = $paperMeta.qp_storage
        markscheme_file_path = $paperMeta.ms_storage
        answer_file_path = $answerPath
        textbook_file_path = $paperMeta.textbook_storage
        supporting_file_paths = ConvertTo-SupportingFilePaths $c.supporting_file_paths
        submission_id = $submissionId
      }
    }
  }
}

Send-Upsert 'attempts' 'id' $attemptRows
Send-Upsert 'attempt_content' 'attempt_id' $contentRows
Send-Upsert 'review_progress' 'attempt_id' $reviewRows
Write-Host "Synced $($attemptRows.Count) attempts, $($contentRows.Count) private content records, and $($reviewRows.Count) review records." -ForegroundColor Green
