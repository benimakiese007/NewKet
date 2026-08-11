@echo off
chcp 65001 > nul
echo ========================================================
echo    RESET NUCLEAIRE (Nettoyage et Reinstallation)
echo ========================================================
echo ATTENTION : Ce script va supprimer tous les dossiers node_modules
echo et reinstaller les dependances. Cela peut prendre du temps.
echo.
pause
echo.
echo 1. Nettoyage du cache NPM...
call npm cache clean --force

echo 2. Suppression de frontend/node_modules...
if exist "..\..\frontend\node_modules" rmdir /s /q "..\..\frontend\node_modules"

echo 3. Suppression de backend/node_modules...
if exist "..\..\backend\node_modules" rmdir /s /q "..\..\backend\node_modules"

echo 4. Suppression de node_modules racine...
if exist "..\..\node_modules" rmdir /s /q "..\..\node_modules"

echo 5. Reinstallation des dependances globales...
cd ..\..
call npm run install:all

echo.
echo ========================================================
echo RESET TERMINE !
echo ========================================================
pause
