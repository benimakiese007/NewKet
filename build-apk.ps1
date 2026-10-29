# NewKet — Script de build APK Android
$ErrorActionPreference = "Stop"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   BUILD APK ANDROID — NEWKET EMARKET" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$frontendDir = Join-Path $PSScriptRoot "frontend"
Set-Location $frontendDir

Write-Host "`n[1/3] Compilation Web Vite..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { throw "Erreur lors du build Vite" }

Write-Host "`n[2/3] Synchronisation Capacitor Android..." -ForegroundColor Yellow
npx cap sync android
if ($LASTEXITCODE -ne 0) { throw "Erreur lors de cap sync android" }

Write-Host "`n[3/3] Compilation Gradle Android..." -ForegroundColor Yellow
Set-Location (Join-Path $frontendDir "android")

$isRelease = $true
try {
    .\gradlew.bat assembleRelease
    if ($LASTEXITCODE -ne 0) { $isRelease = $false }
} catch {
    $isRelease = $false
}

if (-not $isRelease) {
    Write-Host "⚠️  assembleRelease n'a pas abouti, compilation assembleDebug..." -ForegroundColor Magenta
    .\gradlew.bat assembleDebug
    if ($LASTEXITCODE -ne 0) { throw "Erreur lors de assembleDebug" }
}

$apkDir = if ($isRelease) {
    Join-Path $frontendDir "android\app\build\outputs\apk\release"
} else {
    Join-Path $frontendDir "android\app\build\outputs\apk\debug"
}

$apkFile = Get-ChildItem -Path $apkDir -Filter "*.apk" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1

if ($apkFile) {
    $desktop = [Environment]::GetFolderPath("Desktop")
    $timestamp = Get-Date -Format "yyyyMMdd-HHmm"
    $mode = if ($isRelease) { "Release" } else { "Debug" }
    $dest = Join-Path $desktop "NewKet-$mode-$timestamp.apk"
    Copy-Item $apkFile.FullName $dest -Force
    Write-Host "`n==================================================" -ForegroundColor Green
    Write-Host "🎉 SUCCES ! APK copie sur votre Bureau :" -ForegroundColor Green
    Write-Host "   $dest" -ForegroundColor White
    Write-Host "==================================================" -ForegroundColor Green
} else {
    Write-Host "⚠️  Fichier APK non trouve dans $apkDir" -ForegroundColor Red
}
