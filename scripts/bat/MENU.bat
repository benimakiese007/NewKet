@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

:menu
cls
echo ========================================================
echo        NEWKET - MENU PRINCIPAL DES SCRIPTS .BAT
echo ========================================================
echo.
echo [1] Demarrer tout (Frontend + Backend)
echo [2] Arreter tout (Fermer Node, etc.)
echo [3] Lancer tous les tests
echo [4] Recherche de texte (Chercher dans le code)
echo [5] Trouver les TODOs et FIXMEs
echo [6] Reset Nucleaire (Supprimer node_modules et reinstaller)
echo [7] Tuer de force tous les processus Node.js
echo [8] Ouvrir Playwright en mode UI
echo [9] Verifier le statut du projet (Git, etc.)
echo [10] Sous-menu Securite (Audit, Scans de secrets...)
echo [11] Sous-menu Scripts Node.js (.mjs et diagnostics)
echo [0] Quitter
echo.
set /p choix="Choisissez une option (0-11) : "

if "%choix%"=="1" (
    call start_all.bat
    pause
    goto menu
)
if "%choix%"=="2" (
    call stop_all.bat
    pause
    goto menu
)
if "%choix%"=="3" (
    call run_tests_all.bat
    pause
    goto menu
)
if "%choix%"=="4" (
    call search_text.bat
    pause
    goto menu
)
if "%choix%"=="5" (
    call find_todos.bat
    pause
    goto menu
)
if "%choix%"=="6" (
    call nuclear_reset.bat
    pause
    goto menu
)
if "%choix%"=="7" (
    call kill_node_processes.bat
    pause
    goto menu
)
if "%choix%"=="8" (
    call playwright_ui.bat
    pause
    goto menu
)
if "%choix%"=="9" (
    call quick_status.bat
    pause
    goto menu
)
if "%choix%"=="10" (
    call MENU_SECURITE.bat
    goto menu
)
if "%choix%"=="11" (
    call MENU_MJS.bat
    goto menu
)
if "%choix%"=="0" (
    exit /b
)

echo Option invalide.
pause
goto menu
