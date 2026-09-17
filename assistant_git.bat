@echo off
chcp 65001 >nul
title Assistant Git - NewKet
color 0B

:MENU
cls
echo ==================================================
echo         ASSISTANT GIT POUR L'EQUIPE NEWKET
echo ==================================================
echo.
echo 1. Mettre a jour le projet (Recuperer le travail des autres)
echo 2. Commencer une nouvelle tache (Creer une branche)
echo 3. Sauvegarder et envoyer mon travail (Commit + Push)
echo 4. Quitter
echo.
set /p choix="Choisis une option (1-4) : "

if "%choix%"=="1" goto PULL
if "%choix%"=="2" goto BRANCH
if "%choix%"=="3" goto PUSH
if "%choix%"=="4" goto END

goto MENU

:PULL
echo.
echo [1/2] Retour sur la branche principale...
git checkout main
echo [2/2] Telechargement des dernieres modifications...
git pull origin main
echo.
echo ==================================================
echo  SUPER ! LE PROJET EST A JOUR !
echo ==================================================
echo. 
 echo Appuyez sur une touche pour retourner au menu principal... 
 pause >nul
goto MENU

:BRANCH
echo.
echo Exemples de noms : ajout-panier, correction-header, page-contact
set /p nom_branche="Comment veux-tu appeler cette tache ? (sans espaces) : "
echo.
echo 1. Nouvelle fonctionnalite (feat)
echo 2. Correction de bug (fix)
set /p type_branche="Quel est le type de tache (1 ou 2) ? "

if "%type_branche%"=="2" (
    git checkout -b fix/%nom_branche%
) else (
    git checkout -b feat/%nom_branche%
)
echo.
echo ==================================================
echo  C'EST PARTI ! TU PEUX COMMENCER A CODER !
echo ==================================================
echo. 
 echo Appuyez sur une touche pour retourner au menu principal... 
 pause >nul
goto MENU

:PUSH
echo.
set /p message_commit="Decris ce que tu viens de faire (ex: j'ai ajoute le bouton valider) : "
echo.
echo [1/3] Preparation des fichiers...
git add .
echo [2/3] Sauvegarde (Commit)...
git commit -m "%message_commit%"
echo [3/3] Envoi sur GitHub (Push)...

REM Recuperation du nom de la branche actuelle
for /f "tokens=*" %%a in ('git rev-parse --abbrev-ref HEAD') do set branche_actuelle=%%a
git push origin %branche_actuelle%

echo.
echo ==================================================
echo  TRAVAIL ENVOYE ! 
echo  N'oublie pas d'aller sur GitHub pour creer ta Pull Request.
echo ==================================================
echo. 
 echo Appuyez sur une touche pour retourner au menu principal... 
 pause >nul
goto MENU

:END
exit
