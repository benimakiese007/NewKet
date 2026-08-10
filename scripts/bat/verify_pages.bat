@echo off
setlocal enabledelayedexpansion

echo =======================================================
echo Analyse des pages HTML dans frontend/src/pages
echo Comparaison avec frontend/vite.config.js...
echo =======================================================
echo.

:: %~dp0 correspond au dossier contenant ce script (scripts\bat\)
set "PROJECT_ROOT=%~dp0..\..\"
set "PAGES_DIR=%PROJECT_ROOT%frontend\src\pages"
set "CONFIG_FILE=%PROJECT_ROOT%frontend\vite.config.js"

if not exist "%PAGES_DIR%" (
    echo [ERREUR] Le dossier %PAGES_DIR% n'existe pas.
    pause
    exit /b
)

if not exist "%CONFIG_FILE%" (
    echo [ERREUR] Le fichier %CONFIG_FILE% n'existe pas.
    pause
    exit /b
)

:: Vérifier si le mode dynamique est activé
findstr /C:"getHtmlPages" "%CONFIG_FILE%" >nul
if not errorlevel 1 (
    echo [MODE AUTOMATIQUE DETECTE]
    echo Votre fichier vite.config.js est configure pour inclure 
    echo automatiquement toutes les pages HTML de src/pages/.
    echo.
    echo Liste des pages qui seront automatiquement compilees :
    echo -------------------------------------------------------
    
    set "TOTAL_COUNT=0"
    for /f "delims=" %%f in ('dir /s /b /a-d "%PAGES_DIR%\*.html"') do (
        set "filename=%%~nxf"
        echo [OK] !filename!
        set /a TOTAL_COUNT+=1
    )
    
    echo.
    echo =======================================================
    echo [SUCCES] !TOTAL_COUNT! pages HTML detectees. Elles seront toutes compilees !
    echo Vous n'avez plus besoin d'ajouter vos nouvelles pages manuellement.
    echo =======================================================
    pause
    exit /b
)

:: Ancien comportement pour la liste manuelle (au cas où on annule les modifs)
set "TOTAL_COUNT=0"
set "MISSING_COUNT=0"

echo Verification individuelle de chaque page :
echo -------------------------------------------------------

for /f "delims=" %%f in ('dir /s /b /a-d "%PAGES_DIR%\*.html"') do (
    set "filename=%%~nxf"
    set /a TOTAL_COUNT+=1
    
    findstr /C:"!filename!" "%CONFIG_FILE%" >nul
    if errorlevel 1 (
        echo [X] MANQUANTE : !filename!
        set /a MISSING_COUNT+=1
    ) else (
        echo [OK] PRESENTE : !filename!
    )
)

echo.
echo =======================================================
if !MISSING_COUNT! == 0 (
    echo [SUCCES] Les !TOTAL_COUNT! pages HTML ont ete verifiees et sont bien declarees dans vite.config.js !
) else (
    echo [ATTENTION] !MISSING_COUNT! pages sur !TOTAL_COUNT! semblent absentes de vite.config.js.
    echo Pensez a les ajouter dans rollupOptions.input
)
echo =======================================================
pause
