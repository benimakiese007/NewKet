@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

:menu_mjs
cls
echo ========================================================
echo        NEWKET - SOUS-MENU SCRIPTS NODE.JS (.MJS)
echo ========================================================
echo.
echo [1] Lancer TOUS les diagnostics d'un coup
echo [2] count-stats.mjs (Stats globales de l'app)
echo [3] check-garde-fou.mjs (Verification des images mortes)
echo [4] count-product-images.mjs (Comptage des images produits)
echo [5] backup_db.mjs (Sauvegarde JSON de Supabase)
echo [6] create_test_product.mjs (Inserer faux produit en BD)
echo [7] Retourner au Menu Principal
echo.
set /p choix="Choisissez une option (1-7) : "

if "%choix%"=="1" (
    call run_all_diagnostics.bat
    goto menu_mjs
)
if "%choix%"=="2" (
    cd ..\..
    call node scripts/count-stats.mjs
    pause
    cd scripts\bat
    goto menu_mjs
)
if "%choix%"=="3" (
    cd ..\..
    call node scripts/check-garde-fou.mjs
    pause
    cd scripts\bat
    goto menu_mjs
)
if "%choix%"=="4" (
    cd ..\..
    call node scripts/count-product-images.mjs
    pause
    cd scripts\bat
    goto menu_mjs
)
if "%choix%"=="5" (
    cd ..\..
    call node scripts/backup_db.mjs
    pause
    cd scripts\bat
    goto menu_mjs
)
if "%choix%"=="6" (
    cd ..\..
    call node scripts/create_test_product.mjs
    pause
    cd scripts\bat
    goto menu_mjs
)
if "%choix%"=="7" (
    call MENU.bat
    exit /b
)

echo Option invalide.
pause
goto menu_mjs
