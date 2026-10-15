@echo off
setlocal
set "PORT=8000"

rem Localiza o php.exe no PATH
set "PHPEXE="
for /f "delims=" %%p in ('where php 2^>nul') do (
  if not defined PHPEXE set "PHPEXE=%%p"
)

if not defined PHPEXE (
  echo [erro] PHP nao encontrado no PATH. Instale o PHP e adicione ao PATH.
  pause
  exit /b 1
)

for %%d in ("%PHPEXE%") do set "PHPDIR=%%~dpd"

echo Iniciando o servidor PHP em http://localhost:%PORT% ...
echo Pressione Ctrl+C para encerrar.
echo.

"%PHPEXE%" -d extension_dir="%PHPDIR%ext" -d extension=openssl -S localhost:%PORT% -t "%~dp0"
