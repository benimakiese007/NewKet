@echo off
echo ==============================================
echo Cleaning Cache and Node Modules...
echo ==============================================
echo.
echo WARNING: This will delete all node_modules and build artifacts!
echo Press CTRL+C to abort, or any key to continue.
pause

echo.
echo Deleting root node_modules...
if exist "node_modules" rmdir /S /Q node_modules

echo Deleting frontend node_modules and vite cache/build...
if exist "frontend\node_modules" rmdir /S /Q frontend\node_modules
if exist "frontend\dist" rmdir /S /Q frontend\dist
if exist "frontend\.vite" rmdir /S /Q frontend\.vite

echo Deleting backend node_modules...
if exist "backend\node_modules" rmdir /S /Q backend\node_modules

echo.
echo ==============================================
echo Clean complete! Run install_deps.bat to reinstall dependencies.
echo ==============================================
pause
