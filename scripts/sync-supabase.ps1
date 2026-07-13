param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[0-9a-fA-F-]{36}$')]
  [string]$StudentId
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$url = $env:SUPABASE_URL
$secret = $env:SUPABASE_SERVICE_ROLE_KEY
if (-not $url -or -not $secret) {
  throw 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in this terminal before syncing. Never save the service-role key in the repository.'
}

$headers = @{
  apikey = $secret
  Authorization = "Bearer $secret"
  Prefer = 'resolution=merge-duplicates,return=minimal'
  'Content-Type' = 'application/json'
}

function Send-Upsert([string]$Table, [string]$Conflict, $Rows) {
  if (-not $Rows -or $Rows.Count -eq 0) { return }
  $body = ConvertTo-Json -InputObject @($Rows) -Depth 30 -Compress
  Invoke-RestMethod -Method Post -Uri "$url/rest/v1/$Table`?on_conflict=$Conflict" -Headers $headers -Body $body | Out-Null
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
      $contentRows += [ordered]@{
        attempt_id = $a.id; student_id = $StudentId; question_text = $c.q
        answer_text = $c.ans; markscheme_text = $c.ms; paper_key = $paper
        qp_page = $c.qp_page; ms_page = $c.ms_page
        question_file_path = $private.papers.$paper.qp_storage
        markscheme_file_path = $private.papers.$paper.ms_storage
        answer_file_path = $private.papers.$paper.answer_storage
        textbook_file_path = $private.papers.$paper.textbook_storage
      }
    }
  }
}

Send-Upsert 'attempts' 'id' $attemptRows
Send-Upsert 'attempt_content' 'attempt_id' $contentRows
Send-Upsert 'review_progress' 'attempt_id' $reviewRows
Write-Host "Synced $($attemptRows.Count) attempts, $($contentRows.Count) private content records, and $($reviewRows.Count) review records." -ForegroundColor Green
