@echo off
chcp 65001 >nul
echo =========================================================
echo   Director de Canto - Himnario Adventista 2009 (PWA)
echo =========================================================
echo.
echo Iniciando servidor local en el puerto 8080...
echo Abre en tu navegador: http://localhost:8080
echo Para abrirlo en tu celular (conectado al mismo Wi-Fi),
echo usa la direccion IPv4 que aparece abajo seguida de :8080
echo.
ipconfig | findstr /i "IPv4"
echo.
py -m http.server 8080
pause
