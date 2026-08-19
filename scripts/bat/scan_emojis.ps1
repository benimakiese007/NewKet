$emojiRegex = '[^\x00-\x7F]'
$extensions = @('*.tsx','*.jsx','*.ts','*.js','*.html')
$results = @()

foreach ($ext in $extensions) {
    $files = Get-ChildItem -Path 'frontend' -Recurse -Filter $ext -ErrorAction SilentlyContinue
    foreach ($f in $files) {
        $lines = Get-Content $f.FullName -Encoding UTF8 -ErrorAction SilentlyContinue
        $lineNum = 0
        foreach ($line in $lines) {
            $lineNum++
            $m = [regex]::Matches($line, $emojiRegex)
            if ($m.Count -gt 0) {
                $results += [PSCustomObject]@{
                    Fichier = $f.FullName -replace [regex]::Escape('c:\Users\tmaut\Downloads\THE PHOENIX\NewKet\'), ''
                    Ligne   = $lineNum
                    Emojis  = ($m | ForEach-Object { $_.Value }) -join ''
                }
            }
        }
    }
}

if ($results.Count -eq 0) {
    Write-Host 'Aucun emoji trouve.' -ForegroundColor Green
} else {
    Write-Host "TOTAL : $($results.Count) lignes avec caracteres non-ASCII (emojis)" -ForegroundColor Red
    $results | Format-Table -AutoSize -Wrap
}
