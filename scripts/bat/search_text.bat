@echo off
chcp 65001 > nul
echo ========================================================
echo      RECHERCHE DE TEXTE DANS LE PROJET NEWKET
echo ========================================================
echo.
set /p query="Entrez le texte a rechercher : "
echo.
echo Recherche de "%query%" en cours...
echo.
findstr /s /i /n /m /c:"%query%" "..\..\frontend\src\*.*" "..\..\backend\src\*.*" "..\..\api\*.*" 
echo.
echo ========================================================
echo Recherche terminee. (Les fichiers listes contiennent le texte)
echo ========================================================
pause
