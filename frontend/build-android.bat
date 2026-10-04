@echo off
chcp 65001 >nul
echo ----------------------------------------------------
echo  🚀 BUILD ANDROID (DEBUG) - NEWKET EMARKET
echo ----------------------------------------------------
echo.

echo [1/3] 🛠️  Compilation du site web (Vite)...
call npm run build
if %errorlevel% neq 0 (
    echo ❌ Erreur lors du build frontend.
    pause
    exit /b %errorlevel%
)
echo.

echo [2/3] 🔄 Synchronisation vers Android (Capacitor)...
call npx cap sync android
if %errorlevel% neq 0 (
    echo ❌ Erreur lors du cap sync.
    pause
    exit /b %errorlevel%
)
echo.

echo [3/3] 📱 Generation de l'APK (Gradle)...
cd android
call gradlew.bat assembleDebug
if %errorlevel% neq 0 (
    echo ❌ Erreur de compilation de l'APK (Gradle).
    pause
    exit /b %errorlevel%
)
cd ..
echo.

echo ----------------------------------------------------
echo  🎉 SUCCÈS ! L'APK EST PRÊTE.
echo ----------------------------------------------------
echo  📂 Ouverture du dossier...
explorer.exe "android\app\build\outputs\apk\debug"
echo.
pause
