@echo off
title NewKet - Lancement Global
echo ===================================
echo   Demarrage de NewKet (ALL)
echo ===================================

echo Demarrage du Serveur Backend (API)...
start "NewKet - Backend" cmd /k "cd backend && call npm run dev"

echo Demarrage du Serveur Frontend...
start "NewKet - Frontend" cmd /k "cd frontend && call npm run dev"

echo Les serveurs sont en cours de demarrage dans de nouvelles fenetres !
exit
