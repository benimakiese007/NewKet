@echo off
chcp 65001 > nul
setlocal

echo ========================================================
echo        NEWKET - REVEILLER LE SERVEUR YOLO (Render)
echo ========================================================
echo.
echo Le serveur Render s'endort apres ~15 min d'inactivite.
echo Le reveil prend environ 30-60 secondes (cold start).
echo.
echo [1] Ping simple (verifier si le serveur repond)
echo [2] Ping + attendre le reveil complet
echo [3] Tester l'analyse YOLO avec une image de test
echo [0] Retour
echo.
set /p choix="Choisissez une option (0-3) : "

if "%choix%"=="1" goto ping_simple
if "%choix%"=="2" goto ping_wait
if "%choix%"=="3" goto test_yolo
if "%choix%"=="0" exit /b
echo Option invalide.
pause
exit /b

:ping_simple
echo.
echo Envoi d'un ping a https://newket.onrender.com/ ...
echo.
curl -s -o nul -w "Status HTTP: %%{http_code} | Temps: %%{time_total}s\n" https://newket.onrender.com/
echo.
if %errorlevel% equ 0 (
    echo [OK] Le serveur a repondu !
) else (
    echo [ERREUR] Le serveur n'a pas repondu.
)
echo.
pause
exit /b

:ping_wait
echo.
echo Reveil du serveur en cours (peut prendre jusqu'a 60s)...
echo.
set /a attempt=0
:wait_loop
set /a attempt+=1
echo Tentative %attempt%/12 ...
curl -s -o nul -w "HTTP %%{http_code} (%%{time_total}s)" https://newket.onrender.com/
echo.
curl -s https://newket.onrender.com/ | findstr /i "healthy" > nul 2>&1
if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo   SERVEUR YOLO REVEILLE ET OPERATIONNEL
    echo ========================================
    echo.
    pause
    exit /b
)
if %attempt% geq 12 (
    echo.
    echo [TIMEOUT] Le serveur n'a pas repondu apres 12 tentatives.
    echo Verifiez https://dashboard.render.com pour l'etat du service.
    echo.
    pause
    exit /b
)
timeout /t 5 /nobreak > nul
goto wait_loop

:test_yolo
echo.
echo Envoi d'une requete de test au endpoint /analyze ...
echo (Le serveur doit etre reveille pour que ca fonctionne)
echo.
curl -s -w "\nStatus HTTP: %%{http_code} | Temps total: %%{time_total}s\n" ^
     -X POST https://newket.onrender.com/analyze ^
     -F "file=@NUL" 2>nul
echo.
echo Note: Sans image valide, le serveur peut retourner une erreur 422.
echo C'est normal - ca confirme que le serveur est bien reveille !
echo.
pause
exit /b
