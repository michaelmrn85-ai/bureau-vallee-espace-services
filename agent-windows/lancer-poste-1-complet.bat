@echo off
setlocal
cd /d "%~dp0"

set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" for /f "delims=" %%i in ('where chrome 2^>nul') do if not exist "%CHROME%" set "CHROME=%%i"

if not exist "%CHROME%" (
  echo Google Chrome est introuvable.
  pause
  exit /b 1
)

start "Agent impression Poste 1" /min cmd /c node print-agent.js config-poste-1.json
start "Bureau Vallee Poste 1" "%CHROME%" --kiosk --no-first-run --disable-restore-session-state --overscroll-history-navigation=0 "https://bureau-vallee-espace-services.onrender.com/poste-1"
