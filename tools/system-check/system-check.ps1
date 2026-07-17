param(
  [string]$Output = "system_health_report.md",
  [int]$SinceHours = 24
)

$ErrorActionPreference = "Stop"

function Write-Line {
  param([string]$Text = "")
  $script:Lines.Add($Text) | Out-Null
}

function Try-Run {
  param([string]$Command)
  try {
    return Invoke-Expression $Command 2>$null
  } catch {
    return $null
  }
}

function Has-Command {
  param([string]$Name)
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Search-Text {
  param(
    [string]$Pattern,
    [string[]]$Paths
  )

  if (Has-Command "rg") {
    $args = @(
      "--no-heading",
      "--line-number",
      "--fixed-strings",
      $Pattern
    ) + $Paths
    try { return & rg @args } catch { return @() }
  }

  $results = @()
  foreach ($p in $Paths) {
    if (Test-Path $p) {
      $results += (Get-ChildItem -Path $p -Recurse -File -Force -ErrorAction SilentlyContinue |
        Select-String -Pattern ([regex]::Escape($Pattern)) -SimpleMatch -ErrorAction SilentlyContinue |
        ForEach-Object { "$($_.Path):$($_.LineNumber):$($_.Line.Trim())" })
    }
  }
  return $results
}

$repoRoot = (Resolve-Path ".").Path
$now = Get-Date
$since = $now.AddHours(-1 * [Math]::Abs($SinceHours))

$script:Lines = New-Object System.Collections.Generic.List[string]

Write-Line "# System Health Report - $($now.ToString('yyyy-MM-dd'))"
Write-Line ""
Write-Line "- GeneratedAt: $($now.ToString('yyyy-MM-dd HH:mm:ss'))"
Write-Line "- Repo: $repoRoot"
Write-Line "- Window: last $SinceHours hours (since $($since.ToString('yyyy-MM-dd HH:mm:ss')))"

$branch = (Try-Run "git rev-parse --abbrev-ref HEAD") | Select-Object -First 1
if ($branch) { Write-Line "- Branch: $branch" }

$head = (Try-Run "git rev-parse --short HEAD") | Select-Object -First 1
if ($head) { Write-Line "- HEAD: $head" }

Write-Line ""
Write-Line "## Resume executif"
Write-Line "- Etat actuel: supervision locale (sans logs prod ni DB live)."
Write-Line "- Objectif: sortir une liste P0/P1/P2 avec preuves quand elles existent."
Write-Line ""

Write-Line "## Evidence (auto-collected)"

$gitStatus = Try-Run "git status --porcelain"
if ($gitStatus) {
  Write-Line ""
  Write-Line "### Git status"
  Write-Line '```'
  @($gitStatus) | ForEach-Object { Write-Line $_ }
  Write-Line '```'
}

$diffStat = Try-Run "git diff --stat"
if ($diffStat) {
  Write-Line ""
  Write-Line "### Git diff --stat"
  Write-Line '```'
  @($diffStat) | ForEach-Object { Write-Line $_ }
  Write-Line '```'
}

Write-Line ""
Write-Line "### Payment/Webhook surface (code scan)"
$hits = Search-Text -Pattern "webhook" -Paths @("backend/src", "frontend/src", "database", "supabase")
if ($hits.Count -gt 0) {
  Write-Line '```'
  $hits | Select-Object -First 80 | ForEach-Object { Write-Line $_ }
  if ($hits.Count -gt 80) { Write-Line "...(truncated)" }
  Write-Line '```'
} else {
  Write-Line "- No explicit 'webhook' keyword found in scanned paths."
}

Write-Line ""
Write-Line "### Migrations recents (last 30)"
$migPaths = @("database/supabase/migrations", "supabase/migrations")
$migFiles = @()
foreach ($mp in $migPaths) {
  if (Test-Path $mp) {
    $migFiles += (Get-ChildItem -Path $mp -File -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 30)
  }
}
if ($migFiles.Count -gt 0) {
  Write-Line '```'
  $migFiles | ForEach-Object { Write-Line $_.FullName.Replace($repoRoot + "\\", "") }
  Write-Line '```'
} else {
  Write-Line "- No migration directories found."
}

Write-Line ""
Write-Line "## Incidents P0 (Critique)"
Write-Line ""
Write-Line "| ID | Categorie | Impact | Preuve | Action immediate | Action robuste | Owner |"
Write-Line "|---:|---|---|---|---|---|---|"
Write-Line "| P0-001 | Paiements | Risque d'incoherence paiement/commande si webhook non fiable | `code-scan:webhook` (voir Evidence) | Verifier route webhook + idempotence + mapping statuts | Ledger + job de reconciliation + alerting | backend/db |"
Write-Line ""

Write-Line "## Incidents P1 (Important)"
Write-Line ""
Write-Line "| ID | Categorie | Impact | Preuve | Action immediate | Action robuste | Owner |"
Write-Line "|---:|---|---|---|---|---|---|"
Write-Line "| P1-001 | Performance | Lenteurs potentielles non mesurees (manque de metriques) | aucune (logs/perf non fournis) | Activer logs/metrics (latence API, 5xx, TTFB) | Dashboard + alertes temps reel | ops/backend |"
Write-Line "| P1-002 | UX Checkout | Abandon checkout impossible a confirmer sans analytics | aucune (analytics non fournis) | Instrumenter funnel + capturer erreurs checkout | A/B tests + optimisation paiement | frontend/backend |"
Write-Line ""

Write-Line "## Ameliorations P2"
Write-Line "- Ajouter une source de verite pour la supervision: logs persistants + endpoints health."
Write-Line "- Ajouter une table/stream d'incidents (si prod): issue ledger + ack + resolution."
Write-Line ""

Write-Line "## Checklist system-check (runbook)"
Write-Line "1) Backend: top 10 endpoints lents + top 10 erreurs (4xx/5xx)."
Write-Line "2) Paiements: paiements OK mais commandes pas OK (requete SQL)."
Write-Line "3) Commandes: commandes bloquees / delais depasses."
Write-Line "4) Users: taux abandon checkout + erreurs front checkout."
Write-Line "5) Vendors: taux livraison + disputes + inactivite."
Write-Line ""

$outPath = Join-Path $repoRoot $Output
$script:Lines | Set-Content -Path $outPath -Encoding UTF8

Write-Host "OK: report generated at $outPath"
