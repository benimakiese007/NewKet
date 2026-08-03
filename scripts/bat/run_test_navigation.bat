@echo off
chcp 65001 >nul
title NewKet - Test Navigation

echo.
echo ==============================================
echo  Test Navigation - Liens, menus, pages 404
echo ==============================================
echo  Verifie que tous les liens du site fonctionnent
echo  et qu'aucune page retourne une erreur 404.
echo.
echo  Le rapport s'affichera dans le terminal
echo  et dans playwright-report\
echo ==============================================
echo.

cd /d "%~dp0\..\.."

call npx playwright test tests/e2e/navigation.spec.js --reporter=list

echo.
echo ==============================================
echo  Test termine. Rapport disponible dans :
echo  playwright-report\index.html
echo ==============================================
pause
