@echo off
title NewKet - Tous les Tests E2E
color 0A
echo ============================================
echo   NewKet - Lancement de tous les tests E2E
echo ============================================
echo.
echo Demarrage de Playwright...
echo.
cd /d "%~dp0\..\.."
npx playwright test --reporter=list
echo.
echo ============================================
echo   Ouvrir le rapport HTML ? (optionnel)
echo ============================================
set /p OPEN_REPORT="Voir le rapport HTML ? (o/n) : "
if /i "%OPEN_REPORT%"=="o" (
    npx playwright show-report
)
echo.
pause
