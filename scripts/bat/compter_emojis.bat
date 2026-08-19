@echo off
chcp 65001 >nul
setlocal

set "URL=%~1"

:: Si aucune URL n'est passée en argument, on la demande à l'utilisateur
if "%URL%"=="" (
    set /p "URL=Veuillez entrer l'URL du site a analyser (ex: https://example.com) : "
)

:: Si l'utilisateur n'a rien saisi, on quitte
if "%URL%"=="" (
    echo Aucune URL fournie.
    pause
    exit /b 1
)

echo.
echo Analyse de la page : %URL%
echo.

powershell -NoProfile -Command "$ErrorActionPreference = 'Stop'; try { $html = Invoke-RestMethod -Uri '%URL%' -UseBasicParsing; $emojiRegex = '[\u2600-\u27BF]|[\uD83C-\uDBFF][\uDC00-\uDFFF]'; $m = [regex]::Matches($html, $emojiRegex); Write-Host \"Nombre d'emojis trouves : $($m.Count)\" -ForegroundColor Green; } catch { Write-Host \"Erreur lors de l'acces au site : $_\" -ForegroundColor Red }"

echo.
pause
