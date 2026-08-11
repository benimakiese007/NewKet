@echo off
chcp 65001 > nul
echo ========================================================
echo     AUDIT DE SECURITE DES DEPENDANCES (NPM AUDIT)
echo ========================================================
echo Ce script va verifier si vos bibliotheques ont des failles
echo de securite connues publiquement.
echo.
echo --- Audit du Frontend ---
cd ..\..\frontend
call npm audit
echo.
echo --- Audit du Backend ---
cd ..\..\backend
call npm audit
echo.
echo ========================================================
echo Audit termine. 
echo (S'il y a des alertes rouges, envisagez de lancer 'npm audit fix')
echo ========================================================
pause
