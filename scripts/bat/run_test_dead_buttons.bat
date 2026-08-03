@echo off
chcp 65001 >nul
title NewKet — Détection des Boutons Morts

echo.
echo ==============================================
echo  Détection des Boutons Morts
echo ==============================================
echo  Clique sur CHAQUE bouton du site et vérifie
echo  qu'il produit un effet (navigation, requête,
echo  modal, changement de DOM...)
echo.
echo  Pages testées :
echo    Accueil, Catalogue, Login, FAQ,
echo    Support, Boutiques, Promotions
echo.
echo  Rapport dans playwright-report\
echo ==============================================
echo.

cd /d "%~dp0"

call npx playwright test tests/e2e/dead-buttons.spec.js --reporter=list

echo.
echo ==============================================
echo  Test terminé.
echo  Les boutons morts sont marqués [MORT].
echo  Rapport complet : playwright-report\index.html
echo ==============================================
pause
