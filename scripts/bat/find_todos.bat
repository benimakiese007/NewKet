@echo off
chcp 65001 > nul
echo ========================================================
echo      RECHERCHE DES TACHES EN ATTENTE (TODO / FIXME)
echo ========================================================
echo.
echo -- TODOs trouves --
findstr /s /i /n "TODO" "..\..\frontend\src\*.*" "..\..\backend\src\*.*" "..\..\api\*.*"
echo.
echo -- FIXMEs trouves --
findstr /s /i /n "FIXME" "..\..\frontend\src\*.*" "..\..\backend\src\*.*" "..\..\api\*.*"
echo.
echo ========================================================
echo Recherche terminee.
echo ========================================================
pause
