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
echo 1. [VOIR] Qu'est-ce que j'ai modifie aujourd'hui ? (Status)
echo 2. [DEPART] Commencer une nouvelle tache (Creer une branche)
echo 3. [MAJ] Mettre a jour le projet (Tirer les nouveautes)
echo 4. [FIN] Sauvegarder et envoyer mon travail (Commit + Push)
echo 5. [PAUSE] Mettre mon brouillon de cote en securite (Stash)
echo 6. [REPRISE] Recuperer mon brouillon mis de cote (Stash Pop)
echo 7. [URGENCE] Tout annuler et forcer la mise a jour propre
echo 8. [AIDE] Comprendre chaque option avec des exemples
echo 9. Quitter
echo.
set /p choix="Choisis une option (1-9) : "

if "%choix%"=="1" goto STATUS
if "%choix%"=="2" goto BRANCH
if "%choix%"=="3" goto PULL
if "%choix%"=="4" goto PUSH
if "%choix%"=="5" goto STASH
if "%choix%"=="6" goto UNSTASH
if "%choix%"=="7" goto RESET
if "%choix%"=="8" goto HELP
if "%choix%"=="9" goto END

goto MENU

:STATUS
echo.
echo ==================================================
echo               ETAT DE TON TRAVAIL
echo ==================================================
echo.
git status
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
echo (S'il y a un conflit, ouvre VS Code pour le resoudre manuellement)
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

:STASH
echo.
echo ==================================================
echo               MISE DE COTE (STASH)
echo ==================================================
git stash
echo.
echo Ton brouillon a ete mis dans le "tiroir" secret de Git !
echo Ton code est redevenu propre. Tu peux maintenant changer 
echo de branche ou mettre a jour sans danger.
echo.
echo Appuyez sur une touche pour retourner au menu principal... 
pause >nul
goto MENU

:UNSTASH
echo.
echo ==================================================
echo            RECUPERATION DU BROUILLON
echo ==================================================
git stash pop
echo.
echo Ton brouillon a ete recupere du "tiroir" !
echo Tu peux reprendre ton travail la ou tu l'avais laisse.
echo.
echo Appuyez sur une touche pour retourner au menu principal... 
pause >nul
goto MENU

:RESET
echo.
echo ==================================================
echo                    ATTENTION !
echo ==================================================
echo Voici les fichiers qui vont etre SUPPRIMES OU ANNULES :
echo.
git status --short
echo.
echo Tu es sur le point de JETER DEFINITIVEMENT toutes ces
echo modifications que tu n'as pas encore sauvegardees.
echo Le code va redevenir exactement comme sur GitHub.
echo.
set /p confirm="Es-tu VRAIMENT sur de vouloir tout effacer ? (O/N) : "
if /i not "%confirm%"=="O" goto MENU

echo.
echo [1/3] Suppression des brouillons en cours...
git reset --hard
git clean -fd
echo [2/3] Retour sur la branche principale...
git checkout main
echo [3/3] Telechargement de la version propre...
git pull origin main
echo.
echo ==================================================
echo  OUF ! TON PROJET EST TOUT PROPRE ET A JOUR !
echo ==================================================
echo.
echo Appuyez sur une touche pour retourner au menu principal... 
pause >nul
goto MENU

:HELP
cls
echo ==================================================
echo               GUIDE D'UTILISATION
echo ==================================================
echo.
echo OPTION 1 : VOIR (Status)
echo Exemple : Il est 14h, tu reviens de pause, tu ne sais plus 
echo ce que tu as code ce matin. Utilise 1 pour voir les fichiers touches.
echo.
echo OPTION 2 : DEPART (Branch)
echo Exemple : On te demande de coder la page profil. Tu choisis 2, 
echo tu l'appelles "page-profil", et tu te retrouves dans un 
echo brouillon isole ou tu peux travailler en toute securite.
echo.
echo OPTION 3 : MAJ (Pull)
echo Exemple : Ton collegue vient de finir le bouton "Acheter". 
echo Pour l'avoir sur ton propre PC, tu choisis l'option 3.
echo.
echo OPTION 4 : FIN (Commit + Push)
echo Exemple : Tu as fini ta page profil. Tu choisis 4 pour l'envoyer
echo sur GitHub afin que les autres puissent la tester.
echo.
echo OPTION 5 : PAUSE (Stash)
echo Exemple : Tu es en plein milieu d'un code, le boss te demande 
echo de corriger un bug urgent ailleurs. Tu fais 5 pour cacher ton 
echo brouillon dans un tiroir sans l'effacer.
echo.
echo OPTION 6 : REPRISE (Stash Pop)
echo Exemple : Tu as fini le bug urgent. Tu reviens sur ta branche
echo et tu fais 6 pour ressortir ton brouillon de l'etape 5 !
echo.
echo OPTION 7 : URGENCE (Reset)
echo Exemple : Tu as fait n'importe quoi, ton code est casse, 
echo tu veux tout annuler et repartir de zero. Utilise le 7 !
echo.
echo ==================================================
echo Appuyez sur une touche pour retourner au menu principal... 
pause >nul
goto MENU

:END
exit
