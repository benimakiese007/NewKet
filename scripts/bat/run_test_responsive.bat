@echo off
chcp 65001 >nul
title NewKet - Test Responsive

echo.
echo ==============================================
echo  Test Responsive - Mobile / Tablette / Desktop
echo ==============================================
echo  Taille testees :
echo    - Mobile  : 375 x 812  
echo    - Tablette: 768 x 1024 
echo    - Desktop : 1280 x 800 
echo.
echo  Pages testees :
echo    Accueil, Catalogue, Login, Boutiques, Promotions
echo.
echo  Le rapport s'affichera dans playwright-report\
echo ==============================================
echo.

cd /d "%~dp0\..\.."

call npx playwright test tests/e2e/responsive.spec.js --reporter=list

echo.
echo ==============================================
echo  Test termine. Rapport disponible dans :
echo  playwright-report\index.html
echo ==============================================
pause
