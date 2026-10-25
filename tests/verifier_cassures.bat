@echo off
echo =======================================================
echo [CENTRE DE VERIFICATION DES CASSURES - TESTS]
echo =======================================================
echo.

echo [1/3] Demarrage de la verification du Backend (Tests unitaires)...
cd ..
call npx vitest run tests/backend/
if %errorlevel% neq 0 (
    echo.
    echo [ERREUR] : Une cassure a ete trouvee dans le Backend !
    pause
    exit /b %errorlevel%
)
cd tests
echo [OK] Backend sans erreur !
echo.

echo [2/3] Demarrage de la verification du Frontend (Tests unitaires)...
cd ..
call npx vitest run tests/frontend/
if %errorlevel% neq 0 (
    echo.
    echo [ERREUR] : Une cassure a ete trouvee dans le Frontend !
    pause
    exit /b %errorlevel%
)
cd tests
echo [OK] Frontend sans erreur !
echo.

echo [3/3] Demarrage des tests utilisateurs Bout-en-Bout (Playwright)...
cd ..
call npx playwright test --config=tests/playwright.config.js
if %errorlevel% neq 0 (
    echo.
    echo [ERREUR] : Une cassure a ete trouvee dans les tests utilisateurs (Playwright) !
    echo Regardez le rapport html qui s'est ouvert pour corriger.
    pause
    exit /b %errorlevel%
)
cd tests

echo.
echo =======================================================
echo [SUCCES] TOUT EST VERT ! AUCUNE CASSURE DETECTEE !
echo La feature est solide, aucun effet de bord !
echo =======================================================
pause
