@echo off
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

echo.
echo [1/1] Application des migrations Supabase...
call npx supabase db push

if errorlevel 1 (
    echo.
    echo ========================================
    echo        ECHEC DU SUPABASE DB PUSH
    echo ========================================
    pause
    exit /b 1
)

echo.
echo ========================================
echo        SUPABASE DB PUSH TERMINE
echo ========================================
pause
