@echo off
chcp 65001 >nul
setlocal

:MENU
cls
echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║              🚀  NEWKET — MENU PRINCIPAL             ║
echo  ╠══════════════════════════════════════════════════════╣
echo  ║  SERVEURS                                            ║
echo  ║  [1] Démarrer tout              (start_all)         ║
echo  ║  [2] Démarrer backend           (start_backend)     ║
echo  ║  [3] Démarrer frontend          (start_frontend)    ║
echo  ║  [4] Démarrer ngrok             (start_ngrok)       ║
echo  ║  [5] Arrêter tout               (stop_all)          ║
echo  ╠══════════════════════════════════════════════════════╣
echo  ║  DÉVELOPPEMENT                                       ║
echo  ║  [6] Installer dépendances      (install_deps)      ║
echo  ║  [7] Nettoyer le cache          (clean_cache)       ║
echo  ║  [8] Builder en production      (build_prod)        ║
echo  ║  [9] Déployer                   (deploy)            ║
echo  ╠══════════════════════════════════════════════════════╣
echo  ║  GIT                                                 ║
echo  ║  [10] Git rapide (add+commit+push)  (git_rapide)    ║
echo  ║  [11] Push simple                   (push)          ║
echo  ╠══════════════════════════════════════════════════════╣
echo  ║  TESTS                                               ║
echo  ║  [12] Tous les tests            (run_tests_all)     ║
echo  ║  [13] Tests UI                  (run_tests_ui)      ║
echo  ║  [14] Test boutons (toutes pages)(run_test_buttons) ║
echo  ║  [15] Test authentification     (run_test_auth)     ║
echo  ║  [16] Test checkout             (run_test_checkout) ║
echo  ║  [17] Test commandes            (run_test_orders)   ║
echo  ║  [18] Test shopping             (run_test_shopping) ║
echo  ║  [19] Test vendeur              (run_test_vendor)   ║
echo  ╠══════════════════════════════════════════════════════╣
echo  ║  BASE DE DONNÉES                                     ║
echo  ║  [20] Backup base de données    (backup_db)         ║
echo  ║  [21] Créer produit de test     (create_test_product)║
echo  ╠══════════════════════════════════════════════════════╣
echo  ║  [0] Quitter                                         ║
echo  ╚══════════════════════════════════════════════════════╝
echo.
set /p CHOIX="  Votre choix : "

if "%CHOIX%"=="1"  call scripts\bat\start_all.bat           & goto MENU
if "%CHOIX%"=="2"  call scripts\bat\start_backend.bat       & goto MENU
if "%CHOIX%"=="3"  call scripts\bat\start_frontend.bat      & goto MENU
if "%CHOIX%"=="4"  call scripts\bat\start_ngrok.bat         & goto MENU
if "%CHOIX%"=="5"  call scripts\bat\stop_all.bat            & goto MENU
if "%CHOIX%"=="6"  call scripts\bat\install_deps.bat        & goto MENU
if "%CHOIX%"=="7"  call scripts\bat\clean_cache.bat         & goto MENU
if "%CHOIX%"=="8"  call scripts\bat\build_prod.bat          & goto MENU
if "%CHOIX%"=="9"  call scripts\bat\deploy.bat              & goto MENU
if "%CHOIX%"=="10" call scripts\bat\git_rapide.bat          & goto MENU
if "%CHOIX%"=="11" call scripts\bat\push.bat                & goto MENU
if "%CHOIX%"=="12" call scripts\bat\run_tests_all.bat       & goto MENU
if "%CHOIX%"=="13" call scripts\bat\run_tests_ui.bat        & goto MENU
if "%CHOIX%"=="14" call scripts\bat\run_test_buttons.bat    & goto MENU
if "%CHOIX%"=="15" call scripts\bat\run_test_auth.bat       & goto MENU
if "%CHOIX%"=="16" call scripts\bat\run_test_checkout.bat   & goto MENU
if "%CHOIX%"=="17" call scripts\bat\run_test_orders.bat     & goto MENU
if "%CHOIX%"=="18" call scripts\bat\run_test_shopping.bat   & goto MENU
if "%CHOIX%"=="19" call scripts\bat\run_test_vendor.bat     & goto MENU
if "%CHOIX%"=="20" call scripts\bat\backup_db.bat           & goto MENU
if "%CHOIX%"=="21" call scripts\bat\create_test_product.bat & goto MENU
if "%CHOIX%"=="0"  goto FIN

echo.
echo  ❌ Choix invalide. Réessayez.
timeout /t 2 >nul
goto MENU

:FIN
echo.
echo  👋 Au revoir !
echo.
endlocal
