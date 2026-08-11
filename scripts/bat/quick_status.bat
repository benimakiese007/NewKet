@echo off
chcp 65001 > nul
echo ========================================================
echo             STATUT RAPIDE DU PROJET
echo ========================================================
echo.
cd ..\..
echo --- GIT STATUS ---
git status -s
echo.
echo --- DERNIERS COMMITS ---
git log -n 5 --oneline
echo.
echo --- VERIFICATION DES PORTS (3000, 3001, 8080) ---
netstat -ano | findstr "3000"
netstat -ano | findstr "3001"
netstat -ano | findstr "8080"
echo.
echo ========================================================
echo Appuyez sur une touche pour fermer.
echo ========================================================
pause
