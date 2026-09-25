import os
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

@pytest.fixture(autouse=True, scope="session")
def isolate_test_state():
    """Сохраняет исходное состояние баз данных до тестов и восстанавливает их после завершения."""
    files_to_backup = [
        "backend/data/tickets_db.json",
        "backend/data/confirmed_alarms.json",
        "backend/data/system_settings.json"
    ]
    backups = {}
    for f in files_to_backup:
        if os.path.exists(f):
            with open(f, "r", encoding="utf-8") as fp:
                backups[f] = fp.read()

    yield

    # Восстановление оригинальных файлов без тестовых записей
    for f, content in backups.items():
        try:
            with open(f, "w", encoding="utf-8") as fp:
                fp.write(content)
        except Exception:
            pass

def test_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "online"
    assert "825.0 км" in data["monitored_infrastructure"]

def test_stats_summary():
    res = client.get("/api/stats/summary")
    assert res.status_code == 200
    data = res.json()
    assert data["monitored_km"] == 825.0
    assert data["total_objects"] == 95
    assert data["model_roc_auc"] >= 0.70
    assert data["inference_latency_ms"] < 300.0
    assert data["annual_projected_opex_rub"] > 1000000.0

def test_objects_list():
    res = client.get("/api/objects")
    assert res.status_code == 200
    objects = res.json()
    assert len(objects) == 95
    first = objects[0]
    assert "object_id" in first
    assert "lat" in first
    assert "picket" in first

def test_object_detail():
    res = client.get("/api/objects/5122")
    assert res.status_code == 200
    detail = res.json()
    assert detail["object_id"] == "5122"
    assert "sensors" in detail

def test_network_geojson():
    res = client.get("/api/objects/geojson/network")
    assert res.status_code == 200
    geo = res.json()
    assert geo["type"] == "FeatureCollection"
    assert len(geo["features"]) > 0

def test_predictions():
    res = client.get("/api/predictions?limit=10")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] > 0
    assert len(data["items"]) == 10
    first = data["items"][0]
    assert 0.0 <= first["failure_probability"] <= 1.0
    assert first["risk_level"] in ("NORMAL", "ATTENTION", "WARNING", "CRITICAL")

def test_false_alarm_classification():
    # Rapid chatter case -> should diagnose as FALSE_ALARM
    res = client.post("/api/alarms/classify", json={
        "channel_id": "120578",
        "current_value": "Замкнут",
        "recent_events_count_1h": 6,
        "recent_flips_count_1h": 5,
        "duration_minutes": 1.2
    })
    assert res.status_code == 200
    data = res.json()
    assert data["is_false_alarm"] is True
    assert data["verdict"] == "FALSE_ALARM"
    assert data["avoided_callout_cost_rub"] > 0

def test_real_risk_classification():
    # High methane case -> should diagnose as REAL_RISK
    res = client.post("/api/alarms/classify", json={
        "channel_id": "8808",
        "current_value": "5.40",
        "recent_events_count_1h": 2,
        "recent_flips_count_1h": 0,
        "duration_minutes": 10.0
    })
    assert res.status_code == 200
    data = res.json()
    assert data["is_false_alarm"] is False
    assert data["verdict"] == "REAL_RISK"

def test_tickets_crud():
    # Get existing tickets
    res = client.get("/api/tickets")
    assert res.status_code == 200
    initial_count = len(res.json())
    assert initial_count > 0

    # Generate a ticket
    res_gen = client.post("/api/tickets/generate", json={
        "channel_id": "120504",
        "priority": "ВЫСОКИЙ",
        "notes": "Тестовая превентивная заявка"
    })
    assert res_gen.status_code == 200
    ticket = res_gen.json()
    assert "ticket_id" in ticket
    assert ticket["channel_id"] == "120504"

def test_simulation_step():
    res = client.post("/api/simulation/step", json={"scenario_type": "GAS_SPIKE", "channel_id": "8808"})
    assert res.status_code == 200
    data = res.json()
    assert data["channel_id"] == "8808"
    assert data["ml_verdict"] == "REAL_RISK"

