@echo off
chcp 65001 >nul
title NewKet - Detection des Boutons Morts

echo.
echo ==============================================
echo  Detection des Boutons Morts
echo ==============================================
echo  Clique sur CHAQUE bouton du site et verifie
echo  qu'il produit un effet :
echo    - Navigation vers une autre page
echo    - Requete reseau envoyee
echo    - Modal ou dialogue apparu
echo    - Changement visible dans le DOM
echo.
echo  Pages testees :
echo    Accueil, Catalogue, Login, FAQ,
echo    Support, Boutiques, Promotions
echo.
echo  Rapport dans playwright-report\
echo ==============================================
echo.

cd /d "%~dp0\..\.."

cd /d "%~dp0\..\.."
call npx playwright test tests/e2e/dead-buttons.spec.js --reporter=list

echo.
echo ==============================================
echo  Test termine.
echo  Les boutons morts sont marques MORT.
echo  Rapport complet : playwright-report\index.html
echo ==============================================
pause
