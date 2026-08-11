@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

:menu_sec
cls
echo ========================================================
echo        NEWKET - MENU SECURITE
echo ========================================================
echo.
echo [1] Lancer un Audit des Dependances (NPM Audit)
echo [2] Scanner le code pour des secrets ou mots de passe oublies
echo [3] Retourner au Menu Principal
echo.
set /p choix="Choisissez une option (1-3) : "

if "%choix%"=="1" (
    call sec_audit_deps.bat
    goto menu_sec
)
if "%choix%"=="2" (
    call sec_scan_secrets.bat
    goto menu_sec
)
if "%choix%"=="3" (
    call MENU.bat
    exit /b
)

echo Option invalide.
pause
goto menu_sec
