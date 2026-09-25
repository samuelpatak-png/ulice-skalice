@echo off
cd /d "%~dp0hra"
echo Ulice Skalice - lokalny server na http://localhost:8080
echo Toto okno nechaj otvorene, kym hras. Zatvorenim hru vypnes.
start "" http://localhost:8080/
where py >nul 2>nul && (py -m http.server 8080 & goto :eof)
where python >nul 2>nul && (python -m http.server 8080 & goto :eof)
where npx >nul 2>nul && (npx --yes http-server -p 8080 -c-1 & goto :eof)
echo.
echo Nenasiel som Python ani Node.js. Nainstaluj Python z https://www.python.org/downloads/
echo (pri instalacii zaskrtni "Add python.exe to PATH") a spusti tento subor znova.
pause
