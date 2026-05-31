@echo off
chcp 65001 >nul
title פריצת דרך - שרת מקומי
cd /d "%~dp0"

echo.
echo ====================================================
echo   פריצת דרך - מפעיל את האתר בשרת מקומי
echo ====================================================
echo.

set "PY=C:\Program Files\Python313\python.exe"
if not exist "%PY%" set "PY=python"

echo פותח את האתר בדפדפן...
start "" "http://127.0.0.1:8000/index.html"

echo.
echo האתר זמין בכתובת:  http://127.0.0.1:8000/index.html
echo.
echo כדי לעצור את השרת - סגרו את החלון הזה.
echo.

"%PY%" -m http.server 8000 --bind 127.0.0.1
pause
