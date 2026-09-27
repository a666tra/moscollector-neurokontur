import importlib.util
from pathlib import Path

import numpy as np

_SCRIPT_PATH = Path(__file__).resolve().parents[1] / "scripts" / "reproduce_metrics.py"
_SPEC = importlib.util.spec_from_file_location("reproduce_metrics", _SCRIPT_PATH)
_METRICS = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(_METRICS)

beta_calibration_features = _METRICS.beta_calibration_features
calculate_cluster_bootstrap_interval = _METRICS.calculate_cluster_bootstrap_interval
calculate_ece = _METRICS.calculate_ece
calculate_wilson_interval = _METRICS.calculate_wilson_interval


def test_beta_features_are_finite_at_probability_endpoints_and_monotone():
    features = beta_calibration_features(np.array([0.0, 0.5, 1.0]))

    assert features.shape == (3, 2)
    assert np.isfinite(features).all()
    assert np.all(np.diff(features[:, 0]) > 0)
    assert np.all(np.diff(features[:, 1]) > 0)


def test_ece_includes_probability_one_in_the_last_bin():
    assert calculate_ece(np.array([1.0]), np.array([0]), n_bins=10) == 1.0
    assert calculate_ece(np.array([0.0]), np.array([0]), n_bins=10) == 0.0


def test_wilson_interval_for_top_100_rate_is_non_degenerate():
    interval = calculate_wilson_interval(29, 100)

    assert 0.20 < interval["lower"] < 0.22
    assert 0.38 < interval["upper"] < 0.39


def test_object_cluster_bootstrap_is_repeatable_and_contains_sample_rate():
    labels = np.array([1, 0, 1, 0, 0, 1])
    groups = ["a", "a", "b", "b", "c", "c"]

    first = calculate_cluster_bootstrap_interval(labels, groups, n_resamples=2000, random_state=7)
    second = calculate_cluster_bootstrap_interval(labels, groups, n_resamples=2000, random_state=7)

    assert first == second
    assert first["lower"] <= labels.mean() <= first["upper"]
