@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo ========================================================
echo   Москоллектор.НейроКонтур — локальный запуск
echo ========================================================
echo.
echo [1/3] Установка библиотек Python...
python -m pip install -q -r requirements.txt
echo [2/3] Сборка интерфейса (всегда свежая)...
cd frontend
if not exist node_modules call npm.cmd install
call npm.cmd run build
cd ..
echo [3/3] Запуск сервера. Откройте в браузере: http://localhost:8000
echo       Демо-учётка диспетчера: ДИСП-0001, PIN 135790
echo       Остановить: закройте это окно или нажмите Ctrl+C
echo.
set PYTHONPATH=.
set LCT_DEMO_DISPATCHER_PIN=135790
start "" http://localhost:8000
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
pause
