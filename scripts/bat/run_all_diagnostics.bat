@echo off
chcp 65001 > nul
echo ========================================================
echo     LANCEMENT DES DIAGNOSTICS NODE.JS (.MJS)
echo ========================================================
echo.
cd ..\..
echo --- 1. Statistiques Globales ---
call node scripts/count-stats.mjs
echo.
echo --- 2. Garde-fou (Images mortes) ---
call node scripts/check-garde-fou.mjs
echo.
echo --- 3. Comptage des Images Produits ---
call node scripts/count-product-images.mjs
echo.
echo ========================================================
echo Diagnostics termines !
echo ========================================================
cd scripts\bat
pause
