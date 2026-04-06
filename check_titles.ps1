$path = "c:\Users\tmaut\Downloads\THE PHOENIX\NewKet\frontend\src\pages\admin\promos.html"
$bytes = [System.IO.File]::ReadAllBytes($path)

# The hex was E2 84 BC E4 BD 84 ... 
# If we interpret each 3-byte UTF-8 sequence as a single Unicode codepoint,
# and then extract the lower bytes of each codepoint...
# E2 84 BC = U+213C (DOUBLE-STRUCK SMALL PI = ℼ)
# The view showed: ℼ佄呃偙⁅瑨汭ാ
# ℼ = U+213C -> bytes 3C 21 when reversed = "!<" -> nope, that's "<!": yes! <!DOCTYPE

# So the file is actually UTF-8 encoded but read as Big-Endian pairs it forms valid HTML.
# Each CJK character encodes 2 bytes of the original HTML.

# Let's try: take the unicode codepoint values and extract pairs of bytes
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

$html = [System.Text.Encoding]::UTF8.GetString($htmlBytes.ToArray())
if ($html -match '<title>(.*?)</title>') {
    Write-Output "SUCCESS! Title: $($matches[1])"
} 

# Show first 100 chars
Write-Output "First 100:"
Write-Output $html.Substring(0, [Math]::Min(100, $html.Length))
