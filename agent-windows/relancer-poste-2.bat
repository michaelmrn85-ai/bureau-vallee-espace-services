@echo off
taskkill /IM chrome.exe /F >nul 2>&1
call "%~dp0lancer-poste-2-complet.bat"
