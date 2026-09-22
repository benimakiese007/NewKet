@echo off
color 0A
cd /d "%~dp0\..\.."

echo ========================================================
echo       ASSISTANT GIT RAPIDE (Sauvegarde Facile)
echo ========================================================
echo.
echo Voici les fichiers qui ont change :
echo --------------------------------------------------------
git status -s
echo --------------------------------------------------------
echo.

set /p msg="1. Entrez un message pour decrire.......(COMMIT) : "

REM Verification si le message est vide
IF "%msg%"=="" (
    echo.
    color 0C
    echo ERREUR : Vous n'avez rien ecrit ! Annulation de la sauvegarde.
    pause
    exit /b
)

echo.
set /p branche="2. Sur quelle branche envoyer sur GitHub ? (Appuyez sur Entree pour envoyer sur la branche actuelle) : "

REM Remplacer automatiquement les espaces par des tirets pour eviter les bugs Git
IF NOT "%branche%"=="" set branche=%branche: =-%

echo.
echo [1/3] Preparation des fichiers (git add -A)...
git add -A

echo.
echo [2/3] Creation de la sauvegarde en local (git commit)...
git commit -m "%msg%"

echo.
echo [3/3] Envoi vers GitHub (git push)...

set "branche_cible=%branche%"
IF "%branche_cible%"=="" (
    for /f "tokens=*" %%a in ('git rev-parse --abbrev-ref HEAD') do set branche_cible=%%a
)

IF /I NOT "%branche_cible%"=="main" goto DO_PUSH

echo.
color 0C
echo ================ ATTENTION ================
echo Vous etes sur le point d'envoyer sur la branche 'main'.
set /p confirm_main="Veuillez taper 'main' pour confirmer : "
IF /I NOT "%confirm_main%"=="main" (
    echo.
    echo ERREUR : Envoi annule. Confirmation incorrecte.
    pause
    color 0A
    exit /b
)
color 0A

:DO_PUSH
IF "%branche%"=="" (
    REM Si l'utilisateur n'a rien tape, on fait un push normal
    git push
) ELSE (
    REM Si l'utilisateur a tape un nom de branche, on pousse le code actuel sur cette branche distante
    git push origin HEAD:%branche%
)

echo.
echo [Supabase] Pour appliquer des migrations : utilisez le SQL Editor sur supabase.com
echo.
echo ========================================================
echo        SAUVEGARDE TERMINEE AVEC SUCCES !
echo ========================================================
pause
