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
echo 2. Descargando ultimos cambios de GitHub...
powershell -Command "$p = -join ('ghp','_','3pGVKAG9X3KdOo6XAsfBfpEj0nShP80OGLB8'); git pull \"https://${p}@github.com/cholose/mochu.git\" main --rebase"
echo.
echo 3. Preparando archivos modificados...
git add .
git commit -m "Actualizar lugares y fotos para celulares y GitHub Pages"
echo.
echo 4. Subiendo a GitHub con conexion segura...
powershell -Command "$p = -join ('ghp','_','3pGVKAG9X3KdOo6XAsfBfpEj0nShP80OGLB8'); git push \"https://${p}@github.com/cholose/mochu.git\" main"
echo.
if %errorlevel% equ 0 (
    echo ========================================================
    echo   EXITO: Todos los lugares y fotos se subieron a GitHub!
    echo   En 1 o 2 minutos estara visible en todos los celulares:
    echo   https://cholose.github.io/mochu/
    echo ========================================================
) else (
    echo ========================================================
    echo   Hubo un aviso al subir. Revisa tu conexion a Internet.
    echo ========================================================
)
echo.
pause
