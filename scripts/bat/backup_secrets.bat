@echo off
echo ===================================================
echo     MISE A JOUR DE LA SAUVEGARDE DES SECRETS
echo ===================================================
echo.

set SRC=C:\Users\tmaut\Downloads\THE PHOENIX\NewKet
set DEST=C:\Users\tmaut\Desktop\Sauvegarde_Secrets_NewKet

if not exist "%DEST%" mkdir "%DEST%"

echo [1/3] Copie des fichiers .env a la racine...
copy /Y "%SRC%\.env" "%DEST%\.env" >nul 2>&1
copy /Y "%SRC%\.env.local" "%DEST%\.env.local" >nul 2>&1
copy /Y "%SRC%\.env.production" "%DEST%\.env.production" >nul 2>&1

echo [2/3] Copie des fichiers frontend et scripts...
if not exist "%DEST%\frontend" mkdir "%DEST%\frontend"
copy /Y "%SRC%\frontend\.env" "%DEST%\frontend\.env" >nul 2>&1
copy /Y "%SRC%\frontend\.env.local" "%DEST%\frontend\.env.local" >nul 2>&1
copy /Y "%SRC%\frontend\.env.production" "%DEST%\frontend\.env.production" >nul 2>&1

copy /Y "%SRC%\.secrets" "%DEST%\.secrets" >nul 2>&1

if not exist "%DEST%\scripts\bat" mkdir "%DEST%\scripts\bat"
copy /Y "%SRC%\scripts\bat\.secrets" "%DEST%\scripts\bat\.secrets" >nul 2>&1
copy /Y "%SRC%\scripts\bat\_secrets.bat" "%DEST%\scripts\bat\_secrets.bat" >nul 2>&1

echo [3/3] Copie des dossiers locaux...
xcopy "%SRC%\newket-ad" "%DEST%\newket-ad" /E /I /Y >nul 2>&1
xcopy "%SRC%\.agents" "%DEST%\.agents" /E /I /Y >nul 2>&1
xcopy "%SRC%\antigravity-workflows" "%DEST%\antigravity-workflows" /E /I /Y >nul 2>&1

echo.
echo ===================================================
echo   SAUVEGARDE TERMINEE AVEC SUCCES !
echo ===================================================
echo Tu peux maintenant glisser le dossier "Sauvegarde_Secrets_NewKet" 
echo dans ton Google Drive pour remplacer l'ancien.
echo.
pause
