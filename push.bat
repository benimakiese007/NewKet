@echo off
echo ========================================
echo        AUTO GIT PUSH SCRIPT
echo ========================================

echo.
echo [1/3] Adding changes...
git add .

echo.
echo [2/3] Committing changes...
git commit -m "Auto commit: %date% %time%"

echo.
echo [3/3] Pushing to repository...
git push

echo.
echo ========================================
echo        DONE!
echo ========================================
pause
