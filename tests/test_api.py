import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

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
    assert ticket["priority"] == "ВЫСОКИЙ"

    # Update ticket status
    t_id = ticket["ticket_id"]
    res_upd = client.patch(f"/api/tickets/{t_id}/status?new_status=В_РАБОТЕ")
    assert res_upd.status_code == 200
    assert res_upd.json()["status"] == "В_РАБОТЕ"

def test_simulation_step():
    res = client.post("/api/simulation/step", json={"scenario_type": "FALSE_ALARM_BURST"})
    assert res.status_code == 200
    step = res.json()
    assert step["scenario_type"] == "FALSE_ALARM_BURST"
    assert step["ml_verdict"] == "FALSE_ALARM"

def test_settings_crud():
    res = client.get("/api/settings")
    assert res.status_code == 200
    cfg = res.json()
    assert 0.05 <= cfg["decision_threshold"] <= 0.95
    assert cfg["require_dispatcher_confirmation"] is True

    # Update threshold
    res_upd = client.post("/api/settings", json={
        "decision_threshold": 0.42,
        "chatter_window_seconds": 90,
        "chatter_min_flips": 5,
        "gas_warning_threshold_vol_pct": 1.2,
        "callout_cost_rub": 18500.0,
        "preventive_cost_rub": 3200.0,
        "require_dispatcher_confirmation": True,
        "auto_suppress_chatter": False
    })
    assert res_upd.status_code == 200
    assert res_upd.json()["decision_threshold"] == 0.42

def test_realtime_score():
    res = client.post("/api/predictions/score", json={
        "channel_id": "120578",
        "cnt_24h": 15,
        "cnt_7d": 80,
        "chatter_cnt": 6,
        "silence_hours": 36.0,
        "battery_glitches": 2
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

