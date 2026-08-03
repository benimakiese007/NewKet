@echo off
echo ==============================================
echo Installing all project dependencies...
echo ==============================================
echo.

echo Installing root dependencies...
call npm install

echo.
echo Installing frontend dependencies...
cd frontend
call npm install
cd ..

echo.
echo Installing backend dependencies...
cd backend
call npm install
cd ..

echo.
echo ==============================================
echo All dependencies installed successfully!
echo ==============================================
pause
