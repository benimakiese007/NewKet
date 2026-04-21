@echo off
setlocal enabledelayedexpansion

title NewKet - Mobile Access

:: Trouver l'adresse IP locale (IPv4)
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /C:"IPv4 Address" /C:"Adresse IPv4"') do (
    set IP=%%a
    :: Nettoyer les espaces (Windows ajoute parfois des espaces avant l'adresse)
    for /f "tokens=1" %%b in ("!IP!") do set IP=%%b
)

:: Si l'IP n'a pas été trouvée par les chaînes spécifiques, on tente une approche plus large
if "!IP!"=="" (
    for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr "IPv4"') do (
        set IP=%%a
        for /f "tokens=1" %%b in ("!IP!") do set IP=%%b
    )
)

:: Nettoyer les espaces restants
set IP=%IP: =%

echo ==========================================
echo    NEWKET : ACCES MOBILE
echo ==========================================
echo.
echo IP de ton PC detectee : !IP!
echo.
echo 1. Connecte ton mobile au MEME Wi-Fi que ce PC.
echo 2. Sur ton mobile, tape cette adresse :
echo.
IF NOT "!IP!"=="" (
    echo    http://!IP!:5173
) ELSE (
    echo    [ERREUR : IP non detectee automatiquement]
    echo    Tape "ipconfig" dans un terminal pour trouver ton "Adresse IPv4"
    echo    puis ajoute ":5173" a la fin sur ton mobile.
)
echo.
echo ==========================================
echo Lancement du serveur...
echo.

:: Lancer npm run dev:frontend avec --host pour autoriser les connexions externes
npm run dev:frontend -- --host

pause
