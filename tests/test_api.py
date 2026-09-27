import os
import sys
import json
import hashlib
import importlib.util
import secrets
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import pytest
from fastapi.testclient import TestClient

# Every test process owns a fresh local registry and audit ledger. Credentials are
# random per run so no project/demo PIN is embedded in the test suite.
_test_state = tempfile.TemporaryDirectory(prefix="lct-api-tests-")
_test_state_path = _test_state.name
TEST_DISPATCHER_BADGE = f"ДИСП-{secrets.randbelow(10000):04d}"
TEST_DISPATCHER_PIN = f"{secrets.randbelow(1_000_000):06d}"
_pin_salt = secrets.token_bytes(16)
_pin_digest = hashlib.pbkdf2_hmac(
    "sha256", TEST_DISPATCHER_PIN.encode("utf-8"), _pin_salt, 600_000, dklen=32
)
_registry_path = os.path.join(_test_state_path, "authorized_dispatchers.json")
with open(_registry_path, "w", encoding="utf-8") as _registry_file:
    json.dump({
        TEST_DISPATCHER_BADGE: {
            "badge": TEST_DISPATCHER_BADGE,
            "full_name": "Automated Test Dispatcher",
            "role": "Test operator",
            "clearance_level": 3,
            "pin_hash": f"pbkdf2_sha256$600000${_pin_salt.hex()}${_pin_digest.hex()}",
            "can_confirm_false_alarm": True,
            "can_force_dispatch": True,
        }
    }, _registry_file)
os.environ["LCT_DISPATCHER_REGISTRY_PATH"] = _registry_path
os.environ["LCT_CONFIRMED_ALARMS_PATH"] = os.path.join(_test_state_path, "confirmed_alarms.json")
with open(os.environ["LCT_CONFIRMED_ALARMS_PATH"], "w", encoding="utf-8") as _audit_file:
    json.dump([], _audit_file)

from backend.app.main import app

client = TestClient(app)

def require_dispatcher_credentials():
    return TEST_DISPATCHER_BADGE, TEST_DISPATCHER_PIN


def different_pin(pin):
    return f"{(int(pin) + 1) % 1000000:06d}"


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
    assert data["false_alarms_filtered_ratio"] is None
    assert data["financial_evidence_status"] == "SCENARIO_ONLY_NO_VERIFIED_SAVINGS"

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


