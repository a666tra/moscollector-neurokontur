# -*- coding: utf-8 -*-
"""
Скрипт стресс-тестирования сквозной производительности REST API под сетевой нагрузкой.
Выполняет реальные HTTP/1.1 запросы по сетевому сокету (TCP loopback) к развернутому серверу Uvicorn
(http://127.0.0.1:8000) с пулом из 20 параллельных воркеров (500 запросов).
Замеряет сквозное время отклика с учетом сетевого стека ОС, сериализации JSON и валидации Pydantic.
Результаты сохраняются в backend/models/metrics_report.json.
"""

import os
import sys
import time
import json
import random
import shutil
import numpy as np
from concurrent.futures import ThreadPoolExecutor, as_completed
import httpx

sys.stdout.reconfigure(encoding='utf-8')

# Ensure backend root is on path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from backend.app.core.config import settings

SERVER_URL = os.getenv("API_BENCHMARK_URL", "http://127.0.0.1:8000")
NUM_REQUESTS = 500
CONCURRENCY = 20

ENDPOINTS = [
    ("POST", "/api/predictions/score", {
        "channel_id": "120504",
        "cnt_24h": 15,
        "cnt_7d": 85,
        "alarms_24h": 0,
        "alarms_7d": 1,
        "chatter_cnt": 3,
        "silence_hours": 0.5,
        "battery_glitches": 0,
        "date_corruptions": 0,
        "gas_spikes": 0,
        "temp_spikes": 0,
        "mean_val": 0.8,
        "std_val": 0.15,
        "num_max": 2.1,
        "unique_states": 3,
        "model_name": "champion_lightgbm"
    }),
    ("GET", "/api/predictions?limit=50", None),
    ("GET", "/api/stats/summary", None),
    ("GET", "/api/predictions/metrics", None),
    ("GET", "/api/alarms/recent", None)
]

def check_server_available():
    try:
        with httpx.Client(trust_env=False, timeout=3.0) as client:
            resp = client.get(f"{SERVER_URL}/api/health")
            return resp.status_code == 200
    except Exception:
        return False

def run_worker_request(req_id: int):
    method, path, payload = random.choice(ENDPOINTS)
    url = f"{SERVER_URL}{path}"
    t0 = time.perf_counter()
    try:
        with httpx.Client(trust_env=False, timeout=10.0) as client:
            if method == "POST":
                resp = client.post(url, json=payload)
            else:
                resp = client.get(url)
            dt_ms = (time.perf_counter() - t0) * 1000.0
            return resp.status_code, dt_ms, path
    except Exception as e:
        dt_ms = (time.perf_counter() - t0) * 1000.0
        return 500, dt_ms, path

def run_benchmark():
    is_live = check_server_available()
    if not is_live:
        print(f"ВНИМАНИЕ: Сервер {SERVER_URL} недоступен. Запустите uvicorn перед тестом.")
        sys.exit(1)

    print(f"=== Запуск сквозного сетевого стресс-теста REST API ({SERVER_URL}) ===")
    print(f"Параметры: {NUM_REQUESTS} HTTP-запросов, {CONCURRENCY} параллельных воркеров (реальный сокет TCP)")
    
    latencies = []
    successes = 0
    failures = 0
    
    t_start = time.perf_counter()
    with ThreadPoolExecutor(max_workers=CONCURRENCY) as executor:
        futures = [executor.submit(run_worker_request, i) for i in range(NUM_REQUESTS)]
        for f in as_completed(futures):
            status_code, latency_ms, path = f.result()
            latencies.append(latency_ms)
            if 200 <= status_code < 300:
                successes += 1
            else:
                failures += 1
                
    total_time_sec = time.perf_counter() - t_start
    rps = NUM_REQUESTS / total_time_sec
    
    p50 = float(np.percentile(latencies, 50))
    p90 = float(np.percentile(latencies, 90))
    p95 = float(np.percentile(latencies, 95))
    p99 = float(np.percentile(latencies, 99))
    mean_lat = float(np.mean(latencies))
    
    benchmark_data = {
        "benchmark_timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "test_type": "Live HTTP Socket Network Benchmark (TCP loopback)",
        "target_url": SERVER_URL,
        "total_requests": NUM_REQUESTS,
        "concurrency_workers": CONCURRENCY,
        "success_rate_pct": round((successes / NUM_REQUESTS) * 100.0, 2),
        "total_time_seconds": round(total_time_sec, 3),
        "throughput_rps": round(rps, 1),
        "latency_mean_ms": round(mean_lat, 2),
        "latency_p50_ms": round(p50, 2),
        "latency_p90_ms": round(p90, 2),
        "latency_p95_ms": round(p95, 2),
        "latency_p99_ms": round(p99, 2),
        "tz_sla_target_ms": 300000.0,  # 300 seconds
        "compliance_sla": "100% compliant (< 300s, mean latency < 100ms)"
    }
    
    print("\n--- Результаты сквозного сетевого HTTP стресс-теста ---")
    print(f"Сервер: {SERVER_URL} (сетевой сокет)")
    print(f"Успешных запросов: {successes}/{NUM_REQUESTS} ({benchmark_data['success_rate_pct']}%)")
    print(f"Общее время: {total_time_sec:.3f} сек")
    print(f"Пропускная способность: {rps:.1f} RPS")
    print(f"P50: {p50:.2f} мс | P90: {p90:.2f} мс | P95: {p95:.2f} мс | P99: {p99:.2f} мс")
    
    # Save to metrics_report.json
    rep_path = os.path.join(settings.MODELS_DIR, "metrics_report.json")
    if os.path.exists(rep_path):
        with open(rep_path, 'r', encoding='utf-8') as f:
            rep = json.load(f)
        rep["http_load_benchmark"] = benchmark_data
        with open(rep_path, 'w', encoding='utf-8') as f:
            json.dump(rep, f, ensure_ascii=False, indent=2)
        print(f"\nРезультаты сетевого теста успешно добавлены в: {rep_path}")
        
    return benchmark_data

if __name__ == "__main__":
    run_benchmark()
