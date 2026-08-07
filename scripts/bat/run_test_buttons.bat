@echo off
echo ==============================================
echo Verification de tous les boutons du site
echo ==============================================
echo.
echo Lance le test sur toutes les pages (publiques + dashboard acheteur + vendeur)
echo Le rapport s'affichera dans le terminal et dans playwright-report\
echo.
cd /d "%~dp0\..\.."
call npx playwright test tests/e2e/buttons-check.spec.js --reporter=list
echo.
echo ==============================================
echo Verification terminee !
echo Pour voir le rapport visuel : npx playwright show-report
echo ==============================================
pause
