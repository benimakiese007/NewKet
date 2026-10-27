@echo off
chcp 65001 >nul

:: Desactiver le mode QuickEdit (evite qu'un clic dans la fenetre fige l'execution)
reg add HKCU\Console /v QuickEdit /t REG_DWORD /d 0 /f >nul 2>&1

:: Se positionner dans le dossier du script (fix double-clic Explorer)
cd /d "%~dp0"

echo ----------------------------------------------------
echo  BUILD ANDROID DEBUG - NEWKET EMARKET
echo ----------------------------------------------------
echo.

echo [1/3] Compilation du site web Vite...
call npm run build
if %errorlevel% neq 0 (
    echo ERREUR lors du build frontend.
    pause
    exit /b %errorlevel%
)
echo.

echo [2/3] Synchronisation vers Android Capacitor...
call node node_modules/@capacitor/cli/bin/capacitor sync android
if %errorlevel% neq 0 (
    echo ERREUR lors du cap sync.
    pause
    exit /b %errorlevel%
)
echo.

echo [3/3] Generation de l'APK Gradle...
cd android
call gradlew.bat assembleDebug
if %errorlevel% neq 0 (
    echo ERREUR de compilation APK Gradle.
    pause
    exit /b %errorlevel%
)
cd ..
echo.

echo ----------------------------------------------------
echo  SUCCES ! L'APK EST PRETE.
echo ----------------------------------------------------
echo  Ouverture du dossier de l'APK...
start "" "android\app\build\outputs\apk\debug"
echo  Fermeture automatique dans 3 secondes...
timeout /t 3 /nobreak >nul
