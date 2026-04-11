# Fix all /pages/ -> /src/pages/ in source HTML files
$files = @(
    "frontend\public\components\header.html",
    "frontend\public\components\footer.html",
    "frontend\public\components\mobile-nav.html",
    "frontend\src\pages\publish.html",
    "frontend\src\pages\login.html",
    "frontend\src\pages\settings.html",
    "frontend\src\pages\cart.html",
    "frontend\src\pages\customer-dashboard.html",
    "frontend\src\pages\shop.html"
)

foreach ($file in $files) {
    $fullPath = Join-Path (Get-Location) $file
    if (Test-Path $fullPath) {
        $content = [System.IO.File]::ReadAllText($fullPath)
        $newContent = $content -replace "'/pages/", "'/src/pages/" -replace '"/pages/', '"/src/pages/'
        [System.IO.File]::WriteAllText($fullPath, $newContent, [System.Text.Encoding]::UTF8)
        Write-Host "Fixed: $file"
    } else {
        Write-Host "NOT FOUND: $file"
    }
}

Write-Host "Done."
