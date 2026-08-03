@echo off
title NewKet - Test Vendor
color 0B
echo ================================
echo   Test : Espace Vendeur
echo ================================
echo.
npx playwright test tests/e2e/vendor.spec.js --reporter=list
echo.
pause
