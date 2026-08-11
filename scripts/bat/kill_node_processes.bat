@echo off
chcp 65001 > nul
echo ========================================================
echo    TUER DE FORCE TOUS LES PROCESSUS NODE.JS
echo ========================================================
echo.
echo Fermeture de tous les serveurs Node en cours d'execution...
taskkill /F /IM node.exe
echo.
echo ========================================================
echo Termine. (Ignorez les erreurs si aucun processus n'etait actif)
echo ========================================================
pause
