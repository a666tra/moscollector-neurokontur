@echo off
chcp 65001 > nul
echo ========================================================
echo   Москоллектор.НейроКонтур — Запуск локального сервера
echo ========================================================
echo.

set PYTHONPATH=.
echo [1/2] Проверка собранного интерфейса frontend/dist...
if not exist "frontend\dist\index.html" (
    echo Frontend не собран. Запускаем сборку...
    cd frontend && call npm.cmd run build && cd ..
)

echo [2/2] Запуск FastAPI веб-сервера на http://localhost:8000...
echo.
echo Документация Swagger: http://localhost:8000/docs
echo Ситуационный Центр:  http://localhost:8000/
echo.
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
pause
