# Fix the encoding of the 6 admin pages
$files = @('promos.html','rapports.html','reviews.html','support.html','user-stats.html','profits.html')

foreach ($f in $files) {
    $path = "c:\Users\tmaut\Downloads\THE PHOENIX\NewKet\frontend\src\pages\admin\$f"
    $bytes = [System.IO.File]::ReadAllBytes($path)
    
    $text = [System.Text.Encoding]::UTF8.GetString($bytes)
    $htmlBytes = New-Object System.Collections.Generic.List[byte]
    foreach ($char in $text.ToCharArray()) {
        $cp = [int]$char
        if ($cp -le 0xFFFF) {
            $hi = ($cp -shr 8) -band 0xFF
            $lo = $cp -band 0xFF
            $htmlBytes.Add([byte]$lo)
            $htmlBytes.Add([byte]$hi)
        }
    }
    
    # Write the decoded bytes as proper UTF-8
    [System.IO.File]::WriteAllBytes($path, $htmlBytes.ToArray())
    Write-Output "Fixed encoding for $f"
}
