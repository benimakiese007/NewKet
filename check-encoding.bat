@echo off
chcp 65001 >nul
title NewKet - Verificateur d'encodage

echo.
echo ============================================================
echo    NewKet ^| Audit d'encodage / Mojibake Checker
echo ============================================================
echo.

:: Verifier que Python est disponible
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERREUR] Python n'est pas installe ou pas dans le PATH.
    echo Installez Python depuis https://python.org
    echo.
    pause
    exit /b 1
)

:: Se placer a la racine du projet
cd /d "%~dp0"

echo Mode : AUDIT (lecture seule)
echo Racine : %CD%
echo.

if "%1"=="--fix" goto :do_fix
if "%1"=="-f" goto :do_fix
if "%1"=="fix" goto :do_fix

:: --- MODE AUDIT ---
python tools\encoding-check\mojibake_tool.py
set EXIT_CODE=%errorlevel%

echo.
if %EXIT_CODE%==0 (
    echo [OK] Aucun probleme d'encodage detecte. Le projet est propre.
) else (
    echo [ATTENTION] Des erreurs d'encodage ont ete trouvees ^(voir ci-dessus^).
    echo.
    echo Pour tout corriger automatiquement, lancez :
    echo    check-encoding.bat --fix
    echo    ou : npm run fix:encoding
)

echo.
echo Appuyez sur une touche pour fermer...
pause >nul
exit /b %EXIT_CODE%

:: --- MODE FIX ---
:do_fix
echo Mode : CORRECTION AUTOMATIQUE
echo.
echo ATTENTION : Cette operation va modifier vos fichiers sources.
echo Assurez-vous d'avoir commite vos changements avant de continuer.
echo.
set /p CONFIRM="Continuer ? (O/N) : "
if /i not "%CONFIRM%"=="O" (
    echo Operation annulee.
    pause >nul
    exit /b 0
)

echo.
echo Correction en cours...
echo.
python tools\encoding-check\mojibake_tool.py --fix
set EXIT_CODE=%errorlevel%

echo.
if %EXIT_CODE%==0 (
    echo [SUCCES] Tous les fichiers ont ete corriges et re-encodes en UTF-8.
    echo.
    echo N'oubliez pas de commiter les changements :
    echo    git add -A
    echo    git commit -m "fix(encoding): restaurer l'encodage UTF-8 sur tout le projet"
) else (
    echo [PARTIEL] Certains fichiers n'ont pas pu etre corriges.
)

echo.
echo Appuyez sur une touche pour fermer...
pause >nul
exit /b %EXIT_CODE%
