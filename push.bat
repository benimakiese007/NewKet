@echo off
echo ========================================
echo        AUTO GIT PUSH SCRIPT
echo ========================================

echo.
echo [1/4] Adding changes...
git add .

echo.
echo [2/4] Committing changes...
git commit -m "Auto commit: %date% %time%"

echo.
echo [3/4] Pushing to Supabase (Database)...
call npx supabase db push

echo.
echo [4/4] Pushing to GitHub (Code)...
git push

echo.
echo ========================================
echo        DONE!
echo ========================================
pause
