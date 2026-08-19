@echo off
chcp 65001 > nul
cd /d "%~dp0..\.."
node scripts/sec_scan_secrets.mjs
pause
