@echo off
echo ================================
echo Diagnostic Bureau Vallee Poste
echo ================================
echo.

echo Imprimantes installees :
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Printer | Select-Object Name,DriverName,PortName | Format-Table -AutoSize"
echo.

echo Node.js :
where node
node --version
echo.

echo SumatraPDF :
if exist "%ProgramFiles%\SumatraPDF\SumatraPDF.exe" echo %ProgramFiles%\SumatraPDF\SumatraPDF.exe
if exist "%ProgramFiles(x86)%\SumatraPDF\SumatraPDF.exe" echo %ProgramFiles(x86)%\SumatraPDF\SumatraPDF.exe
echo.

echo Chrome :
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" echo %ProgramFiles%\Google\Chrome\Application\chrome.exe
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" echo %ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe
echo.

echo Copiez exactement le nom du copieur affiche dans la colonne Name,
echo puis collez-le dans le fichier config-poste-X.json.
echo.
pause
