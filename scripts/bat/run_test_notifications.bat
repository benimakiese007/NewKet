@echo off
chcp 65001 >nul
title NewKet - Test Notifications

echo.
echo ==============================================
echo  Test Notifications
echo ==============================================
echo  Verifie que la page notifications fonctionne :
echo    - Structure de la page sans connexion
echo    - Filtres : Tous / Non lus / Alertes
echo    - Bouton Tout marquer comme lu
echo    - Bouton Tout effacer
echo    - Badge de notification dans le header
echo    - Compteur de non-lus
echo.
echo  Compte de test utilise :
echo    benimakiese1234567@gmail.com
echo.
echo  Le rapport s'affichera dans playwright-report\
echo ==============================================
echo.

cd /d "%~dp0\..\.."

cd /d "%~dp0\..\.."
call npx playwright test tests/e2e/notifications.spec.js --reporter=list

echo.
echo ==============================================
echo  Test termine. Rapport disponible dans :
echo  playwright-report\index.html
echo ==============================================
pause
