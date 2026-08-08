@echo off
title NewKet - Test des boutons et redirections

echo.
echo ================================================
echo   NewKet - Verificateur de boutons
echo ================================================
echo.

:: Aller dans le dossier tests (qui se trouve a la racine du projet)
cd /d "%~dp0"
cd ..\..\tests

:: Verifier si Node.js est installe
node --version > nul 2>&1
if %errorlevel% neq 0 (
    echo [ERREUR] Node.js n'est pas installe !
    echo Telechargez-le sur https://nodejs.org
    pause
    exit /b 1
)

:: Installer Playwright si pas encore fait
if not exist "node_modules\playwright" (
    echo [INFO] Installation de Playwright...
    call npm install playwright --save-dev
    if %errorlevel% neq 0 (
        echo [ERREUR] Impossible d'installer Playwright.
        pause
        exit /b 1
    )
    :: Installer les navigateurs Playwright
    call npx playwright install chromium
)

:: Verifier que le serveur Vite tourne sur localhost:5173
echo [INFO] Verification du serveur local (localhost:5173)...
curl -s -o "%TEMP%\nk_check_body.txt" -w "%%{http_code}" http://localhost:5173 > "%TEMP%\nk_check.txt" 2>nul
set /p HTTP_CODE=<"%TEMP%\nk_check.txt"
del "%TEMP%\nk_check.txt" > nul 2>&1
del "%TEMP%\nk_check_body.txt" > nul 2>&1

if "%HTTP_CODE%"=="000" (
    echo.
    echo [ATTENTION] Le serveur local n'est pas lance !
    echo.
    echo Veuillez d'abord demarrer le serveur avec :
    echo   - Double-clic sur DEMARRER-SERVEUR.bat
    echo   - OU ouvrir un terminal et taper : npm run dev
    echo.
    set /p CONT=Appuyez sur Entree pour quitter ou tapez O pour continuer quand meme : 
    if /i not "%CONT%"=="O" exit /b 0
)

echo.
echo [INFO] Lancement des tests...
echo.

:: Lancer le test
node check-buttons.js

if %errorlevel% neq 0 (
    echo.
    echo [ERREUR] Le test a rencontre un probleme.
    echo Verifiez que le serveur est bien lance sur localhost:5173
    pause
    exit /b 1
)

echo.
echo [OK] Test termine ! Ouverture du rapport...
echo.
:: Ouvrir le rapport dans le navigateur
start "" "%~dp0..\..\tests\reports\rapport-boutons.html"
echo.
pause
