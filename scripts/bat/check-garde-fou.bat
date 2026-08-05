@echo off
echo Verification des garde-fous en cours... (peut prendre quelques secondes)
echo.
node "%~dp0..\check-garde-fou.mjs"
echo.
pause