def test_legacy_prediction_does_not_claim_calibration(monkeypatch):
    """An old cache record must not acquire a calibrated probability by default."""
    from backend.app.services.data_service import data_service

    legacy = {
        "channel_id": "legacy-1", "object_id": "legacy-object",
        "object_name": "Тестовый объект", "sensor_name": "Тестовый датчик",
        "sensor_type": "СМВУ", "system_type": "Мониторинг", "tag": "TEST",
        "failure_probability": 0.8, "risk_level": "CRITICAL",
        "is_predicted_failure_24h": True, "recommended_action": "Проверить",
        "explanation_factors": [],
    }
    monkeypatch.setattr(data_service, "predictions", [legacy])
    monkeypatch.setattr(data_service, "predictions_by_channel", {"legacy-1": legacy})
    res = client.get("/api/predictions?limit=1")
    assert res.status_code == 200
    item = res.json()["items"][0]
    assert item["raw_model_score"] == 0.8
    assert item["calibrated_proxy_probability"] is None
    assert item["is_calibrated"] is False
    assert item["calibration_status"] == "CALIBRATION_UNAVAILABLE"
    detail = client.get("/api/predictions/legacy-1")
    assert detail.status_code == 200
    assert detail.json()["is_calibrated"] is False
    assert detail.json()["risk_level"] == item["risk_level"]

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
    res = client.get("/api/tickets")
    assert res.status_code == 200
    initial_count = len(res.json())
    assert initial_count > 0
    assert client.get("/api/tickets?status=UNKNOWN").status_code == 422

    unauth = client.post("/api/tickets/generate", json={"channel_id": "120504"})
    assert unauth.status_code == 401
    assert len(client.get("/api/tickets").json()) == initial_count
    invalid_channel = client.post("/api/tickets/generate", json={"channel_id": "sensor-1"})
    assert invalid_channel.status_code == 422

    badge, pin = require_dispatcher_credentials()
    invalid_priority = client.post("/api/tickets/generate", json={
        "channel_id": "120504", "priority": "URGENT",
        "dispatcher_badge": badge, "dispatcher_pin": pin
    })
    assert invalid_priority.status_code == 422

    unknown_channel = client.post("/api/tickets/generate", json={
        "channel_id": "9999999999",
        "dispatcher_badge": badge, "dispatcher_pin": pin
    })
    assert unknown_channel.status_code == 404

    res_gen = client.post("/api/tickets/generate", json={
        "channel_id": "120504",
        "priority": "ВЫСОКИЙ",
        "notes": "Тестовая превентивная заявка",
        "dispatcher_badge": badge,
        "dispatcher_pin": pin
    })
    assert res_gen.status_code == 200
    ticket = res_gen.json()
    assert ticket["channel_id"] == "120504"
    assert ticket["created_by"] == badge

    no_auth_status = client.patch(
        f"/api/tickets/{ticket['ticket_id']}/status",
        json={"new_status": "ВЫПОЛНЕН"}
    )
    assert no_auth_status.status_code == 401

    bad_status = client.patch(
        f"/api/tickets/{ticket['ticket_id']}/status",
        json={"new_status": "CLOSED", "dispatcher_badge": badge, "dispatcher_pin": pin}
    )
    assert bad_status.status_code == 422

    updated = client.patch(
        f"/api/tickets/{ticket['ticket_id']}/status",
        json={"new_status": "В_РАБОТЕ", "dispatcher_badge": badge, "dispatcher_pin": pin}
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "В_РАБОТЕ"


def test_simulation_step():
    from backend.app.services.maintenance_service import maintenance_service

    before_count = len(maintenance_service.tickets)
    unauth = client.post("/api/simulation/step", json={
        "scenario_type": "GAS_SPIKE", "channel_id": "8808"
    })
    assert unauth.status_code == 401
    assert len(maintenance_service.tickets) == before_count

    safe_demo = client.post("/api/simulation/step", json={
        "scenario_type": "FALSE_ALARM_BURST", "channel_id": "120578"
    })
    assert safe_demo.status_code == 200
    assert safe_demo.json()["ticket_created"] is False
    assert safe_demo.json()["avoided_callout_rub"] == 0.0
    assert safe_demo.json()["scenario_potential_rub"] > 0

    invalid_scenario = client.post("/api/simulation/step", json={"scenario_type": "UNKNOWN"})
    assert invalid_scenario.status_code == 422

    badge, pin = require_dispatcher_credentials()
    authorized = client.post("/api/simulation/step", json={
        "scenario_type": "GAS_SPIKE", "channel_id": "8808",
        "dispatcher_badge": badge, "dispatcher_pin": pin
    })
    assert authorized.status_code == 200
    assert authorized.json()["channel_id"] == "8808"
    assert authorized.json()["ticket_created"] is True
    assert authorized.json()["ticket_id"]
    assert authorized.json()["ticket_persisted"] is False
    assert len(maintenance_service.tickets) == before_count


def test_settings_crud():
    res = client.get("/api/settings")
    assert res.status_code == 200

    base_settings = {
        "decision_threshold": 0.45,
        "chatter_window_seconds": 90,
        "chatter_min_flips": 5,
        "gas_warning_threshold_vol_pct": 1.2,
        "callout_cost_rub": 18500.0,
        "preventive_cost_rub": 3200.0,
        "require_dispatcher_confirmation": True,
        "auto_suppress_chatter": False,
        "selected_model": "champion_lightgbm"
    }
    unauth = client.post("/api/settings", json=base_settings)
    assert unauth.status_code == 401

    badge, pin = require_dispatcher_credentials()
    updated = client.post("/api/settings", json={
        **base_settings, "dispatcher_badge": badge, "dispatcher_pin": pin
    })
    assert updated.status_code == 200
    assert updated.json()["decision_threshold"] == 0.45

    predictions = client.get("/api/predictions?limit=5")
    assert predictions.status_code == 200
    assert predictions.json()["active_threshold"] == 0.45

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
    badge, pin = require_dispatcher_credentials()
    res = client.post("/api/alarms/confirm", json={
        "channel_id": "120578",
        "decision": "CONFIRM_FALSE_ALARM",
        "dispatcher_badge": badge,
        "dispatcher_pin": pin,
        "notes": "Проверка подтверждения тревоги"
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

def test_metrics_report_invariants():
    res = client.get("/api/predictions/metrics")
    assert res.status_code == 200
    data = res.json()

    # 1. Наличие хеша входных данных и команды воспроизведения
    assert "feature_cache_sha256" in data
    assert len(data["feature_cache_sha256"]) == 64
    assert data["feature_cache_sha256"] == "65871b3b0f57eb1814b9a5245d8e67db459b7d121ebd8accbb4bb57c455aaa33"
    assert "reproduction_command" in data
    assert "reproduce_metrics.py" in data["reproduction_command"]
    assert "limitations_disclaimer" in data

    # 2. Корректность и воспроизводимость Brier и ECE (значения в диапазоне [0, 1])
    assert "calibration_metrics" in data
    calib = data["calibration_metrics"]
    assert 0.0 <= calib["brier_score_baseline"] <= 1.0
    assert calib["brier_score_baseline"] == pytest.approx(0.01496, abs=1e-4)

    for m_key in ["champion_lightgbm", "logistic_regression", "random_forest"]:
        assert m_key in calib
        assert 0.0 <= calib[m_key]["brier_score"] <= 1.0
        assert 0.0 <= calib[m_key]["expected_calibration_error_ece"] <= 1.0

    # Проверка калиброванного и некалиброванного LightGBM
    lgbm_calib = calib["champion_lightgbm"]
    assert lgbm_calib["brier_score"] == pytest.approx(0.01381, abs=1e-4)
    assert lgbm_calib["brier_score_raw"] == pytest.approx(0.04508, abs=1e-4)
    assert lgbm_calib["expected_calibration_error_ece"] == pytest.approx(0.00829, abs=1e-4)
    assert lgbm_calib["expected_calibration_error_ece_raw"] == pytest.approx(0.06816, abs=1e-4)
    # Калиброванная модель строго превосходит константный baseline
    assert lgbm_calib["brier_score"] < calib["brier_score_baseline"]

    assert calib["logistic_regression"]["brier_score"] == pytest.approx(0.19442, abs=1e-4)
    assert calib["logistic_regression"]["expected_calibration_error_ece"] == pytest.approx(0.36732, abs=1e-4)
    assert calib["random_forest"]["brier_score"] == pytest.approx(0.05681, abs=1e-4)
    assert calib["random_forest"]["expected_calibration_error_ece"] == pytest.approx(0.15106, abs=1e-4)

    # 3. Совпадение сумм разбивки по подсистемам с общей confusion matrix (динамические инварианты)
    assert "subsystem_error_breakdown" in data
    breakdown = data["subsystem_error_breakdown"]
    assert "subsystems" in breakdown
    subsystems_42 = breakdown["subsystems"]

    expected_cm_42 = data["active_threshold_evaluation_0_42"]["champion_lightgbm"]["confusion_matrix"]
    assert sum(s["tp"] for s in subsystems_42.values()) == expected_cm_42["tp"]
    assert sum(s["fp"] for s in subsystems_42.values()) == expected_cm_42["fp"]
    assert sum(s["fn"] for s in subsystems_42.values()) == expected_cm_42["fn"]
    assert sum(s["tn"] for s in subsystems_42.values()) == expected_cm_42["tn"]
    assert sum(s["channels_count"] for s in subsystems_42.values()) == 11485
    assert sum(s["target_events"] for s in subsystems_42.values()) == 174

    # Проверка сумм на пороге 0.845
    assert "subsystems_at_0_845" in breakdown
    subsystems_845 = breakdown["subsystems_at_0_845"]
    expected_cm_845 = data["test_metrics"]["confusion_matrix"]
    assert sum(s["tp"] for s in subsystems_845.values()) == expected_cm_845["tp"]
    assert sum(s["fp"] for s in subsystems_845.values()) == expected_cm_845["fp"]
    assert sum(s["fn"] for s in subsystems_845.values()) == expected_cm_845["fn"]
    assert sum(s["tn"] for s in subsystems_845.values()) == expected_cm_845["tn"]


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
    assert data["total_records"] >= 1
    assert len(data["head_hash"]) == 64
    assert "SHA-256 hash chain" in data["standard"]
    assert "no digital signature" in data["standard"]

def test_audit_tamper_detection_on_financial_metric():
    """Проверка криптографического контроля целостности: изменение avoided_cost_rub фиксирует подделку блока."""
    from backend.app.services.ml_service import ml_service
    assert len(ml_service.confirmed_alarms) > 0
    orig_cost = ml_service.confirmed_alarms[0]["avoided_cost_rub"]
    try:
        # Злоумышленник пытается изменить сумму предотвращенного ущерба в реестре
        ml_service.confirmed_alarms[0]["avoided_cost_rub"] = 999999.0
        res = client.get("/api/alarms/audit/verify")
        assert res.status_code == 200
        tamper_data = res.json()
        assert tamper_data["is_valid"] is False
        assert tamper_data["tamper_detected"] is True
    finally:
        # Восстановление оригинальной суммы
        ml_service.confirmed_alarms[0]["avoided_cost_rub"] = orig_cost
        restore_check = ml_service.verify_audit_log_integrity()
        assert restore_check["is_valid"] is True


def test_dispatcher_rbac_security():
    from backend.app.services.ml_service import ml_service

    res_list = client.get("/api/alarms/dispatchers")
    assert res_list.status_code == 200
    for dispatcher in res_list.json():
        assert "pin_hash" not in dispatcher
        assert "badge" in dispatcher
        assert "role" in dispatcher

    badge, pin = require_dispatcher_credentials()
    res_ok = client.post("/api/alarms/confirm", json={
        "channel_id": "120578",
        "decision": "CONFIRM_FALSE_ALARM",
        "dispatcher_badge": badge,
        "dispatcher_pin": pin,
        "notes": "Проверка штатной авторизации"
    })
    assert res_ok.status_code == 200
    data = res_ok.json()
    assert data["dispatcher_badge"] == badge
    assert len(data["record_hash"]) == 64
    assert len(data["prev_hash"]) == 64

    wrong_pin = client.post("/api/alarms/confirm", json={
        "channel_id": "120578",
        "decision": "CONFIRM_FALSE_ALARM",
        "dispatcher_badge": badge,
        "dispatcher_pin": different_pin(pin),
    })
    assert wrong_pin.status_code == 401

    dispatcher = ml_service.authorized_dispatchers[badge]
    original = dispatcher.get("can_confirm_false_alarm")
    try:
        dispatcher.pop("can_confirm_false_alarm", None)
        missing_permission = client.post("/api/alarms/confirm", json={
            "channel_id": "120578",
            "decision": "CONFIRM_FALSE_ALARM",
            "dispatcher_badge": badge,
            "dispatcher_pin": pin,
        })
        assert missing_permission.status_code == 403
    finally:
        if original is not None:
            dispatcher["can_confirm_false_alarm"] = original

    original = dispatcher.get("can_confirm_false_alarm")
    try:
        dispatcher["can_confirm_false_alarm"] = "true"
        malformed_permission = client.post("/api/alarms/confirm", json={
            "channel_id": "120578",
            "decision": "CONFIRM_FALSE_ALARM",
            "dispatcher_badge": badge,
            "dispatcher_pin": pin,
        })
        assert malformed_permission.status_code == 403
    finally:
        if original is not None:
            dispatcher["can_confirm_false_alarm"] = original

    unknown = client.post("/api/alarms/confirm", json={
        "channel_id": "120578",
        "decision": "CONFIRM_FALSE_ALARM",
        "dispatcher_badge": "ДИСП-9999",
        "dispatcher_pin": pin,
    })
    assert unknown.status_code == 401


def test_prediction_reconciliation_endpoint():
    res = client.get("/api/predictions/reconciliation")
    assert res.status_code == 200
    data = res.json()
    assert data["evidence_type"] == "algorithmic_telemetry_proxy"
    assert "sample_cases" in data
    assert len(data["sample_cases"]) > 0
    assert all(
        {"proxy_label", "classification_at_tau_0_42", "first_proxy_event"}.issubset(case)
        for case in data["sample_cases"]
    )


def test_prediction_reconciliation_fails_closed_without_evidence(monkeypatch, tmp_path):
    from backend.app.api import predictions

    monkeypatch.setattr(predictions.settings, "BASE_DIR", str(tmp_path))
    data_dir = tmp_path / "data"
    data_dir.mkdir()

    missing = client.get("/api/predictions/reconciliation")
    assert missing.status_code == 503

    (data_dir / "reconciliation_ground_truth.json").write_text("{", encoding="utf-8")
    corrupt = client.get("/api/predictions/reconciliation")
    assert corrupt.status_code == 503

def test_model_failure_fail_closed_503():
    """Проверка Fail-Closed безопасности: отказ ML-модели возвращает HTTP 503, а не ложный NORMAL."""
    from backend.app.services.ml_service import ml_service
    orig_lgb = ml_service.model_lgbm
    orig_lr = ml_service.model_lr
    orig_rf = ml_service.model_rf
    try:
        # Имитация аварийной выгрузки / сбоя ML-рантайма
        ml_service.model_lgbm = None
        ml_service.model_lr = None
        ml_service.model_rf = None

        res = client.post("/api/predictions/score", json={
            "channel_id": "120578",
            "cnt_24h": 0,
            "cnt_7d": 10
        })
        assert res.status_code == 503
        assert "Критический отказ ML-контура" in res.json()["detail"]
    finally:
        ml_service.model_lgbm = orig_lgb
        ml_service.model_lr = orig_lr
        ml_service.model_rf = orig_rf

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

def test_model_specific_fail_closed_without_fallback():
    """Проверка строгого отсутствия неявной подмены моделей (No silent fallback)."""
    from backend.app.services.ml_service import ml_service
    orig_lr = ml_service.model_lr
    orig_rf = ml_service.model_rf
    try:
        # 1. Отказ Logistic Regression -> должен падать с 503, а не подменять LightGBM
        ml_service.model_lr = None
        res_lr = client.post("/api/predictions/score", json={
            "channel_id": "120578",
            "cnt_24h": 2,
            "cnt_7d": 15,
            "model_name": "logistic_regression"
        })
        assert res_lr.status_code == 503
        assert "logistic_regression" in res_lr.json()["detail"]

        # 2. Отказ Random Forest -> должен падать с 503, а не подменять LightGBM
        ml_service.model_rf = None
        res_rf = client.post("/api/predictions/score", json={
            "channel_id": "120578",
            "cnt_24h": 2,
            "cnt_7d": 15,
            "model_name": "random_forest"
        })
        assert res_rf.status_code == 503
        assert "random_forest" in res_rf.json()["detail"]
    finally:
        ml_service.model_lr = orig_lr
        ml_service.model_rf = orig_rf


def test_settings_rbac_level3_security():
    from backend.app.services.ml_service import ml_service

    badge, pin = require_dispatcher_credentials()
    base_settings = {
        "decision_threshold": 0.42,
        "chatter_window_seconds": 90,
        "chatter_min_flips": 5,
        "gas_warning_threshold_vol_pct": 1.2,
        "callout_cost_rub": 18500.0,
        "preventive_cost_rub": 3200.0,
        "require_dispatcher_confirmation": True,
        "auto_suppress_chatter": False,
        "selected_model": "champion_lightgbm"
    }

    bad_pin = client.post("/api/settings", json={
        **base_settings, "dispatcher_badge": badge, "dispatcher_pin": different_pin(pin)
    })
    assert bad_pin.status_code == 401

    dispatcher = ml_service.authorized_dispatchers[badge]
    old_clearance = dispatcher.get("clearance_level")
    old_role = dispatcher.get("role")
    try:
        dispatcher["clearance_level"] = 1
        dispatcher["role"] = "Главный инженер"  # role text must never grant clearance
        low_privilege = client.post("/api/settings", json={
            **base_settings, "dispatcher_badge": badge, "dispatcher_pin": pin
        })
        assert low_privilege.status_code == 403
    finally:
        if old_clearance is not None:
            dispatcher["clearance_level"] = old_clearance
        if old_role is not None:
            dispatcher["role"] = old_role

    authorized = client.post("/api/settings", json={
        **base_settings, "dispatcher_badge": badge, "dispatcher_pin": pin
    })
    assert authorized.status_code == 200
    assert authorized.json()["decision_threshold"] == 0.42


def test_tickets_dispatcher_audit():
    badge, pin = require_dispatcher_credentials()
    bad_pin = client.post("/api/tickets/generate", json={
        "channel_id": "113980",
        "dispatcher_badge": badge,
        "dispatcher_pin": different_pin(pin)
    })
    assert bad_pin.status_code == 401

    success = client.post("/api/tickets/generate", json={
        "channel_id": "113980",
        "notes": "Предупредительная ревизия блока питания",
        "dispatcher_badge": badge,
        "dispatcher_pin": pin
    })
    assert success.status_code == 200
    ticket = success.json()
    assert ticket["channel_id"] == "113980"
    assert ticket["created_by"] == badge



def test_mutating_endpoints_fail_closed_when_dispatcher_registry_is_missing(monkeypatch):
    from backend.app.services.ml_service import ml_service
    from backend.app.services.maintenance_service import maintenance_service

    initial_count = len(maintenance_service.tickets)
    monkeypatch.setattr(ml_service, "authorized_dispatchers", {})

    settings = client.post("/api/settings", json={"decision_threshold": 0.45})
    assert settings.status_code == 401
    create = client.post("/api/tickets/generate", json={"channel_id": "120504"})
    assert create.status_code == 401
    update = client.patch(
        f"/api/tickets/{maintenance_service.tickets[0]['ticket_id']}/status",
        json={"new_status": "ВЫПОЛНЕН"}
    )
    assert update.status_code == 401
    simulation = client.post("/api/simulation/step", json={
        "scenario_type": "BATTERY_DROP", "channel_id": "8808"
    })
    assert simulation.status_code == 401
    alarm = client.post("/api/alarms/confirm", json={
        "channel_id": "120578",
        "decision": "CONFIRM_FALSE_ALARM",
        "dispatcher_badge": TEST_DISPATCHER_BADGE,
        "dispatcher_pin": TEST_DISPATCHER_PIN,
    })
    assert alarm.status_code == 401
    assert len(maintenance_service.tickets) == initial_count


def test_legacy_dispatcher_hashes_fail_closed(monkeypatch, tmp_path):
    from backend.app.services import ml_service as ml_module
    from backend.app.services.ml_service import DispatcherAuthenticationError, ml_service

    original_path = ml_module.AUTH_DISPATCHERS_PATH
    legacy_path = tmp_path / "authorized_dispatchers.json"
    legacy_pin_hash = hashlib.sha256(secrets.token_bytes(32)).hexdigest()
    badge = "ДИСП-9137"
    legacy_path.write_text(json.dumps({badge: {
        "badge": badge,
        "full_name": "Temporary test record",
        "role": "Главный инженер",
        "clearance_level": 3,
        "pin_hash": legacy_pin_hash,
        "can_confirm_false_alarm": True,
        "can_force_dispatch": True,
    }}), encoding="utf-8")

    monkeypatch.setattr(ml_module, "AUTH_DISPATCHERS_PATH", str(legacy_path))
    ml_service.load_authorized_dispatchers()
    assert ml_service.authorized_dispatchers == {}
    with pytest.raises(DispatcherAuthenticationError):
        ml_service.authenticate_dispatcher(badge, TEST_DISPATCHER_PIN)

    ml_module.AUTH_DISPATCHERS_PATH = original_path
    ml_service.load_authorized_dispatchers()
    assert TEST_DISPATCHER_BADGE in ml_service.authorized_dispatchers


def test_provisioning_pin_hash_matches_authentication_format():
    from backend.app.services.ml_service import MLService

    script_path = Path(__file__).resolve().parents[1] / "scripts" / "provision_dispatcher.py"
    spec = importlib.util.spec_from_file_location("dispatcher_provisioning", script_path)
    assert spec is not None and spec.loader is not None
    provisioner = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(provisioner)

    encoded_hash = provisioner.hash_pin(TEST_DISPATCHER_PIN)
    assert MLService._valid_pin_hash(encoded_hash)
    assert MLService._verify_pin(TEST_DISPATCHER_PIN, encoded_hash)
    assert not MLService._verify_pin(different_pin(TEST_DISPATCHER_PIN), encoded_hash)


def test_audit_write_failure_is_atomic_and_rolls_back_api_state(monkeypatch):
    from backend.app.services import ml_service as ml_module
    from backend.app.services.ml_service import ml_service

    audit_file = Path(ml_module.CONFIRMED_ALARMS_PATH)
    original_bytes = audit_file.read_bytes()
    original_records = [dict(record) for record in ml_service.confirmed_alarms]
    badge, pin = require_dispatcher_credentials()

    def fail_replace(_source, _target):
        raise OSError("simulated atomic replace failure")

    monkeypatch.setattr(ml_module.os, "replace", fail_replace)
    failing_client = TestClient(app, raise_server_exceptions=False)
    result = failing_client.post("/api/alarms/confirm", json={
        "channel_id": "120578",
        "decision": "CONFIRM_FALSE_ALARM",
        "dispatcher_badge": badge,
        "dispatcher_pin": pin,
        "notes": "Atomic-write failure check",
    })

    assert result.status_code == 503
    assert ml_service.confirmed_alarms == original_records
    assert audit_file.read_bytes() == original_bytes


def test_ticket_write_failures_roll_back_api_mutations(monkeypatch):
    from backend.app.services.maintenance_service import maintenance_service

    badge, pin = require_dispatcher_credentials()
    original_tickets = maintenance_service.get_tickets()
    original_count = len(original_tickets)
    existing_ticket = original_tickets[0]
    original_status = existing_ticket["status"]

    def fail_save():
        raise RuntimeError("simulated persistence failure")

    monkeypatch.setattr(maintenance_service, "_save_to_disk", fail_save)
    create = client.post("/api/tickets/generate", json={
        "channel_id": "120504",
        "dispatcher_badge": badge,
        "dispatcher_pin": pin,
    })
    assert create.status_code == 503
    assert len(maintenance_service.get_tickets()) == original_count

    update = client.patch(f"/api/tickets/{existing_ticket['ticket_id']}/status", json={
        "new_status": "ВЫПОЛНЕН",
        "dispatcher_badge": badge,
        "dispatcher_pin": pin,
    })
    assert update.status_code == 503
    current = next(ticket for ticket in maintenance_service.get_tickets()
                   if ticket["ticket_id"] == existing_ticket["ticket_id"])
    assert current["status"] == original_status


def test_concurrent_ticket_writes_are_serialized(monkeypatch, tmp_path):
    from backend.app.services import maintenance_service as maintenance_module
    from backend.app.services.maintenance_service import MaintenanceService

    db_path = tmp_path / "tickets.json"
    monkeypatch.setattr(maintenance_module, "DB_PATH", str(db_path))
    service = MaintenanceService()

    def create(index):
        return service.create_ticket(
            channel_id="120504",
            dispatcher_badge=f"TEST-{index}",
            dispatcher_name="Concurrent test",
            priority="СРЕДНИЙ",
            notes=f"Concurrent ticket {index}",
        )

    with ThreadPoolExecutor(max_workers=8) as pool:
        created = list(pool.map(create, range(16)))

    created_ids = [ticket["ticket_id"] for ticket in created]
    assert len(created_ids) == len(set(created_ids))
    saved = json.loads(db_path.read_text(encoding="utf-8"))
    saved_ids = [ticket["ticket_id"] for ticket in saved]
    assert len(saved_ids) == len(set(saved_ids))
    assert set(created_ids).issubset(saved_ids)


def test_realtime_score_calibration_fail_closed(monkeypatch):
    """Проверка строгого fail-closed поведения калибратора: при повреждении или
    отсутствии калибратора возвращается calibrated_proxy_probability: None,
    is_calibrated: False, без скрытой подмены сырым скором (тихий fallback запрещен).
    """
    from backend.app.services.ml_service import ml_service

    # Case 1: Calibrator missing
    original_calibrator = ml_service.calibrator
    try:
        ml_service.calibrator = None
        res = client.post("/api/predictions/score", json={
            "channel_id": "120578",
            "cnt_24h": 0,
            "cnt_7d": 80,
            "chatter_cnt": 6,
            "silence_hours": 36.0,
            "battery_glitches": 2
        })
        assert res.status_code == 200
        data = res.json()
        assert data["is_calibrated"] is False
        assert data["calibrated_proxy_probability"] is None
        assert data["calibration_status"] == "CALIBRATOR_UNAVAILABLE"
        # Raw score must still be present and valid
        assert 0.0 <= data["raw_model_score"] <= 1.0

        # Case 2: Calibrator predict_proba raises an exception
        class BrokenCalibrator:
            def predict_proba(self, X):
                raise ValueError("Simulated corrupted calibrator model weights")

        ml_service.calibrator = BrokenCalibrator()
        res2 = client.post("/api/predictions/score", json={
            "channel_id": "120578",
            "cnt_24h": 0,
            "cnt_7d": 80,
            "chatter_cnt": 6,
            "silence_hours": 36.0,
            "battery_glitches": 2
        })
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["is_calibrated"] is False
        assert data2["calibrated_proxy_probability"] is None
        assert "CALIBRATION_ERROR" in data2["calibration_status"]
    finally:
        ml_service.calibrator = original_calibrator


def test_distinct_score_semantics():
    """Проверка разделения семантики: сырой скор модели (ранжирование очереди) vs
    откалиброванная proxy-вероятность (Brier 0.01381).
    """
    res = client.post("/api/predictions/score", json={
        "channel_id": "120578",
        "cnt_24h": 0,
        "cnt_7d": 80,
        "chatter_cnt": 6,
        "silence_hours": 36.0,
        "battery_glitches": 2
    })
    assert res.status_code == 200
    data = res.json()
    assert "raw_model_score" in data
    assert "calibrated_proxy_probability" in data
    assert "score_semantics" in data
    assert data["is_calibrated"] is True
    assert data["calibration_status"] == "CALIBRATED_BETA"

    raw = data["raw_model_score"]
    cal = data["calibrated_proxy_probability"]
    if raw >= 0.70:
        assert cal < raw
        assert cal <= 0.30

    # Check in predictions list
    list_res = client.get("/api/predictions?limit=5")
    assert list_res.status_code == 200
    items = list_res.json()["items"]
    assert len(items) > 0
    for item in items:
        assert "raw_model_score" in item
        assert "calibrated_proxy_probability" in item
        assert item["is_calibrated"] is True
        assert item["calibration_status"] == "CALIBRATED_BETA"
        assert "score_semantics" in item


def test_high_risk_and_top_k_metrics():
    """Проверка наличия и математической корректности расширенной калибровки в когорте риска и Top-K."""
    res = client.get("/api/predictions/metrics")
    assert res.status_code == 200
    rep = res.json()

    assert "reproducibility_tier" in rep
    assert "Tier 2" in rep["reproducibility_tier"]
    assert "high_risk_and_top_k_calibration" in rep

    ext = rep["high_risk_and_top_k_calibration"]
    hr = ext["high_risk_cohort_raw_ge_0_42"]
    assert hr["n_channels"] == 668
    assert hr["proxy_positive_events"] == 55
    assert hr["brier_score_raw"] > 0.40
    assert hr["brier_score_calibrated"] < 0.10
    assert hr["brier_improvement_ratio"] >= 5.0

    top_k = ext["top_k_channels"]
    assert "top_100" in top_k
    assert "top_200" in top_k
    assert "top_500" in top_k
    assert top_k["top_100"]["positives"] == 29
    assert top_k["top_100"]["lift_vs_baseline"] >= 15.0

    delta = ext["brier_delta_analysis"]
    assert delta["delta_brier_absolute"] == 0.00115
