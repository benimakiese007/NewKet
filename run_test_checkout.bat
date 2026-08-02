@echo off
title NewKet - Test Checkout
color 0B
echo ================================
echo   Test : Paiement / Checkout
echo ================================
echo.
npx playwright test tests/e2e/checkout.spec.js --reporter=list
echo.
pause
