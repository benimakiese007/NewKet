@echo off
echo ==============================================
echo Deploiement de NewKet sur Vercel
echo ==============================================
echo.

echo 1. Compilation du frontend...
call build_prod.bat

echo.
echo 2. Deploiement vers Vercel (Production)...
call npx vercel --prod

echo.
echo ==============================================
echo Deploiement termine !
echo ==============================================
pause
