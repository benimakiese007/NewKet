# =============================================
#  NewKet — Script de build APK automatique
#  Double-clique sur ce fichier pour lancer !
# =============================================

$ErrorActionPreference = "Stop"
$FrontendDir = "$PSScriptRoot\frontend"
$AndroidDir  = "$FrontendDir\android"
$OutputDir   = "$FrontendDir\android\app\build\outputs\apk\release"
$DesktopDir  = [Environment]::GetFolderPath("Desktop")

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   NewKet APK Builder                  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Etape 1 - Build Vite
Write-Host "[1/3] Build Vite..." -ForegroundColor Yellow
Set-Location $FrontendDir
npm run build
Write-Host "      Build Vite OK !" -ForegroundColor Green

# Etape 2 - Sync Capacitor
Write-Host ""
Write-Host "[2/3] Sync Capacitor Android..." -ForegroundColor Yellow
npx cap sync android
Write-Host "      Sync OK !" -ForegroundColor Green

# Etape 3 - Compilation APK Release
Write-Host ""
Write-Host "[3/3] Compilation APK Release..." -ForegroundColor Yellow
Set-Location $AndroidDir
.\gradlew assembleRelease
Write-Host "      APK compile OK !" -ForegroundColor Green

# Chemins des APK générés
$ReleaseDir = "$FrontendDir\android\app\build\outputs\apk\release"

# Copie l'APK Release sur le Bureau avec horodatage
$ReleaseApk = Get-ChildItem "$ReleaseDir\*.apk" | Sort-Object LastWriteTime | Select-Object -Last 1
if ($ReleaseApk) {
    $Destination = "$DesktopDir\NewKet-$(Get-Date -Format 'yyyy-MM-dd_HH-mm').apk"
    Copy-Item $ReleaseApk.FullName $Destination
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "   APK Release pret sur ton Bureau !" -ForegroundColor Green
    Write-Host "   $Destination" -ForegroundColor White
    Write-Host "========================================" -ForegroundColor Green
} else {
    Write-Host "APK Release introuvable dans $ReleaseDir" -ForegroundColor Red
}

Write-Host ""
Write-Host "Appuie sur une touche pour fermer..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
