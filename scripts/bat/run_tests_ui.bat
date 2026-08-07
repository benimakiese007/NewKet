@echo off
echo ==============================================
echo Lancement de Playwright en mode Interface Graphique (UI)
echo ==============================================
echo.
echo L'interface web de Playwright va s'ouvrir.
echo Tu pourras y executer, deboguer et voir tes tests en direct.
echo.
cd /d "%~dp0\..\.."
call npx playwright test --ui