def test_settings_crud():
    # Read current settings
    res = client.get("/api/settings")
    assert res.status_code == 200
    original_thresh = res.json()["decision_threshold"]

    # Update threshold to 0.45
    res_update = client.post("/api/settings", json={
        "decision_threshold": 0.45,
        "chatter_window_seconds": 90,
        "chatter_min_flips": 5,
        "gas_warning_threshold_vol_pct": 1.2,
        "callout_cost_rub": 18500.0,
        "preventive_cost_rub": 3200.0,
        "require_dispatcher_confirmation": True,
        "auto_suppress_chatter": False
    })
    assert res_update.status_code == 200
    assert res_update.json()["decision_threshold"] == 0.45

    # Check that predictions endpoint immediately sees the new threshold
    res_preds = client.get("/api/predictions?limit=5")
    assert res_preds.status_code == 200
    assert res_preds.json()["active_threshold"] == 0.45

def test_realtime_score():
    res = client.post("/api/predictions/score", json={
        "channel_id": "120578",
        "cnt_24h": 0,
        "cnt_7d": 80,
        "chatter_cnt": 6,
        "silence_hours": 36.0,
        "battery_glitches": 2,
        "mean_val": 0.0,
        "std_val": 0.0
    })
    assert res.status_code == 200
    data = res.json()
    assert data["channel_id"] == "120578"
    assert 0.0 <= data["failure_probability"] <= 1.0
    assert data["inference_latency_ms"] >= 0.0
    assert len(data["top_factors"]) > 0

def test_alarm_confirmation():
    res = client.post("/api/alarms/confirm", json={
        "channel_id": "120578",
        "decision": "CONFIRM_FALSE_ALARM",
        "dispatcher_badge": "7041-ОДС",
        "notes": "Подтвержден дребезг концевика люка"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "SUPPRESSED_CONFIRMED"
    assert data["avoided_cost_rub"] == 18500.0

def test_benchmark_endpoint():
    res = client.get("/api/predictions/benchmark")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "verified"
    assert "benchmark" in data

def test_predictions_metrics():
    res = client.get("/api/predictions/metrics")
    assert res.status_code == 200
    data = res.json()
    assert "model_comparison" in data
    assert "champion_lightgbm" in data["model_comparison"]
    assert "logistic_regression" in data["model_comparison"]
    assert "random_forest" in data["model_comparison"]
    assert "http_load_benchmark" in data
    assert data["http_load_benchmark"]["success_rate_pct"] == 100.0

def test_multimodel_scoring():
    for model in ["champion_lightgbm", "logistic_regression", "random_forest"]:
        res = client.post("/api/predictions/score", json={
            "channel_id": "120578",
            "cnt_24h": 5,
            "cnt_7d": 40,
            "chatter_cnt": 3,
            "silence_hours": 10.0,
            "battery_glitches": 1,
            "model_name": model
        })
        assert res.status_code == 200
        data = res.json()
        assert data["channel_id"] == "120578"
        assert 0.0 <= data["failure_probability"] <= 1.0
        assert data["model_used"] == model

def test_audit_chain_integrity():
    res = client.get("/api/alarms/audit/verify")
    assert res.status_code == 200
    data = res.json()
    assert data["is_valid"] is True
    assert data["tamper_detected"] is False
    assert data["total_records"] >= 4
    assert len(data["head_hash"]) == 64
    assert "ГОСТ Р 53195" in data["standard"]

def test_dispatcher_rbac_security():
    # 1. Authorized badge should succeed and chain cryptographic block
    res_ok = client.post("/api/alarms/confirm", json={
        "channel_id": "120578",
        "decision": "CONFIRM_FALSE_ALARM",
        "dispatcher_badge": "ДИСП-7041",
        "notes": "Штатная проверка регламента КИИ"
    })
    assert res_ok.status_code == 200
    data_ok = res_ok.json()
    assert data_ok["dispatcher_badge"] == "ДИСП-7041"
    assert "Кузнецов" in data_ok.get("dispatcher_name", "")
    assert len(data_ok["record_hash"]) == 64
    assert len(data_ok["prev_hash"]) == 64

    # 2. Unauthorized badge must be rejected with 403 Forbidden
    res_bad = client.post("/api/alarms/confirm", json={
        "channel_id": "120578",
        "decision": "CONFIRM_FALSE_ALARM",
        "dispatcher_badge": "ДИСП-9999",
        "notes": "Попытка несанкционированного доступа"
    })
    assert res_bad.status_code == 403
    assert "Отказ в авторизации" in res_bad.json()["detail"]

def test_real_recent_alarms_stream():
    res = client.get("/api/alarms/recent")
    assert res.status_code == 200
    events = res.json()
    assert len(events) > 0
    first = events[0]
    assert "event_id" in first
    assert "channel_id" in first
    assert "raw_value" in first
    assert "СМВУ" in first.get("provenance", "")
