@echo off
chcp 65001 > nul
echo ========================================================
echo      LANCEMENT DE PLAYWRIGHT EN MODE INTERACTIF (UI)
echo ========================================================
echo.
cd ..\..
call npx playwright test --ui
pause
