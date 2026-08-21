@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo       VERIFICATION DES MIGRATIONS SUPABASE
echo ========================================================
echo.

:: Se deplacer à la racine du projet (NewKet) depuis scripts/bat
cd ..\..

set MIGRATIONS_DIR=supabase\migrations

if not exist "%MIGRATIONS_DIR%" (
    echo [ERREUR] Le dossier %MIGRATIONS_DIR% n'existe pas.
    goto :fin
)

echo [1] Comptage des fichiers de migration...
set count=0
for %%x in (%MIGRATIONS_DIR%\*.sql) do set /a count+=1
echo     - Vous avez %count% fichiers de migration dans le projet.
echo.

echo [2] Derniere migration creee (la plus recente)...
for /f "delims=" %%i in ('dir /b /a-d /o-d "%MIGRATIONS_DIR%\*.sql"') do (
    echo     - %%i
    goto :found_latest
)
:found_latest
echo.

echo [3] Verification de l'etat sur Git (Fichiers non pousses)...
git status --short %MIGRATIONS_DIR% > temp_git_status.txt

for /F "usebackq" %%A in ('temp_git_status.txt') do set size=%%~zA

if %size% EQU 0 (
    echo     - SUPER ! TOUTES vos migrations sont deja poussees sur GitHub.
    echo     - Aucun fichier en attente.
) else (
    echo     - ATTENTION ! Voici les migrations qui n'ont pas encore ete poussees :
    type temp_git_status.txt
    echo.
    set /p PUSH_NOW="Voulez-vous les ajouter et les pousser sur GitHub maintenant ? (O/N) : "
    if /i "!PUSH_NOW!"=="O" (
        echo.
        echo Ajout et Push en cours...
        git add %MIGRATIONS_DIR%
        git commit -m "chore(db): save new migrations"
        git push
        echo Termine !
    ) else (
        echo Push annule. N'oubliez pas de le faire plus tard !
    )
)

del temp_git_status.txt
echo.
echo ========================================================

:fin
pause
