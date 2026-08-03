@echo off
echo ==============================================
echo Stopping Node.js, Vite, and Ngrok processes...
echo ==============================================
echo.

echo Killing Node.js processes...
taskkill /F /IM node.exe /T 2>nul

echo Killing Ngrok processes...
taskkill /F /IM ngrok.exe /T 2>nul

echo.
echo ==============================================
echo All specified processes have been terminated.
echo ==============================================
pause
