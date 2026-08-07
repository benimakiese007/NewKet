@echo off
title NewKet - Test Auth
color 0B
echo ================================
echo   Test : Authentification
echo ================================
echo.
cd /d "%~dp0\..\.."
npx playwright test tests/e2e/auth.spec.js --reporter=list
echo.
pause
