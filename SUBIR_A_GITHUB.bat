@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo ========================================================
echo   SINCRONIZANDO Y SUBIENDO A GITHUB: cholose/mochu
echo ========================================================
echo.
echo 1. Sincronizando lugares de la base de datos hacia data.js...
node sync-data.js
echo.
echo 2. Preparando archivos modificados...
git add .
git commit -m "Actualizar lugares y fotos para celulares y GitHub Pages"
echo.
echo 3. Subiendo a GitHub para actualizar todos los celulares...
git push -u origin main
echo.
if %errorlevel% equ 0 (
    echo ========================================================
    echo   EXITO: Todos los lugares y fotos se subieron a GitHub!
    echo   En 1 o 2 minutos estara visible en todos los celulares:
    echo   https://cholose.github.io/mochu/
    echo ========================================================
) else (
    echo ========================================================
    echo   Si te dio error 403 (Permission denied), ve a:
    echo   Panel de Control ^> Administrador de credenciales
    echo   ^> Credenciales de Windows ^> y busca "git:https://github.com"
    echo   para quitar la cuenta vieja y poner "cholose".
    echo ========================================================
)
echo.
pause
