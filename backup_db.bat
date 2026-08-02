@echo off
setlocal
echo ==============================================
echo Sauvegarde de la base de donnees Supabase
echo ==============================================
echo.

if not exist "backups" mkdir backups

:: Format the date for the filename (Evite les problemes de format de date local)
set "BACKUP_FILE=backups\db_backup_%date:/=-%_%time::=-%.sql"
set "BACKUP_FILE=%BACKUP_FILE: =0%"

echo Lancement du dump de la base de donnees...
echo Fichier de destination : %BACKUP_FILE%
echo.
echo NOTE : Assure-toi d'etre connecte avec "npx supabase login" 
echo et d'avoir relie ton projet avec "npx supabase link --project-ref TON_ID_PROJET"
echo.

call npx supabase db dump -f "%BACKUP_FILE%"

echo.
echo ==============================================
echo Sauvegarde terminee ! 
echo Verifie s'il n'y a pas eu d'erreurs ci-dessus.
echo ==============================================
pause
endlocal
