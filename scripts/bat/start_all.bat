@echo off
title NewKet - Lancement Global
echo ===================================
echo   Demarrage de NewKet (ALL)
echo ===================================

echo Demarrage du Serveur Backend (API)...
start "NewKet - Backend" cmd /c "start_backend.bat"

echo Demarrage du Serveur Frontend...
start "NewKet - Frontend" cmd /c "start_frontend.bat"

echo Les serveurs sont en cours de demarrage dans de nouvelles fenetres !
exit
