import os
import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.app.main import app
from backend.app.api.synthetic import filter_debounce_events

client = TestClient(app)


def test_synthetic_sample_endpoint():
    response = client.get("/api/synthetic/sample?limit=25")
    assert response.status_code == 200
    data = response.json()
    assert data["is_synthetic"] is True
    assert data["total_rows"] == 1000
    assert data["preview_limit"] == 25
    assert len(data["rows"]) == 25

    first = data["rows"][0]
    assert "event_id" in first
    assert "channel_id" in first
    assert "date" in first
    assert "time" in first
    assert "is_alarm" in first
    assert "value" in first
    assert isinstance(first["is_alarm"], bool)
    assert isinstance(first["value"], float)


def test_synthetic_evaluate_endpoint_default():
    response = client.post("/api/synthetic/evaluate", json={
        "threshold": 0.42,
        "debounce_window_sec": 300,
        "model_name": "champion_lightgbm"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["is_synthetic"] is True
    assert data["total_telemetry_rows"] == 1000
    assert data["unique_channels_evaluated"] > 0
    assert data["model_used"] == "champion_lightgbm"
    assert data["debounce_window_sec"] == 300
    assert "risk_distribution" in data
    assert "high" in data["risk_distribution"]
    assert "medium" in data["risk_distribution"]
    assert "low" in data["risk_distribution"]
    assert data["risk_distribution"]["high"] > 0

    assert "alarms_by_subsystem" in data
    for sub in [
        "Метан (CH4)",
        "Угарный газ (CO)",
        "Затопление",
        "Температура кабелей",
        "Охранный периметр",
    ]:
        assert sub in data["alarms_by_subsystem"]
        assert data["alarms_by_subsystem"][sub] > 0

    assert data["processing_latency_ms"] > 0.0
    assert data["debounced_alarms_count"] > 0
    assert "disclaimer" in data
    assert "Синтетический демонстрационный датасет" in data["disclaimer"]


def test_synthetic_evaluate_threshold_sensitivity():
    # Strict threshold
    res_strict = client.post("/api/synthetic/evaluate", json={
        "threshold": 0.85,
        "debounce_window_sec": 300
    })
    assert res_strict.status_code == 200
    high_strict = res_strict.json()["risk_distribution"]["high"]

    # Permissive threshold
    res_perm = client.post("/api/synthetic/evaluate", json={
        "threshold": 0.25,
        "debounce_window_sec": 300
    })
    assert res_perm.status_code == 200
    high_perm = res_perm.json()["risk_distribution"]["high"]

    assert high_perm >= high_strict


def test_debounce_filter_explicit_scenarios():
    """
    Проверка фильтра дребезга контактов на 5 явных физических сценариях:
    1. Одиночный импульс (0 подавлено).
    2. Два события внутри окна (1 подавлено).
    3. Два события вне окна (0 подавлено).
    4. Граничное время dt == debounce_window_sec (1 подавлено).
    5. Отсутствие тревог (0 подавлено).
    """
    window = 300.0

    # 1. Одиночный импульс (0 подавлено)
    assert filter_debounce_events([1000.0], window) == 0

    # 2. Два события внутри окна dt = 150 < 300 (1 подавлено)
    assert filter_debounce_events([1000.0, 1150.0], window) == 1

    # 3. Два события вне окна dt = 400 > 300 (0 подавлено)
    assert filter_debounce_events([1000.0, 1400.0], window) == 0

    # 4. Граничное время dt == debounce_window_sec (1 подавлено)
    assert filter_debounce_events([1000.0, 1300.0], window) == 1

    # 5. Отсутствие тревог (0 подавлено)
    assert filter_debounce_events([], window) == 0

    # Дополнительно: серия из 4 дребезговых импульсов в пределах окна
    assert filter_debounce_events([100.0, 120.0, 140.0, 170.0], 50.0) == 3


def test_synthetic_multimodel_scoring():
    """Проверка мультимодельного скоринга на синтетическом датасете."""
    models = ["champion_lightgbm", "logistic_regression", "random_forest"]

    for model in models:
        res = client.post("/api/synthetic/evaluate", json={
            "threshold": 0.42,
            "debounce_window_sec": 300,
            "model_name": model
        })
        assert res.status_code == 200
        data = res.json()
        assert data["model_used"] == model
        assert "risk_distribution" in data
        assert sum(data["risk_distribution"].values()) == data["unique_channels_evaluated"]
        assert len(data["high_risk_candidates"]) <= 10


def test_debounced_alarms_count_depends_on_window():
    """Проверка реальной математической и физической зависимости debounced_alarms_count от debounce_window_sec."""
    windows = [30, 60, 120, 300, 600]
    suppressed_counts = []

    for w in windows:
        res = client.post("/api/synthetic/evaluate", json={
            "threshold": 0.42,
            "debounce_window_sec": w,
            "model_name": "champion_lightgbm"
        })
        assert res.status_code == 200
        data = res.json()
        suppressed_counts.append(data["debounced_alarms_count"])

    # Проверка строгой физической монотонности и реального роста
    for i in range(len(suppressed_counts) - 1):
        assert suppressed_counts[i] <= suppressed_counts[i + 1]

    # Проверка строгого роста между минимальным и максимальным окнами
    assert suppressed_counts[0] < suppressed_counts[1] < suppressed_counts[3] < suppressed_counts[4]
    assert suppressed_counts[0] == 12  # окно 30 сек
    assert suppressed_counts[1] == 18  # окно 60 сек
    assert suppressed_counts[3] == 38  # окно 300 сек
    assert suppressed_counts[4] == 45  # окно 600 сек


def test_synthetic_invalid_model_rejection():
    """Проверка блокировки запроса с несуществующей ML-моделью (HTTP 400)."""
    res = client.post("/api/synthetic/evaluate", json={
        "threshold": 0.42,
        "debounce_window_sec": 300,
        "model_name": "unsupported_neural_net"
    })
    assert res.status_code == 400
    assert "Недопустимая ML-модель" in res.json()["detail"]


def test_synthetic_window_boundary_rejection():
    """Проверка валидации границ временного окна дребезга [30, 3600] сек (HTTP 422)."""
    # Меньше 30 сек
    res_low = client.post("/api/synthetic/evaluate", json={
        "threshold": 0.42,
        "debounce_window_sec": 15
    })
    assert res_low.status_code == 422

    # Больше 3600 сек
    res_high = client.post("/api/synthetic/evaluate", json={
        "threshold": 0.42,
        "debounce_window_sec": 7200
    })
    assert res_high.status_code == 422


def test_parse_event_timestamp_edge_cases():
    """Проверка устойчивости парсера меток времени к поврежденным и некорректным данным."""
    from backend.app.api.synthetic import parse_event_timestamp

    # Корректный штамп
    ts = parse_event_timestamp("2026-01-28", "12:00:00")
    assert ts > 0.0

    # Корректный штамп с микросекундами
    ts_ms = parse_event_timestamp("2026-01-28", "12:00:00.123456")
    assert ts_ms > 0.0

    # Поврежденная дата
    assert parse_event_timestamp("corrupt-date", "12:00:00") == 0.0

    # Пустые поля
    assert parse_event_timestamp("", "") == 0.0

    # Несуществующее время
    assert parse_event_timestamp("2026-01-28", "99:99:99") == 0.0


def test_debounce_affects_candidate_actions_and_scores():
    """
    Проверка реального влияния фильтрации дребезга на статус,
    рекомендованные действия и эффективный подсчет тревог кандидатов.
    """
    res = client.post("/api/synthetic/evaluate", json={
        "threshold": 0.10,
        "debounce_window_sec": 300,
        "model_name": "champion_lightgbm"
    })
    assert res.status_code == 200
    data = res.json()

    candidates = data["high_risk_candidates"]
    assert len(candidates) > 0

    # Проверка наличия кандидатов с подавленным дребезгом
    debounced_candidates = [c for c in candidates if c.get("debounced_chatter_count", 0) > 0]
    assert len(debounced_candidates) > 0

    first_debounced = debounced_candidates[0]
    assert first_debounced["status"] == "REQUIRES_DISPATCH_DEBOUNCED"
    assert "Подавлен дребезг" in first_debounced["recommended_action"]
    assert first_debounced["effective_alarms_count"] == (
        first_debounced["alarm_events_count"] - first_debounced["debounced_chatter_count"]
    )
    assert "calibrated_probability" in first_debounced
    assert first_debounced["calibrated_probability"] <= first_debounced["risk_score"]


def test_multimodel_scores_differ():
    """
    Проверка, что вызов разных ML-моделей на одном и том же синтетическом срезе
    приводит к различным прогнозам (подтверждение отсутствия заглушки или подмены).
    """
    res_lgb = client.post("/api/synthetic/evaluate", json={
        "threshold": 0.30,
        "debounce_window_sec": 300,
        "model_name": "champion_lightgbm"
    }).json()

    res_lr = client.post("/api/synthetic/evaluate", json={
        "threshold": 0.30,
        "debounce_window_sec": 300,
        "model_name": "logistic_regression"
    }).json()

    # Логистическая регрессия имеет иную калибровку и распределение риска
    assert res_lgb["risk_distribution"] != res_lr["risk_distribution"]
    assert res_lgb["model_used"] == "champion_lightgbm"
    assert res_lr["model_used"] == "logistic_regression"
