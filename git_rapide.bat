@echo off
:: Pour afficher correctement les accents
chcp 65001 >nul 
color 0A

echo ========================================================
echo       ASSISTANT GIT RAPIDE (Sauvegarde Facile)
echo ========================================================
echo.
echo Voici les fichiers qui ont change :
echo --------------------------------------------------------
git status -s
echo --------------------------------------------------------
echo.

set /p msg="1. Entrez un message pour decrire ce que vous venez de faire : "

:: Vérification si le message est vide
IF "%msg%"=="" (
    echo.
    color 0C
    echo ERREUR : Vous n'avez rien ecrit ! Annulation de la sauvegarde.
    pause
    exit /b
)

echo.
set /p branche="2. Sur quelle branche envoyer sur GitHub ? (Appuyez sur Entree pour envoyer sur la branche actuelle) : "

echo.
echo [1/3] Preparation des fichiers (git add .)...
git add .

echo.
echo [2/3] Creation de la sauvegarde en local (git commit)...
git commit -m "%msg%"

echo.
echo [3/3] Envoi vers GitHub (git push)...

IF "%branche%"=="" (
    :: Si l'utilisateur n'a rien tapé, on fait un push normal
    git push
) ELSE (
    :: Si l'utilisateur a tapé un nom de branche, on pousse le code actuel sur cette branche distante
    git push origin HEAD:%branche%
)

echo.
echo ========================================================
echo        SAUVEGARDE TERMINEE AVEC SUCCES !
echo ========================================================
pause
