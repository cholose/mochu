@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo ========================================================
echo   SUBIENDO PROYECTO A GITHUB: cholose/mochu
echo ========================================================
echo.
echo Si te abre una ventana en el navegador, selecciona
echo "Sign in with your browser" e inicia sesion con "cholose".
echo.
git push -u origin main
echo.
if %errorlevel% equ 0 (
    echo ========================================================
    echo   EXITO: Tu proyecto fue subido a GitHub correctamente!
    echo   Repositorio: https://github.com/cholose/mochu
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

