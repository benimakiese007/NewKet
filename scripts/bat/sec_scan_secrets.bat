@echo off
chcp 65001 > nul
echo ========================================================
echo     SCANNER DE SECRETS EN CODAGE EN DUR (HARDCODED)
echo ========================================================
echo Recherche de mots-cles (password, secret, api_key, token)
echo dans le code source (cela exclut les fichiers .env).
echo Assurez-vous de ne jamais ecrire de vrais mots de passe
echo directement dans le code !
echo.
echo -- Resultats (S'il n'y a rien en dessous, c'est bon signe !) --
cd ..\..
findstr /s /i /n "password=" "frontend\src\*.*" "backend\src\*.*" "api\*.*"
findstr /s /i /n "api_key=" "frontend\src\*.*" "backend\src\*.*" "api\*.*"
findstr /s /i /n "secret=" "frontend\src\*.*" "backend\src\*.*" "api\*.*"
findstr /s /i /n "token=" "frontend\src\*.*" "backend\src\*.*" "api\*.*"
echo.
echo ========================================================
echo Scan termine. Attention : il peut y avoir des faux positifs.
echo ========================================================
pause
