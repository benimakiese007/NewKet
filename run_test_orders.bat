@echo off
title NewKet - Test Order/Quote Flow
color 0B
echo ================================
echo   Test : Flux Commande / Devis
echo ================================
echo.
npx playwright test tests/e2e/order-quote-flow.spec.js --reporter=list
echo.
pause
