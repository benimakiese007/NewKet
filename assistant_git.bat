@echo off
chcp 65001 >nul
title Assistant Git - NewKet
color 0B

:LOGIN
cls
echo ==================================================
echo        ASSISTANT GIT  -  ACCES SECURISE
echo ==================================================
echo.
echo   Veuillez saisir le mot de passe pour continuer.
echo.

REM Saisie masquee du mot de passe via PowerShell
for /f "usebackq delims=" %%P in (`powershell -Command "$p = Read-Host -AsSecureString 'Mot de passe'; [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($p))"`) do set "mdp=%%P"

if "%mdp%"=="PHOENIX" goto MENU

cls
echo ==================================================
echo           MOT DE PASSE INCORRECT
echo ==================================================
echo.
echo   Acces refuse. Fermeture automatique dans 3 secondes...
echo.
timeout /t 3 /nobreak >nul
exit

:MENU
cls
echo ==================================================
echo        ASSISTANT GIT  -  EQUIPE NEWKET
echo ==================================================
for /f "tokens=*" %%a in ('git rev-parse --abbrev-ref HEAD') do set menu_branche=%%a
echo.
echo   Tu es actuellement sur la branche :
echo.
echo              [ %menu_branche% ]
echo.
echo ==================================================
echo.
echo   --- Travail quotidien ----------------------------
echo.
echo    1. [VOIR]            Voir mes modifications           (git status)
echo.
echo    2. [DEPART]          Commencer une nouvelle tache     (git checkout -b)
echo.
echo    3. [MAJ]             Mettre le projet a jour          (git pull)
echo.
echo    4. [FIN]             Sauvegarder et envoyer           (git add, commit, push)
echo.
echo    5. [PARTIEL]         Choisir les fichiers a envoyer   (git add selectif)
echo.
echo    6. [PUSH]            Envoyer vos commits locaux       (git push)
echo.
echo    7. [PAUSE]           Mettre mon travail en attente    (git stash)
echo.
echo    8. [REPRISE]         Recuperer mon travail en attente (git stash pop)
echo.
echo    9. [URGENCE]         Tout annuler, repartir de zero   (git reset --hard)
echo.
echo   --- Erreurs et Corrections -----------------------
echo.
echo   10. [MODIFIER MSG]    Corriger le dernier message      (git commit --amend)
echo.
echo   11. [ANNULER COMMIT]  Annuler le dernier commit        (git reset --soft HEAD~1)
echo.
echo   --- Exploration ----------------------------------
echo.
echo   12. [HISTORIQUE]      Voir les derniers commits        (git log)
echo.
echo   13. [BRANCHES]        Voir et changer de branche       (git branch + checkout)
echo.
echo   14. [DIFFERENCES]     Voir ce qui a change en detail   (git diff)
echo.
echo   15. [QUI A MODIFIE]   Voir qui a touche chaque ligne   (git blame)
echo.
echo   16. [RECHERCHER]      Trouver un commit par mot-cle    (git log --grep)
echo.
echo   17. [MON PROFIL]      Voir mon compte Git actuel       (git config)
echo.
echo   --- Gestion avancee ------------------------------
echo.
echo   18. [FUSIONNER]       Fusionner une branche dans main  (git merge)
echo.
echo   19. [SUPPR. BRANCHE]  Supprimer une branche (local + GitHub)
echo.
echo   20. [RETOUR RAPIDE]   Revenir a l'ancienne version     (git checkout --)
echo.
echo   21. [VERSION]         Marquer une version stable       (git tag)
echo.
echo   22. [CONFLITS]        Outil de resolution de conflits  (git mergetool)
echo.
echo   --- Equipe NewKet --------------------------------
echo.
echo   23. [EQUIPE]          Contributions de chaque membre   (git shortlog)
echo.
echo   24. [MES BRANCHES]    Branches locales et sur GitHub   (git branch -vv)
echo.
echo   25. [RETOUR BRANCHE]  Revenir a la branche precedente  (git checkout -)
echo.
echo   --------------------------------------------------
echo.
echo   26. [AIDE]            Comprendre chaque option
echo.
echo    0. Quitter
echo.
set /p choix="   Choix (0-26) : "

