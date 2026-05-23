@echo off
setlocal
cd /d "%~dp0"

set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"

if not exist "%CHROME%" (
  echo Google Chrome est introuvable.
  pause
  exit /b 1
)

start "Agent impression Poste 2" /min cmd /c node print-agent.js config-poste-2.json
start "Bureau Vallee Poste 2" "%CHROME%" --kiosk --no-first-run --disable-restore-session-state --overscroll-history-navigation=0 "https://bureau-vallee-espace-services.onrender.com/poste-2"
