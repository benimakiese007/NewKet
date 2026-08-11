@echo off
echo ========================================
echo        AUTO GIT PUSH SCRIPT
echo ========================================
echo.
echo [1/2] Pushing to GitHub (Code)...
git push
echo.
echo [2/2] Pushing migrations to Supabase (Database)...
call npx supabase db push
echo.
echo ========================================
echo        DONE!
echo ========================================
pause
