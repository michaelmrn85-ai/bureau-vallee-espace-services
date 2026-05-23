@echo off
taskkill /IM chrome.exe /F >nul 2>&1
call "%~dp0lancer-poste-1-complet.bat"
