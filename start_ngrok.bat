@echo off
echo ===================================================
echo   Lancement du Tunnel pour le Backend NewKet
echo   Port cible : 3001 (Assure-toi que le backend tourne)
echo ===================================================
echo.
echo Veuillez patienter, chargement de l'URL publique...
echo.
echo Une fois l'URL "your url is: https://..." affichee,
echo copie-la et mets-la dans ton .env (CINETPAY_NOTIFY_URL) 
echo et dans frontend/src/services/ui-helpers.js !
echo.
call npx localtunnel --port 3001
pause
