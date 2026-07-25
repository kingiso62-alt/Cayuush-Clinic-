@echo off
echo ================================
echo  Cayush Clinic - Starting App...
echo ================================

echo.
echo [1/2] Starting Backend Server...
start "Cayush Clinic - BACKEND" cmd /k "cd /d "%~dp0Backend" && node index.js"

timeout /t 2 /nobreak >nul

echo [2/2] Starting Frontend Server...
start "Cayush Clinic - FRONTEND" cmd /k "cd /d "%~dp0Frontend" && npx vite"

echo.
echo ================================
echo  Both servers starting!
echo  Backend:  http://localhost:3005
echo  Frontend: http://localhost:5173
echo ================================
echo.
echo Open your browser: http://localhost:5173
echo.
pause
