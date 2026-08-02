@echo off
echo ==============================================
echo Sauvegarde de la base de donnees NewKet
echo ==============================================
echo.
echo Connexion a Supabase via API REST...
echo.

call node scripts/backup_db.mjs

echo.
echo ==============================================
echo Sauvegarde complete ! Voir dossier "backups"
echo ==============================================
pause
