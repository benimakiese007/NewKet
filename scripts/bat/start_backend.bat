@echo off
title NewKet - Backend
echo ===================================
echo   Demarrage de NewKet (BACKEND)
echo ===================================

cd /d "%~dp0\..\.."
cd backend
call npm run dev
pause
