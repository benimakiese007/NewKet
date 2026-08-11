@echo off
chcp 65001 > nul
echo ========================================================
echo    EXECUTION DE LA SUITE DE TESTS LOURDS (HEAVY)
echo ========================================================
echo.
echo Ce script va lancer l'integralite des tests Playwright
echo generes recemment, incluant :
echo - Recherche, Panier, Favoris
echo - Tableaux de bord Client, Vendeur, Admin
echo - Tests de Securite et Sante de l'API
echo.
echo Lancement en mode Headless (arriere-plan) ...
echo.
cd ..\..
call npx playwright test tests/e2e/search-and-filter.spec.js tests/e2e/cart-management.spec.js tests/e2e/favorites-wishlist.spec.js tests/e2e/customer-dashboard.spec.js tests/e2e/vendor-publish.spec.js tests/e2e/vendor-shops.spec.js tests/e2e/admin-dashboard.spec.js tests/e2e/admin-users-mgmt.spec.js tests/e2e/admin-reviews.spec.js tests/e2e/security-auth-guards.spec.js tests/e2e/api-endpoints-health.spec.js

echo.
echo ========================================================
echo Tests termines. Pour voir le rapport, lancez :
echo npx playwright show-report
echo ========================================================
pause
