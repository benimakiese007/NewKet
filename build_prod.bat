@echo off
echo ==============================================
echo Building Frontend for Production...
echo ==============================================
echo.

cd frontend
call npm run build
cd ..

echo.
echo ==============================================
echo Build complete!
echo The production files are in the frontend/dist folder.
echo ==============================================
pause