if "%choix%"=="1"  goto STATUS
if "%choix%"=="2"  goto BRANCH
if "%choix%"=="3"  goto PULL
if "%choix%"=="4"  goto PUSH
if "%choix%"=="5"  goto PARTIEL
if "%choix%"=="6"  goto PUSH_SEUL
if "%choix%"=="7"  goto STASH
if "%choix%"=="8"  goto UNSTASH
if "%choix%"=="9"  goto RESET
if "%choix%"=="10" goto AMEND
if "%choix%"=="11" goto UNDO_COMMIT
if "%choix%"=="12" goto HISTORIQUE
if "%choix%"=="13" goto BRANCHES
if "%choix%"=="14" goto DIFFERENCES
if "%choix%"=="15" goto BLAME
if "%choix%"=="16" goto RECHERCHE
if "%choix%"=="17" goto PROFIL
if "%choix%"=="18" goto FUSIONNER
if "%choix%"=="19" goto SUPPRBRANCH
if "%choix%"=="20" goto RETOURRAPIDE
if "%choix%"=="21" goto VERSION
if "%choix%"=="22" goto CONFLITS
if "%choix%"=="23" goto EQUIPE
if "%choix%"=="24" goto MES_BRANCHES
if "%choix%"=="25" goto RETOUR_BRANCHE
if "%choix%"=="26" goto HELP
if "%choix%"=="0"  goto END

goto MENU

:STATUS
cls
echo ==================================================
echo            ETAT ACTUEL DE TON PROJET
echo ==================================================
echo.
git status
echo.
echo --------------------------------------------------
echo   Appuyez sur une touche pour revenir au menu...
pause >nul
goto MENU

:BRANCH
cls
echo ==================================================
echo           CREATION D'UNE NOUVELLE TACHE
echo ==================================================
echo.
echo   Exemples de noms : ajout-panier, correction-header, page-contact
echo.
set /p nom_branche="   Nom de la tache (sans espaces) : "
echo.
echo   1. Nouvelle fonctionnalite
echo   2. Correction de bug
echo.
set /p type_branche="   Type de tache (1 ou 2) : "

if "%type_branche%"=="2" (
    git checkout -b fix/%nom_branche%
) else (
    git checkout -b feat/%nom_branche%
)
echo.
echo ==================================================
echo   C'est parti ! Tu peux commencer a coder.
echo ==================================================
echo.
echo --------------------------------------------------
echo   Appuyez sur une touche pour revenir au menu...
pause >nul
goto MENU

:PULL
cls
echo ==================================================
echo           MISE A JOUR DU PROJET
echo ==================================================
echo.
for /f "tokens=*" %%a in ('git rev-parse --abbrev-ref HEAD') do set branche_courante=%%a
echo   Branche actuelle : %branche_courante%
echo.
echo   [1/2] Recuperation des derniers changements de main...
git fetch origin main
echo.
echo ==================================================
echo   main est a jour en local !
echo ==================================================
echo.
set /p integrer="   Veux-tu integrer ces changements dans ta branche '%branche_courante%' ? (O/N) : "
if /i "%integrer%"=="O" (
    echo.
    echo   [2/2] Integration de main dans ta branche...
    git merge origin/main
    echo.
    echo ==================================================
    echo   Ta branche est maintenant a jour avec main !
    echo   Si des conflits apparaissent, utilise l'option 22.
    echo ==================================================
) else (
    echo.
    echo ==================================================
    echo   D'accord ! Tu restes sur %branche_courante% sans changement.
    echo   Tu pourras integrer main plus tard quand tu seras pret.
    echo ==================================================
)
echo.
echo --------------------------------------------------
echo   Appuyez sur une touche pour revenir au menu...
pause >nul
goto MENU

:PUSH
cls
echo ==================================================
echo          SAUVEGARDE ET ENVOI DU TRAVAIL
echo ==================================================
echo.
echo   Fichiers qui seront envoyes :
echo   --------------------------------------------------
git status --short
echo   --------------------------------------------------
echo.
git diff --stat
echo.
set /p message_commit="   Decris brievement ce que tu viens de faire : "
echo.
echo   [1/3] Preparation des fichiers...
git add .
echo   [2/3] Sauvegarde locale (commit)...
git commit -m "%message_commit%"
echo   [3/3] Envoi vers GitHub (push)...

