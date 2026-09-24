#!/usr/bin/env bash
set -e

echo "========================================================"
echo "  Москоллектор.НейроКонтур — Запуск локального сервера"
echo "========================================================"
echo ""

export PYTHONPATH=.

if [ ! -f "frontend/dist/index.html" ]; then
    echo "[1/2] Frontend не найден. Запуск сборки npm..."
    cd frontend && npm run build && cd ..
fi

echo "[2/2] Запуск FastAPI на http://localhost:8000..."
echo "Swagger UI: http://localhost:8000/docs"
echo "Интерфейс:  http://localhost:8000/"
echo ""
python3 -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
