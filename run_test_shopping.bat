@echo off
title NewKet - Test Shopping
color 0B
echo ================================
echo   Test : Shopping et Panier
echo ================================
echo.
npx playwright test tests/e2e/shopping.spec.js --reporter=list
echo.
pause
