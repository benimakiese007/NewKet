@echo off
setlocal

echo ========================================
echo      SUPABASE DB PUSH SCRIPT
echo ========================================
echo.
echo Ce script applique les migrations du dossier supabase/migrations
echo vers le projet Supabase lie a ce depot.
echo.
echo Attention : cette operation modifie la base de donnees distante.
echo Assure-toi d'avoir commit et pousse le code avant de continuer.
echo.
set /p confirm="Taper OUI pour continuer : "

if /I not "%confirm%"=="OUI" (
    echo.
    echo Annule.
    pause
    exit /b 1
)

set "ROOT_DIR=%~dp0..\.."
pushd "%ROOT_DIR%" >nul

if errorlevel 1 (
    echo.
    echo ========================================
    echo    IMPOSSIBLE D'ACCEDER A LA RACINE DU PROJET
    echo ========================================
    pause
    exit /b 1
)

if not exist "supabase\config.toml" (
    echo.
    echo ========================================
    echo    CONFIG SUPABASE INTROUVABLE
    echo ========================================
    echo Le script doit etre lance depuis le depot NewKet.
    popd
    pause
    exit /b 1
)

where npx >nul 2>&1
if errorlevel 1 (
    echo.
    echo ========================================
    echo    NPM / NPX INTROUVABLE
    echo ========================================
    echo Installe Node.js puis relance le script.
    popd
    pause
    exit /b 1
)

:: Authentification automatique (charge depuis _secrets.bat si present)
if exist "%~dp0_secrets.bat" (
    call "%~dp0_secrets.bat"
)

echo.

echo.
echo [2/2] Application des nouvelles migrations Supabase...
call npx supabase db push --include-all
set "EXIT_CODE=%ERRORLEVEL%"

popd

if not "%EXIT_CODE%"=="0" (
    echo.
    echo ========================================
    echo        ECHEC DU SUPABASE DB PUSH
    echo ========================================
    pause
    exit /b %EXIT_CODE%
)

echo.
echo ========================================
echo        SUPABASE DB PUSH TERMINE
echo ========================================
pause
