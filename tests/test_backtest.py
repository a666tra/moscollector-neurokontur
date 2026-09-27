"""Checks for the weekly out-of-time backtest artefacts and API."""
import json
import os

import numpy as np
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.ml.features import FEATURE_NAMES, channel_features, is_failure_value

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
REPORT = os.path.join(ROOT, 'backend', 'models', 'rolling_backtest_report.json')
CACHE = os.path.join(ROOT, 'backend', 'data', 'rolling_backtest_features.npz')


def test_backtest_endpoint_serves_report():
    resp = TestClient(app).get('/api/predictions/backtest')
    assert resp.status_code == 200
    body = resp.json()
    assert body['test_weeks'] == len(body['weeks']) >= 20
    for scorer in ('deployed', 'lgbm_weekly', 'logreg_weekly', 'persistence'):
        assert scorer in body['summary']['all']


def test_backtest_reproduces_training_features_exactly():
    with open(REPORT, encoding='utf-8') as f:
        consistency = json.load(f)['consistency_with_training_cache']
    assert consistency['same_channel_order']
    for split in ('train', 'val', 'test'):
        assert consistency[split]['max_abs_feature_diff'] == 0.0
        assert consistency[split]['label_mismatches'] == 0


def test_backtest_cache_shapes_are_consistent():
    d = np.load(CACHE, allow_pickle=False)
    n_weeks, n_channels, n_features = d['X'].shape
    assert n_features == len(FEATURE_NAMES)
    assert d['y_fault'].shape == d['fault_7d'].shape == (n_weeks, n_channels)
    assert len(d['cutoffs']) == n_weeks


def test_failure_rule_examples():
    assert is_failure_value('Неисправен', False)
    assert is_failure_value('01.01.1970 03:00:01', False)
    assert is_failure_value('6.0', True, 'Газоанализатор')          # CH4 >= 5 % vol
    assert not is_failure_value('0.02', False, 'Газоанализатор')
    assert not is_failure_value('1', False, 'КД Люк')                # discrete state flip


def test_channel_features_empty_history():
    from datetime import datetime
    feats = channel_features([], datetime(2026, 2, 1), {}, {}, {}, {})
    assert len(feats) == len(FEATURE_NAMES)
    assert feats[FEATURE_NAMES.index('silence_hours')] == 168.0


def test_public_demo_dispatcher_from_env(monkeypatch, tmp_path):
    from backend.app.services import ml_service as mod
    monkeypatch.setattr(mod, 'AUTH_DISPATCHERS_PATH', str(tmp_path / 'missing.json'))
    monkeypatch.setenv('LCT_DEMO_DISPATCHER_PIN', '246810')
    svc = mod.ml_service
    svc.load_authorized_dispatchers()
    try:
        badge, _ = svc.authenticate_dispatcher('ДИСП-0001', '246810', min_clearance_level=3)
        assert badge == 'ДИСП-0001'
        assert TestClient(app).get('/api/alarms/demo-access').json()['enabled'] is True
    finally:
        monkeypatch.delenv('LCT_DEMO_DISPATCHER_PIN')
        svc.public_demo_credentials = None
        svc.load_authorized_dispatchers()


def test_pin_lockout_after_repeated_failures(monkeypatch, tmp_path):
    import pytest
    from backend.app.services import ml_service as mod
    monkeypatch.setattr(mod, 'AUTH_DISPATCHERS_PATH', str(tmp_path / 'missing.json'))
    monkeypatch.setenv('LCT_DEMO_DISPATCHER_PIN', '246810')
    svc = mod.ml_service
    svc.load_authorized_dispatchers()
    svc._pin_failures.clear()
    try:
        for _ in range(mod.MAX_PIN_FAILURES):
            with pytest.raises(mod.DispatcherAuthenticationError):
                svc.authenticate_dispatcher('ДИСП-0001', '000000')
        with pytest.raises(mod.DispatcherAuthenticationError, match='Слишком много'):
            svc.authenticate_dispatcher('ДИСП-0001', '246810')   # even the right PIN is refused while locked
    finally:
        svc._pin_failures.clear()
        monkeypatch.delenv('LCT_DEMO_DISPATCHER_PIN')
        svc.public_demo_credentials = None
        svc.load_authorized_dispatchers()
