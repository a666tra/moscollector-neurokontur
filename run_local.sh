#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

echo "========================================================"
echo "  Москоллектор.НейроКонтур — локальный запуск"
echo "========================================================"
echo ""

export PYTHONPATH=.
export LCT_DEMO_DISPATCHER_PIN=135790

if [ ! -d ".venv" ]; then
    echo "[0/3] Создание виртуального окружения (.venv)..."
    python3 -m venv .venv
fi
. .venv/bin/activate

echo "[1/3] Установка библиотек Python..."
python3 -m pip install -q -r requirements.txt

echo "[2/3] Сборка интерфейса (всегда свежая)..."
cd frontend
if [ ! -d "node_modules" ]; then
    npm install --silent
fi
npm run build
cd ..

echo "[3/3] Запуск сервера. Откройте в браузере: http://localhost:8000"
echo "      Демо-учётка диспетчера: ДИСП-0001, PIN 135790"
echo "      Остановить: нажмите Ctrl+C"
echo ""

python3 -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
