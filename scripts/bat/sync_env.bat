@echo off
chcp 65001 > nul
echo ========================================================
echo    GENERATEUR DE FICHIERS D'ENVIRONNEMENT (.ENV)
echo ========================================================
echo.
cd ..\..
if not exist "frontend\.env" (
    if exist "frontend\.env.example" (
        copy "frontend\.env.example" "frontend\.env"
        echo [OK] frontend\.env cree a partir de .env.example
    ) else (
        type NUL > "frontend\.env"
        echo [OK] frontend\.env cree (vide)
    )
) else (
    echo [INFO] frontend\.env existe deja.
)

if not exist "backend\.env" (
    if exist "backend\.env.example" (
        copy "backend\.env.example" "backend\.env"
        echo [OK] backend\.env cree a partir de .env.example
    ) else (
        type NUL > "backend\.env"
        echo [OK] backend\.env cree (vide)
    )
) else (
    echo [INFO] backend\.env existe deja.
)

echo.
echo ========================================================
echo Verification terminee.
echo ========================================================
pause
