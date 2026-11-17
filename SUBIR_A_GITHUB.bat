@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo ========================================================
echo   SUBIENDO PROYECTO A GITHUB: cholose/mochu
echo ========================================================
echo.
echo 1. Guardando cambios y lugares nuevos...
git add .
git commit -m "Actualizar lugares y datos de la app"
echo.
echo 2. Subiendo a GitHub Pages para todos los celulares...
git push -u origin main
echo.
if %errorlevel% equ 0 (
    echo ========================================================
    echo   EXITO: Tu proyecto fue subido a GitHub correctamente!
    echo   Tus lugares nuevos ya estan visibles en los celulares.
    echo   Web Turistas: https://cholose.github.io/mochu/
    echo   Panel Admin:  https://cholose.github.io/mochu/admin.html
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

