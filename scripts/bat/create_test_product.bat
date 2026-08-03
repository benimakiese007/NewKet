@echo off
echo ==============================================
echo Creation d'un Produit de Test sur Supabase
echo ==============================================
echo.
echo Ce script va generer un faux produit attribue a ton compte vendeur de test.
echo.

call node scripts/create_test_product.mjs

echo.
echo ==============================================
echo Operation terminee.
echo ==============================================
pause