REM Recuperation automatique du nom de la branche courante
for /f "tokens=*" %%a in ('git rev-parse --abbrev-ref HEAD') do set branche_actuelle=%%a

if /i not "%branche_actuelle%"=="main" goto DO_PUSH

for /F %%a in ('echo prompt $E ^| cmd') do set "ESC=%%a"

echo.
echo   %ESC%[91m================ ATTENTION ================%ESC%[0m
echo   %ESC%[91mVous etes sur le point d'envoyer sur la branche 'main'.%ESC%[0m
set /p confirm_main="   Veuillez taper 'main' pour confirmer : "
if /i not "%confirm_main%"=="main" (
    echo.
    echo   Envoi annule.
    echo --------------------------------------------------
    echo   Appuyez sur une touche pour revenir au menu...
    pause >nul
    goto MENU
)

:DO_PUSH
git push origin %branche_actuelle%
call :PR_CHECK
echo.
echo --------------------------------------------------
echo   Appuyez sur une touche pour revenir au menu...
pause >nul
goto MENU

REM ============================================================
REM  OPTION 5 - COMMIT PARTIEL : choisir les fichiers par numero
REM ============================================================
:PARTIEL
cls
setlocal enabledelayedexpansion
echo ==================================================
echo      COMMIT PARTIEL - CHOISIR LES FICHIERS
echo ==================================================
echo.
echo   Fichiers modifies detectes :
echo.

REM Ecriture dans un fichier temporaire pour eviter les bugs de buffer
set "tmpfile=%temp%\newket_git_status.tmp"
git status --porcelain > "%tmpfile%"

set compteur=0
for /f "usebackq tokens=* delims=" %%F in ("%tmpfile%") do (
    set /a compteur+=1
    set "ligne=%%F"
    set "fichier!compteur!=!ligne:~3!"
    echo   [!compteur!] !ligne:~3!
)
del "%tmpfile%" >nul 2>&1

echo.
if !compteur!==0 (
    echo   Aucun fichier modifie. Rien a commiter.
    echo.
    echo --------------------------------------------------
    echo   Appuyez sur une touche pour revenir au menu...
    pause >nul
    endlocal
    goto MENU
)

echo   --------------------------------------------------
echo   Tape les numeros separes par des espaces (ex: 1 3)
echo   ou tape TOUT pour ajouter tous les fichiers.
echo.
set /p selection="   Votre selection : "
echo.

if /i "!selection!"=="TOUT" (
    echo   + Ajout de tous les fichiers...
    git add .
    goto PARTIEL_COMMIT
)

REM Ajouter uniquement les fichiers selectionnes
for %%N in (!selection!) do (
    if defined fichier%%N (
        echo   + Ajout de : !fichier%%N!
        git add "!fichier%%N!"
    ) else (
        echo   [IGNORE] Le numero %%N n'existe pas dans la liste.
    )
)

:PARTIEL_COMMIT
echo.
set /p message_commit="   Message de commit : "
echo.
echo   [2/3] Sauvegarde locale (commit)...
git commit -m "!message_commit!"
echo   [3/3] Envoi vers GitHub (push)...

for /f "tokens=*" %%a in ('git rev-parse --abbrev-ref HEAD') do set branche_actuelle=%%a

if /i not "!branche_actuelle!"=="main" goto DO_PUSH_PARTIEL

for /F %%a in ('echo prompt $E ^| cmd') do set "ESC=%%a"
echo.
echo   !ESC![91m================ ATTENTION ================ !ESC![0m
echo   !ESC![91mVous etes sur le point d'envoyer sur 'main'.!ESC![0m
set /p confirm_main="   Veuillez taper 'main' pour confirmer : "
if /i not "!confirm_main!"=="main" (
    echo.
    echo   Envoi annule.
    echo --------------------------------------------------
    echo   Appuyez sur une touche pour revenir au menu...
    pause >nul
    endlocal
    goto MENU
)

:DO_PUSH_PARTIEL
git push origin !branche_actuelle!
call :PR_CHECK
echo.
echo --------------------------------------------------
echo   Appuyez sur une touche pour revenir au menu...
pause >nul
endlocal
goto MENU

:STASH
cls
echo ==================================================
echo            MISE EN ATTENTE DU TRAVAIL
echo ==================================================
echo.
git stash
echo.
echo   Ton travail a ete mis de cote temporairement.
echo   Le projet est redevenu propre. Tu peux changer
echo   de branche ou effectuer une mise a jour sans risque.
echo.
echo --------------------------------------------------
echo   Appuyez sur une touche pour revenir au menu...
pause >nul
goto MENU

:UNSTASH
cls
echo ==================================================
echo          RECUPERATION DU TRAVAIL EN ATTENTE
echo ==================================================
echo.
git stash pop
echo.
echo   Ton travail a ete restaure avec succes.
echo   Tu peux reprendre exactement ou tu t'etais arrete.
echo.
echo --------------------------------------------------
echo   Appuyez sur une touche pour revenir au menu...
pause >nul
goto MENU

:RESET
cls
echo ==================================================
echo                   ATTENTION
echo ==================================================
echo.
echo   Voici les fichiers qui seront annules ou supprimes :
echo.
git status --short
echo.
echo   Tu es sur le point d'effacer definitivement toutes
echo   les modifications non sauvegardees. Le projet sera
echo   ramene a l'etat exact de la derniere version GitHub.
echo.
set /p confirm="   Confirmer la suppression ? (O pour oui, N pour annuler) : "
if /i not "%confirm%"=="O" goto MENU

echo.
echo   [1/3] Suppression des modifications en cours...
git reset --hard
git clean -fd
echo   [2/3] Retour sur la branche principale...
git checkout main
echo   [3/3] Telechargement de la version propre...
git pull origin main
echo.
echo ==================================================
echo   Le projet est propre et a jour.
echo ==================================================
echo.
echo --------------------------------------------------
echo   Appuyez sur une touche pour revenir au menu...
pause >nul
goto MENU

:AMEND
cls
echo ==================================================
echo         CORRIGER LE DERNIER MESSAGE
echo ==================================================
echo.
set /p nouveau_msg="   Nouveau message de commit : "
echo.
git commit --amend -m "%nouveau_msg%"
echo.
echo ==================================================
echo   Message mis a jour avec succes !
echo   (N'oublie pas de refaire un push si necessaire)
echo ==================================================
echo.
echo --------------------------------------------------
echo   Appuyez sur une touche pour revenir au menu...
pause >nul
goto MENU

:UNDO_COMMIT
cls
echo ==================================================
echo         ANNULER LE DERNIER COMMIT
echo ==================================================
echo.
echo   Cette action annule ton dernier "Sauvegarder (commit)".
echo   Tes fichiers et ton code resteront INTACTS !
echo.
set /p confirm_undo="   Es-tu sur de vouloir annuler le dernier commit ? (O/N) : "
if /i not "%confirm_undo%"=="O" goto MENU
echo.
git reset --soft HEAD~1
echo.
echo ==================================================
echo   Dernier commit annule !
echo   Tes fichiers sont prets a etre modifies ou ajoutes.
echo ==================================================
echo.
echo --------------------------------------------------
echo   Appuyez sur une touche pour revenir au menu...
pause >nul
goto MENU

:HISTORIQUE
cls
echo ==================================================
echo           HISTORIQUE DES DERNIERS COMMITS
echo ==================================================
echo.
git log --oneline --graph --decorate -20
echo.
echo   Les 20 derniers commits sont affiches ci-dessus.
echo   Chaque ligne = une sauvegarde effectuee par l'equipe.
echo.
echo --------------------------------------------------
echo   Appuyez sur une touche pour revenir au menu...
pause >nul
goto MENU

:BRANCHES
cls
echo ==================================================
echo         GESTION DES BRANCHES DU PROJET
echo ==================================================
echo.
echo   Branches disponibles (* = branche actuelle) :
echo.
git branch -a
echo.
echo --------------------------------------------------
set /p changer="   Veux-tu changer de branche ? (O pour oui, N pour rester) : "
if /i not "%changer%"=="O" goto MENU

echo.
set /p cible="   Nom de la branche sur laquelle aller : "
git checkout %cible%
echo.
echo ==================================================
echo   Tu es maintenant sur la branche : %cible%
echo ==================================================
echo.
echo --------------------------------------------------
echo   Appuyez sur une touche pour revenir au menu...
pause >nul
goto MENU

:DIFFERENCES
cls
echo ==================================================
echo       DIFFERENCES DEPUIS LE DERNIER COMMIT
echo ==================================================
echo.
echo   Voici les modifications en cours dans tes fichiers :
echo.
git diff --stat
echo.
set /p fichier_diff="   Nom du fichier pour le detail (laisser vide = tout afficher) : "
if "%fichier_diff%"=="" (
    git diff
) else (
    git diff %fichier_diff%
)
echo.
echo --------------------------------------------------
echo   Appuyez sur une touche pour revenir au menu...
pause >nul
goto MENU

:BLAME
cls
echo ==================================================
echo       QUI A MODIFIE CE FICHIER ?
echo ==================================================
echo.
set /p fichier_blame="   Nom du fichier a analyser : "
echo.
git blame %fichier_blame%
echo.
echo   Chaque ligne affiche : l'auteur, la date et le contenu.
echo.
echo --------------------------------------------------
echo   Appuyez sur une touche pour revenir au menu...
pause >nul
goto MENU

:RECHERCHE
cls
echo ==================================================
echo         RECHERCHER UN COMMIT PAR MOT-CLE
echo ==================================================
echo.
set /p mot_cle="   Entrez le mot a rechercher (ex: panier, bug, design) : "
echo.
echo   Resultats pour "%mot_cle%" :
echo.
git log --all --grep="%mot_cle%" --oneline
echo.
echo --------------------------------------------------
echo   Appuyez sur une touche pour revenir au menu...
pause >nul
goto MENU

:PROFIL
cls
echo ==================================================
echo              MON PROFIL GIT ACTUEL
echo ==================================================
echo.
echo   Nom actuel   : 
git config user.name
echo   Email actuel : 
git config user.email
echo.
set /p modif_profil="   Veux-tu modifier ces informations ? (O/N) : "
if /i not "%modif_profil%"=="O" goto MENU
echo.
set /p nouveau_nom="   Nouveau nom/pseudo (sans guillemets) : "
set /p nouvel_email="   Nouvelle adresse email : "
git config --global user.name "%nouveau_nom%"
git config --global user.email "%nouvel_email%"
echo.
echo ==================================================
echo   Profil mis a jour avec succes !
echo ==================================================
echo.
echo --------------------------------------------------
echo   Appuyez sur une touche pour revenir au menu...
pause >nul
goto MENU

:FUSIONNER
cls
echo ==================================================
echo         FUSIONNER UNE BRANCHE DANS MAIN
echo ==================================================
echo.
echo   Branches disponibles :
echo.
git branch -a
echo.
set /p branche_fusion="   Nom de la branche a fusionner dans main : "
echo.
echo   [1/2] Retour sur la branche principale...
git checkout main
echo   [2/2] Fusion de la branche %branche_fusion%...
git merge %branche_fusion%
echo.
echo ==================================================
echo   Fusion terminee !
echo   Verifie qu'il n'y a pas de conflits avant de continuer.
echo ==================================================
echo.
echo --------------------------------------------------
echo   Appuyez sur une touche pour revenir au menu...
pause >nul
goto MENU

:SUPPRBRANCH
cls
echo ==================================================
echo         SUPPRESSION D'UNE BRANCHE TERMINEE
echo ==================================================
echo.
echo   Branches locales disponibles :
echo.
git branch
echo.
set /p branche_suppr="   Nom de la branche a supprimer : "
echo.
set /p confirm_suppr="   Confirmer la suppression de '%branche_suppr%' ? (O/N) : "
if /i not "%confirm_suppr%"=="O" goto MENU

git branch -d %branche_suppr%
echo.
set /p suppr_remote="   Supprimer aussi cette branche sur GitHub ? (O/N) : "
if /i "%suppr_remote%"=="O" (
    git push origin --delete %branche_suppr%
    echo.
    echo ==================================================
    echo   Branche '%branche_suppr%' supprimee
    echo   localement ET sur GitHub. Propre !
    echo ==================================================
) else (
    echo.
    echo ==================================================
    echo   Branche '%branche_suppr%' supprimee localement.
    echo   Elle existe encore sur GitHub.
    echo ==================================================
)
echo.
echo --------------------------------------------------
echo   Appuyez sur une touche pour revenir au menu...
pause >nul
goto MENU

:RETOURRAPIDE
cls
echo ==================================================
echo       RETOUR A LA VERSION PRECEDENTE D'UN FICHIER
echo ==================================================
echo.
echo   Cette action annule toutes les modifications non
echo   sauvegardees sur le fichier choisi.
echo.
set /p fichier_retour="   Nom du fichier a restaurer : "
echo.
set /p confirm_retour="   Confirmer la restauration de '%fichier_retour%' ? (O/N) : "
if /i not "%confirm_retour%"=="O" goto MENU

git checkout -- %fichier_retour%
echo.
echo ==================================================
echo   Le fichier '%fichier_retour%' a ete restaure.
echo ==================================================
echo.
echo --------------------------------------------------
echo   Appuyez sur une touche pour revenir au menu...
pause >nul
goto MENU

:VERSION
cls
echo ==================================================
echo         CREATION D'UNE VERSION STABLE (TAG)
echo ==================================================
echo.
echo   Exemple de nom : v1.0, v2.1, v1.0-beta
echo.
set /p nom_tag="   Nom de la version : "
set /p msg_tag="   Description de cette version : "
echo.
git tag -a %nom_tag% -m "%msg_tag%"
git push origin %nom_tag%
echo.
echo ==================================================
echo   Version '%nom_tag%' creee et envoyee sur GitHub !
echo ==================================================
echo.
echo --------------------------------------------------
echo   Appuyez sur une touche pour revenir au menu...
pause >nul
goto MENU

:CONFLITS
cls
echo ==================================================
echo       RESOLUTION DE CONFLITS
echo ==================================================
echo.
echo   1. Voici les fichiers qui sont en conflit actuellement :
echo.
git diff --name-only --diff-filter=U
echo.
echo   2. Ouvre ton editeur (Antigravity, Cursor, VS Code...)
echo   3. Cherche les balises de conflit (qui commencent par ^<^<^<^<^<^<^<)
echo   4. Choisis le code a garder, efface les balises, et sauvegarde.
echo.
echo ==================================================
echo   Une fois que tu as TOUT corrige dans ton editeur...
echo   Utilise l'Option 4 [FIN] du menu pour valider ta fusion !
echo ==================================================
echo.
echo --------------------------------------------------
echo   Appuyez sur une touche pour revenir au menu...
pause >nul
goto MENU

:HELP
cls
echo ==================================================
echo              GUIDE D'UTILISATION
echo ==================================================
echo.
echo   --- TRAVAIL QUOTIDIEN ---
echo    1  - VOIR          : Consulter les fichiers modifies.
echo    2  - DEPART        : Creer une branche pour commencer.
echo    3  - MAJ           : Recuperer le code de l'equipe.
echo    4  - FIN           : Sauvegarder et envoyer (add+commit+push).
echo    5  - PARTIEL       : Choisir fichier(s) par numero a commiter.
echo    6  - PUSH          : Envoyer vos commits locaux vers le serveur.
echo    7  - PAUSE         : Mettre son travail de cote.
echo    8  - REPRISE       : Restaurer le travail mis en attente.
echo    9  - URGENCE       : Tout annuler et revenir a la version propre.
echo.
echo   --- ERREURS ET CORRECTIONS ---
echo   10  - MODIFIER MSG  : Corriger une faute dans le nom du commit.
echo   11  - ANNULER COMMIT: Annuler la sauvegarde (mais garder le code).
echo.
echo   --- EXPLORATION ---
echo   12  - HISTORIQUE    : Voir les 20 derniers commits de l'equipe.
echo   13  - BRANCHES      : Lister et changer de branche.
echo   14  - DIFFERENCES   : Voir les modifications ligne par ligne.
echo   15  - QUI A MODIFIE : Trouver l'auteur de chaque ligne d'un fichier.
echo   16  - RECHERCHER    : Retrouver un ancien commit contenant un mot-cle.
echo   17  - MON PROFIL    : Verifier/Modifier son identifiant Git.
echo.
echo   --- GESTION AVANCEE ---
echo   18  - FUSIONNER     : Integrer une branche dans main.
echo   19  - SUPPR. BRANCHE: Supprimer localement ET sur GitHub.
echo   20  - RETOUR RAPIDE : Annuler les modifications d'un fichier.
echo   21  - VERSION       : Marquer une version stable (v1.0).
echo   22  - CONFLITS      : Ouvrir l'editeur pour resoudre un conflit.
echo.
echo   --- EQUIPE NEWKET ---
echo   23  - EQUIPE        : Voir les contributions de chaque membre.
echo   24  - MES BRANCHES  : Branches locales vs envoyees sur GitHub.
echo   25  - RETOUR BRANCHE: Revenir instantanement a la branche precedente.
echo.
echo ==================================================
echo.
echo --------------------------------------------------
echo   Appuyez sur une touche pour revenir au menu...
pause >nul
goto MENU

:PUSH_SEUL
cls
echo ==================================================
echo          ENVOI DES COMMITS VERS LE SERVEUR
echo ==================================================
echo.
for /f "tokens=*" %%a in ('git rev-parse --abbrev-ref HEAD') do set branche_actuelle=%%a

echo   Voici les fichiers qui seront envoyes :
echo   --------------------------------------------------
git diff --stat origin/%branche_actuelle%..HEAD 2>nul
if errorlevel 1 echo   (Nouvelle branche ou aucune difference detectee)
echo   --------------------------------------------------
echo.

if /i not "%branche_actuelle%"=="main" goto DO_PUSH_SEUL

for /F %%a in ('echo prompt $E ^| cmd') do set "ESC=%%a"

echo.
echo   %ESC%[91m================ ATTENTION ================%ESC%[0m
echo   %ESC%[91mVous etes sur le point d'envoyer sur la branche 'main'.%ESC%[0m
set /p confirm_main="   Veuillez taper 'main' pour confirmer : "
if /i not "%confirm_main%"=="main" (
    echo.
    echo   Envoi annule.
    echo --------------------------------------------------
    echo   Appuyez sur une touche pour revenir au menu...
    pause >nul
    goto MENU
)

:DO_PUSH_SEUL
git push origin %branche_actuelle%
call :PR_CHECK
echo.
echo --------------------------------------------------
echo   Appuyez sur une touche pour revenir au menu...
pause >nul
goto MENU


REM ============================================================
REM  OPTION 23 - EQUIPE : Contributions de chaque membre
REM ============================================================
:EQUIPE
cls
echo ==================================================
echo       CONTRIBUTIONS DE L'EQUIPE NEWKET
echo ==================================================
echo.
echo   Commits par membre (tous les temps) :
echo.
git shortlog -sn --all
echo.
echo --------------------------------------------------
set /p membre_eq="   Voir les commits d'un membre ? (nom ou laisser vide = tout) : "
echo.
if "%membre_eq%"=="" (
    echo   --- 20 derniers commits de l'equipe ---
    echo.
    git log --oneline --all -20
) else (
    echo   --- Commits de %membre_eq% ---
    echo.
    git log --author="%membre_eq%" --oneline -20
)
echo.
echo --------------------------------------------------
echo   Appuyez sur une touche pour revenir au menu...
pause >nul
goto MENU

REM ============================================================
REM  OPTION 24 - MES BRANCHES : locales vs envoyees sur GitHub
REM ============================================================
:MES_BRANCHES
cls
echo ==================================================
echo     MES BRANCHES - LOCALES ET ENVOYEES SUR GITHUB
echo ==================================================
echo.
echo   (* = ta branche actuelle)
echo.
echo   LEGENDE :
echo   [origin/...] = aussi presente sur GitHub        (envoyee)
echo   (sans mention)= locale uniquement               (non envoyee)
echo   "ahead X"    = tu as X commit(s) non envoyes   (push requis)
echo   "behind X"   = il y a X commit(s) a recuperer  (pull requis)
echo.
echo   --------------------------------------------------
git branch -vv
echo   --------------------------------------------------
echo.
echo   Appuyez sur une touche pour revenir au menu...
pause >nul
goto MENU

REM ============================================================
REM  OPTION 25 - RETOUR BRANCHE : revenir a la branche precedente
REM ============================================================
:RETOUR_BRANCHE
cls
echo ==================================================
echo       RETOUR A LA BRANCHE PRECEDENTE
echo ==================================================
echo.
echo   Comme le bouton "Retour" d'un navigateur.
echo   Tu vas revenir sur la branche ou tu etais juste avant.
echo.
git checkout -
echo.
echo ==================================================
for /f "tokens=*" %%a in ('git rev-parse --abbrev-ref HEAD') do echo   Tu es maintenant sur : %%a
echo ==================================================
echo.
echo --------------------------------------------------
echo   Appuyez sur une touche pour revenir au menu...
pause >nul
goto MENU

REM ============================================================
REM  SOUS-ROUTINE : Proposition de Pull Request apres un push
REM  Appelee avec : call :PR_CHECK
REM  Retour avec  : goto :eof (automatique)
REM ============================================================
:PR_CHECK
setlocal enabledelayedexpansion
echo.
echo ==================================================
echo   Travail envoye avec succes sur GitHub !
echo ==================================================
echo.

REM --- Etape 1 : gh est-il installe ? ---
where gh >nul 2>&1
if errorlevel 1 (
    echo   Pour creer des Pull Requests directement ici,
    echo   GitHub CLI doit etre installe.
    echo.
    set /p install_gh="   Veux-tu l'installer maintenant ? (O/N) : "
    if /i "!install_gh!"=="O" (
        echo.
        echo   Installation en cours...
        echo   (Une fenetre administrateur peut s'ouvrir)
        echo.
        winget install GitHub.cli --accept-package-agreements --accept-source-agreements
        echo.
        echo   Relance l'assistant pour activer les PR automatiques.
    ) else (
        echo.
        echo   OK ! Cree ta PR manuellement sur :
        echo   https://github.com/benimakiese007/NewKet
    )
    goto :eof
)

REM --- Etape 2 : gh est-il connecte ? ---
gh auth status >nul 2>&1
if errorlevel 1 (
    echo   GitHub CLI est installe mais pas encore connecte.
    echo.
    set /p connect_gh="   Veux-tu te connecter a GitHub maintenant ? (O/N) : "
    if /i "!connect_gh!"=="O" (
        echo.
        echo   --- INSTRUCTIONS DE CONNEXION ---
        echo   1. Choisis : GitHub.com
        echo   2. Choisis : HTTPS
        echo   3. Choisis : Yes
        echo   4. Choisis : Login with a web browser
        echo.
        echo   ATTENTION : L'assistant va t'afficher un CODE A 8 CARACTERES.
        echo   Copie-le ! Appuie ensuite sur Entree pour ouvrir ton navigateur,
        echo   et colle ce code sur la page web de GitHub.
        echo   ---------------------------------
        echo.
        gh auth login
        echo.
        echo   Connexion terminee ! Tu peux maintenant creer des PR.
        echo.
    ) else (
        echo   ✅ OK ! Cree ta PR manuellement sur :
        echo   https://github.com/benimakiese007/NewKet
        goto :eof
    )
)

REM --- Etape 3 : gh est pret, on cree la PR ---
set faire_pr=
set /p faire_pr="   Veux-tu creer une Pull Request maintenant ? (O/N) : "
if /i not "%faire_pr%"=="O" goto :eof
echo.
set titre_pr=
set /p titre_pr="   Titre de la PR (Entree = titre automatique) : "
echo.
if "%titre_pr%"=="" (
    gh pr create --base main --fill
) else (
    gh pr create --base main --title "%titre_pr%" --fill
)
echo.
goto :eof

:END
exit

