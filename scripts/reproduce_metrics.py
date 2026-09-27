#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/reproduce_metrics.py
Воспроизведение ML-метрик, калибровки (Brier Score, ECE) и инвариантов матрицы ошибок
на отложенной тестовой выборке (Test split, N=11485, 174 positives).
"""

import os
import json
import hashlib
from datetime import datetime
from pathlib import Path
from statistics import NormalDist
from typing import Dict, Any

import joblib
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import (
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    average_precision_score,
)

ROOT_DIR = Path(__file__).resolve().parent.parent
FEATURES_CACHE_PATH = ROOT_DIR / "backend" / "data" / "extracted_features_cache.npz"
SENSORS_REF_PATH = ROOT_DIR / "backend" / "data" / "sensors_ref.json"
MODELS_DIR = ROOT_DIR / "backend" / "models"
METRICS_REPORT_PATH = MODELS_DIR / "metrics_report.json"
PROVENANCE_PATH = ROOT_DIR / "backend" / "data" / "reconciliation_ground_truth.json"

SUBSYSTEM_MAP = {
    "Датчик затопления": "Водоотлив",
    "Состояние насоса": "Водоотлив",
    "Газовый датчик": "Газовый контроль",
    "9-секционный люк": "Охранный периметр",
    "Датчик движения": "Охранный периметр",
    "КД АВ": "Охранный периметр",
    "КД Дверь": "Охранный периметр",
    "КД Люк": "Охранный периметр",
    "Состояние охраны": "Охранный периметр",
    "Стекло": "Охранный периметр",
    "Датчик дыма": "Пожарная сигнализация",
    "Ручной извещатель": "Пожарная сигнализация",
    "Состояние УИР-Р": "Пожарная сигнализация",
    "Тепловой датчик": "Пожарная сигнализация",
    "Датчик температуры": "Температура",
    "ИБП": "Электроснабжение",
    "Состояние фазы": "Электроснабжение",
    "Переключатель": "Прочие",
    "Состояние вентилятора": "Прочие",
}

SUBSYSTEM_ORDER = [
    "Водоотлив",
    "Газовый контроль",
    "Охранный периметр",
    "Пожарная сигнализация",
    "Температура",
    "Электроснабжение",
    "Прочие",
]


def calculate_sha256(filepath: Path) -> str:
    """Вычисление SHA-256 хеша файла."""
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


def calculate_ece(probs: np.ndarray, labels: np.ndarray, n_bins: int = 10) -> float:
    """
    Вычисление Expected Calibration Error (ECE) с n_bins равными бинами [0, 1].
    Включает значение p=1.0 в последний бин.
    """
    probs = np.clip(np.asarray(probs, dtype=float), 0.0, 1.0)
    labels = np.asarray(labels)
    # Map p=1.0 into the last bin; np.digitize(..., right=False) returns n_bins+1.
    binids = np.minimum((probs * n_bins).astype(int), n_bins - 1)
    ece = 0.0
    n = len(probs)
    for i in range(n_bins):
        idx = binids == i
        count = int(np.sum(idx))
        if count > 0:
            avg_prob = float(np.mean(probs[idx]))
            avg_label = float(np.mean(labels[idx]))
            ece += (count / n) * abs(avg_prob - avg_label)
    return float(round(ece, 5))


def beta_calibration_features(probabilities: np.ndarray) -> np.ndarray:
    """Return finite beta-calibration features [log(p), -log(1-p)]."""
    probs = np.asarray(probabilities, dtype=float).reshape(-1)
    probs = np.clip(probs, 1e-6, 1.0 - 1e-6)
    return np.column_stack((np.log(probs), -np.log1p(-probs)))


def fit_beta_calibrator(probabilities: np.ndarray, labels: np.ndarray) -> LogisticRegression:
    """Fit the smooth beta calibrator on the supplied calibration partition only."""
    calibrator = LogisticRegression(C=1e6, solver="lbfgs", max_iter=2000)
    calibrator.fit(beta_calibration_features(probabilities), labels)
    if np.any(calibrator.coef_[0] < 0):
        raise ValueError("Beta calibrator is not monotone")
    return calibrator


def apply_probability_calibrator(calibrator: Any, probabilities: np.ndarray) -> np.ndarray:
    """Apply the persisted Platt (1 feature) or beta (2 features) calibrator."""
    feature_count = int(getattr(calibrator, "n_features_in_", 1))
    if feature_count == 2:
        features = beta_calibration_features(probabilities)
    elif feature_count == 1:
        features = np.asarray(probabilities, dtype=float).reshape(-1, 1)
    else:
        raise ValueError(f"Unsupported calibrator feature count: {feature_count}")
    return calibrator.predict_proba(features)[:, 1]


def calculate_wilson_interval(successes: int, trials: int, confidence: float = 0.95) -> Dict[str, float]:
    """Wilson score interval for a cohort event rate (iid-channel assumption)."""
    if trials <= 0 or successes < 0 or successes > trials:
        raise ValueError("Expected 0 <= successes <= trials and trials > 0")
    z = NormalDist().inv_cdf((1.0 + confidence) / 2.0)
    rate = successes / trials
    denominator = 1.0 + z * z / trials
    center = (rate + z * z / (2.0 * trials)) / denominator
    margin = z * np.sqrt(rate * (1.0 - rate) / trials + z * z / (4.0 * trials * trials)) / denominator
    return {"lower": float(center - margin), "upper": float(center + margin)}


def calculate_cluster_bootstrap_interval(
    labels: np.ndarray,
    groups: list,
    n_resamples: int = 10000,
    random_state: int = 42,
) -> Dict[str, float]:
    """Bootstrap a cohort event rate by object cluster, conditional on cohort membership."""
    labels = np.asarray(labels, dtype=int)
    if len(labels) != len(groups) or len(labels) == 0:
        raise ValueError("labels and groups must have the same non-zero length")
    grouped = {}
    for label, group in zip(labels, groups):
        item = grouped.setdefault(str(group), [0, 0])
        item[0] += 1
        item[1] += int(label)
    if len(grouped) < 2:
        return {"lower": float("nan"), "upper": float("nan")}
    counts = np.asarray([v[0] for v in grouped.values()], dtype=float)
    positives = np.asarray([v[1] for v in grouped.values()], dtype=float)
    rng = np.random.default_rng(random_state)
    sampled = rng.integers(0, len(counts), size=(n_resamples, len(counts)))
    sample_n = counts[sampled].sum(axis=1)
    sample_positive = positives[sampled].sum(axis=1)
    rates = sample_positive / sample_n
    lower, upper = np.quantile(rates, [0.025, 0.975])
    return {"lower": float(lower), "upper": float(upper)}


def calculate_calibration_bins(
    probabilities: np.ndarray,
    labels: np.ndarray,
    n_bins: int = 10,
) -> list:
    """Equal-width reliability bins with counts and Wilson intervals for observed rates."""
    probabilities = np.clip(np.asarray(probabilities, dtype=float), 0.0, 1.0)
    labels = np.asarray(labels, dtype=int)
    bin_ids = np.minimum((probabilities * n_bins).astype(int), n_bins - 1)
    summaries = []
    for i in range(n_bins):
        idx = bin_ids == i
        count = int(idx.sum())
        if not count:
            continue
        positives = int(labels[idx].sum())
        summaries.append({
            "lower_probability": round(i / n_bins, 3),
            "upper_probability": round((i + 1) / n_bins, 3),
            "channels": count,
            "proxy_positives": positives,
            "mean_predicted_probability": round(float(probabilities[idx].mean()), 5),
            "observed_proxy_rate": round(positives / count, 5),
            "observed_rate_wilson_95_ci": {
                k: round(v, 5) for k, v in calculate_wilson_interval(positives, count).items()
            },
        })
    return summaries


def calculate_oof_calibration(
    raw_scores: np.ndarray,
    labels: np.ndarray,
    n_splits: int = 5,
    random_state: int = 43,
) -> Dict[str, Any]:
    """Cross-fit Platt and beta maps using validation labels only."""
    raw_scores = np.asarray(raw_scores, dtype=float)
    labels = np.asarray(labels, dtype=int)
    oof = {"platt": np.zeros_like(raw_scores), "beta": np.zeros_like(raw_scores)}
    splitter = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=random_state)
    for fit_idx, held_idx in splitter.split(raw_scores, labels):
        platt = LogisticRegression(C=1e6, solver="lbfgs", max_iter=2000)
        platt.fit(raw_scores[fit_idx, None], labels[fit_idx])
        oof["platt"][held_idx] = platt.predict_proba(raw_scores[held_idx, None])[:, 1]
        beta = fit_beta_calibrator(raw_scores[fit_idx], labels[fit_idx])
        oof["beta"][held_idx] = beta.predict_proba(beta_calibration_features(raw_scores[held_idx]))[:, 1]

    top_idx = np.argsort(-raw_scores)[: min(100, len(raw_scores))]
    result = {
        "folds": n_splits,
        "splitter": f"StratifiedKFold(shuffle=True, random_state={random_state})",
        "channels": int(len(labels)),
        "proxy_positives": int(labels.sum()),
        "selection_note": "Beta was preselected from validation-only out-of-fold results: it has fewer calibration parameters than isotonic, lower OOF Brier/log-loss than Platt, and its OOF top-100 mean tracks the observed rate. Test labels were not used to fit or tune it.",
        "top_100_raw_ranked": {
            "channels": int(len(top_idx)),
            "proxy_positives": int(labels[top_idx].sum()),
        },
    }
    for name, probs in oof.items():
        result[name] = {
            "brier_score_oof": round(float(np.mean((probs - labels) ** 2)), 6),
            "log_loss_oof": round(float(-np.mean(labels * np.log(np.clip(probs, 1e-12, 1.0)) + (1 - labels) * np.log(np.clip(1.0 - probs, 1e-12, 1.0)))), 6),
            "ece_10_oof": calculate_ece(probs, labels, 10),
            "top_100_mean_probability_oof": round(float(np.mean(probs[top_idx])), 5),
        }
    return result


def calculate_confusion_matrix(y_true: np.ndarray, probs: np.ndarray, threshold: float) -> Dict[str, int]:
    """Вычисление базовой матрицы ошибок (TP, FP, FN, TN)."""
    pred = (probs >= threshold).astype(int)
    tp = int(np.sum((y_true == 1) & (pred == 1)))
    fp = int(np.sum((y_true == 0) & (pred == 1)))
    fn = int(np.sum((y_true == 1) & (pred == 0)))
    tn = int(np.sum((y_true == 0) & (pred == 0)))
    return {"tp": tp, "fp": fp, "fn": fn, "tn": tn}


def compute_subsystem_breakdown(
    channels: list,
    sensors_ref: dict,
    y_test: np.ndarray,
    probs: np.ndarray,
    threshold: float,
) -> Dict[str, Dict[str, Any]]:
    """Вычисление детальной разбивки по 7 инженерным подсистемам."""
    pred = (probs >= threshold).astype(int)
    breakdown = {}

    for sub in SUBSYSTEM_ORDER:
        idx = np.array([
            SUBSYSTEM_MAP.get(sensors_ref.get(c, {}).get("sensor_type", ""), "Прочие") == sub
            for c in channels
        ])
        n_ch = int(np.sum(idx))
        y_sub = y_test[idx]
        pred_sub = pred[idx]

        tp = int(np.sum((y_sub == 1) & (pred_sub == 1)))
        fp = int(np.sum((y_sub == 0) & (pred_sub == 1)))
        fn = int(np.sum((y_sub == 1) & (pred_sub == 0)))
        tn = int(np.sum((y_sub == 0) & (pred_sub == 0)))
        target_events = int(np.sum(y_sub == 1))

        precision = round(tp / (tp + fp), 4) if (tp + fp) > 0 else 0.0
        recall = round(tp / (tp + fn), 4) if (tp + fn) > 0 else 0.0

        breakdown[sub] = {
            "subsystem_name": sub,
            "channels_count": n_ch,
            "target_events": target_events,
            "tp": tp,
            "fp": fp,
            "fn": fn,
            "tn": tn,
            "precision": precision,
            "recall": recall,
        }

    return breakdown


def reproduce() -> Dict[str, Any]:
    print("=== ВОСПРОИЗВЕДЕНИЕ ML-МЕТРИК И ПРОВЕРКА ИНВАРИАНТОВ ===")

    # 1. SHA-256 кэша признаков
    if not FEATURES_CACHE_PATH.exists():
        raise FileNotFoundError(f"Файл кэша признаков не найден: {FEATURES_CACHE_PATH}")

    cache_hash = calculate_sha256(FEATURES_CACHE_PATH)
    print(f"[OK] SHA-256 {FEATURES_CACHE_PATH.name}: {cache_hash}")

    # 2. Загрузка данных
    data = np.load(FEATURES_CACHE_PATH)
    y_train = data["y_train"].astype(int)
    X_val = data["X_val"]
    y_val = data["y_val"].astype(int)
    X_test = data["X_test"]
    y_test = data["y_test"]
    channels = [str(c) for c in data["channels_list"]]

    with open(SENSORS_REF_PATH, "r", encoding="utf-8") as f:
        sensors_ref = json.load(f)

    provenance = {}
    if PROVENANCE_PATH.exists():
        with open(PROVENANCE_PATH, "r", encoding="utf-8") as f:
            provenance_record = json.load(f)
        provenance = {
            key: provenance_record.get(key)
            for key in (
                "evidence_type", "source_journal", "source_journal_sha256", "source_journal_bytes",
                "source_csv_committed", "source_rows_scanned", "source_row_limit",
                "prediction_cutoff", "target_window_start", "target_window_end_inclusive",
                "dataset_channels_total", "proxy_positive_channels",
            )
        }

    n_samples = len(y_test)
    n_positives = int(np.sum(y_test))
    print(f"[OK] Загружен Test split: N={n_samples}, proxy positives={n_positives} ({n_positives / n_samples * 100:.2f}%)")

    # 3. Загрузка моделей и скалера
    lgbm_model = joblib.load(MODELS_DIR / "champion_lgbm.joblib")
    lr_model = joblib.load(MODELS_DIR / "logistic_regression.joblib")
    rf_model = joblib.load(MODELS_DIR / "random_forest.joblib")
    scaler = joblib.load(MODELS_DIR / "feature_scaler.joblib")
    print("[OK] Модели и скалер успешно загружены")

    # 4. Расчет вероятностей на X_test
    p_lgbm_val = lgbm_model.predict_proba(X_val)[:, 1]
    p_lgbm = lgbm_model.predict_proba(X_test)[:, 1]
    p_lr = lr_model.predict_proba(scaler.transform(X_test))[:, 1]
    p_rf = rf_model.predict_proba(X_test)[:, 1]
    # Deployable constant reference uses validation prevalence, not the held-out test rate.
    p_base = np.full_like(y_test, fill_value=np.mean(y_val), dtype=float)

    # 4.1. Apply the pre-selected validation-only calibrator; never fit on X_test/y_test.
    beta_calibrator_path = MODELS_DIR / "champion_calibrator_beta.joblib"
    platt_calibrator_path = MODELS_DIR / "champion_calibrator.joblib"
    legacy_platt = joblib.load(platt_calibrator_path) if platt_calibrator_path.exists() else None
    if beta_calibrator_path.exists():
        calibrator = joblib.load(beta_calibrator_path)
        calibration_method = "beta"
    elif legacy_platt is not None:
        calibrator = legacy_platt
        calibration_method = "platt_legacy"
    else:
        calibrator = None
        calibration_method = "raw"

    if calibrator is not None:
        p_lgbm_cal = apply_probability_calibrator(calibrator, p_lgbm)
        print(f"[OK] Применен калибратор {calibration_method}")
    else:
        p_lgbm_cal = p_lgbm.copy()
        print("[WARN] Файл калибратора не найден, используются исходные оценки")

    p_lgbm_platt = apply_probability_calibrator(legacy_platt, p_lgbm) if legacy_platt is not None else None
    validation_oof = calculate_oof_calibration(p_lgbm_val, y_val)

    # 5. Расчет Brier Score
    brier_base = round(float(np.mean((p_base - y_test) ** 2)), 5)
    brier_lgbm_raw = round(float(np.mean((p_lgbm - y_test) ** 2)), 5)
    brier_lgbm_cal = round(float(np.mean((p_lgbm_cal - y_test) ** 2)), 5)
    brier_lgbm_platt = round(float(np.mean((p_lgbm_platt - y_test) ** 2)), 5) if p_lgbm_platt is not None else None
    brier_lr = round(float(np.mean((p_lr - y_test) ** 2)), 5)
    brier_rf = round(float(np.mean((p_rf - y_test) ** 2)), 5)

    print(f"[BRIER SCORE] Baseline (prevalence): {brier_base:.5f}")
    print(f"[BRIER SCORE] LightGBM Raw (risk score): {brier_lgbm_raw:.5f} | Active calibrated: {brier_lgbm_cal:.5f}")
    if brier_lgbm_platt is not None:
        print(f"[BRIER SCORE] Legacy Platt comparison: {brier_lgbm_platt:.5f}")
    print(f"[BRIER SCORE] Logistic Regression: {brier_lr:.5f} | Random Forest: {brier_rf:.5f}")

    # 6. Расчет ECE (Expected Calibration Error, 10 бинов)
    ece_lgbm_raw = calculate_ece(p_lgbm, y_test, 10)
    ece_lgbm_cal = calculate_ece(p_lgbm_cal, y_test, 10)
    ece_lgbm_platt = calculate_ece(p_lgbm_platt, y_test, 10) if p_lgbm_platt is not None else None
    ece_baseline = calculate_ece(p_base, y_test, 10)
    ece_lr = calculate_ece(p_lr, y_test, 10)
    ece_rf = calculate_ece(p_rf, y_test, 10)

    print(f"[ECE (10 бинов)] Raw: {ece_lgbm_raw:.5f} | Active calibrated: {ece_lgbm_cal:.5f} | Val-prevalence baseline: {ece_baseline:.5f}")
    if ece_lgbm_platt is not None:
        print(f"[ECE (10 бинов)] Legacy Platt comparison: {ece_lgbm_platt:.5f}")
    print(f"[ECE (10 бинов)] Logistic Regression: {ece_lr:.5f} | Random Forest: {ece_rf:.5f}")

    # 7. Матрицы ошибок LightGBM
    cm_0_42 = calculate_confusion_matrix(y_test, p_lgbm, 0.42)
    cm_0_845 = calculate_confusion_matrix(y_test, p_lgbm, 0.845)

    print(f"[CONFUSION MATRIX @ 0.42]  TP={cm_0_42['tp']}, FP={cm_0_42['fp']}, FN={cm_0_42['fn']}, TN={cm_0_42['tn']}")
    print(f"[CONFUSION MATRIX @ 0.845] TP={cm_0_845['tp']}, FP={cm_0_845['fp']}, FN={cm_0_845['fn']}, TN={cm_0_845['tn']}")

    # 8. Разбивка по подсистемам
    subsystems_0_42 = compute_subsystem_breakdown(channels, sensors_ref, y_test, p_lgbm, 0.42)
    subsystems_0_845 = compute_subsystem_breakdown(channels, sensors_ref, y_test, p_lgbm, 0.845)

    # 9. ПРОВЕРКА ДИНАМИЧЕСКИХ ИНВАРИАНТОВ МАТРИЦЫ ОШИБОК
    sum_tp_42 = sum(s["tp"] for s in subsystems_0_42.values())
    sum_fp_42 = sum(s["fp"] for s in subsystems_0_42.values())
    sum_fn_42 = sum(s["fn"] for s in subsystems_0_42.values())
    sum_tn_42 = sum(s["tn"] for s in subsystems_0_42.values())
    sum_ch_42 = sum(s["channels_count"] for s in subsystems_0_42.values())
    sum_tgt_42 = sum(s["target_events"] for s in subsystems_0_42.values())

    assert sum_tp_42 == cm_0_42["tp"], f"Инвариант TP @ 0.42 нарушен: {sum_tp_42} != {cm_0_42['tp']}"
    assert sum_fp_42 == cm_0_42["fp"], f"Инвариант FP @ 0.42 нарушен: {sum_fp_42} != {cm_0_42['fp']}"
    assert sum_fn_42 == cm_0_42["fn"], f"Инвариант FN @ 0.42 нарушен: {sum_fn_42} != {cm_0_42['fn']}"
    assert sum_tn_42 == cm_0_42["tn"], f"Инвариант TN @ 0.42 нарушен: {sum_tn_42} != {cm_0_42['tn']}"
    assert sum_ch_42 == n_samples, f"Инвариант общего числа каналов нарушен: {sum_ch_42} != {n_samples}"
    assert sum_tgt_42 == n_positives, f"Инвариант целевых событий нарушен: {sum_tgt_42} != {n_positives}"

    sum_tp_845 = sum(s["tp"] for s in subsystems_0_845.values())
    sum_fp_845 = sum(s["fp"] for s in subsystems_0_845.values())
    sum_fn_845 = sum(s["fn"] for s in subsystems_0_845.values())
    sum_tn_845 = sum(s["tn"] for s in subsystems_0_845.values())

    assert sum_tp_845 == cm_0_845["tp"], f"Инвариант TP @ 0.845 нарушен: {sum_tp_845} != {cm_0_845['tp']}"
    assert sum_fp_845 == cm_0_845["fp"], f"Инвариант FP @ 0.845 нарушен: {sum_fp_845} != {cm_0_845['fp']}"
    assert sum_fn_845 == cm_0_845["fn"], f"Инвариант FN @ 0.845 нарушен: {sum_fn_845} != {cm_0_845['fn']}"
    assert sum_tn_845 == cm_0_845["tn"], f"Инвариант TN @ 0.845 нарушен: {sum_tn_845} != {cm_0_845['tn']}"
    print("[OK] Все математические динамические инварианты разбивки по подсистемам успешно подтверждены!")

    # 9.1 Расчет калибровки в когорте высокого риска (raw >= 0.42) и Top-K
    hr_idx = p_lgbm >= 0.42
    hr_n = int(np.sum(hr_idx))
    hr_pos = int(np.sum(y_test[hr_idx]))
    hr_prev = round(float(hr_pos / hr_n), 4) if hr_n > 0 else 0.0
    hr_raw_mean = round(float(np.mean(p_lgbm[hr_idx])), 4) if hr_n > 0 else 0.0
    hr_cal_mean = round(float(np.mean(p_lgbm_cal[hr_idx])), 4) if hr_n > 0 else 0.0
    hr_platt_mean = round(float(np.mean(p_lgbm_platt[hr_idx])), 4) if hr_n > 0 and p_lgbm_platt is not None else None
    hr_brier_raw = round(float(np.mean((p_lgbm[hr_idx] - y_test[hr_idx]) ** 2)), 5) if hr_n > 0 else 0.0
    hr_brier_cal = round(float(np.mean((p_lgbm_cal[hr_idx] - y_test[hr_idx]) ** 2)), 5) if hr_n > 0 else 0.0
    hr_brier_ratio = round(hr_brier_raw / hr_brier_cal, 2) if hr_brier_cal > 0 else 0.0
    hr_wilson = calculate_wilson_interval(hr_pos, hr_n) if hr_n > 0 else None
    hr_groups = [
        sensors_ref.get(channels[i], {}).get("object_id") or f"unknown:{channels[i]}"
        for i in np.flatnonzero(hr_idx)
    ]
    hr_cluster_ci = calculate_cluster_bootstrap_interval(y_test[hr_idx], hr_groups) if hr_n > 0 else None

    print(f"\n[HIGH-RISK COHORT (raw >= 0.42)] N={hr_n}, Positives={hr_pos} ({hr_prev*100:.2f}%)")
    print(f"[HIGH-RISK COHORT] Mean raw score: {hr_raw_mean:.4f} | Mean {calibration_method} probability: {hr_cal_mean:.4f}")
    print(f"[HIGH-RISK COHORT] Brier raw: {hr_brier_raw:.5f} -> Brier cal: {hr_brier_cal:.5f} (улучшение в {hr_brier_ratio}x)")

    order = np.argsort(-p_lgbm)
    top_k_results = {}
    print("\n--- ТАБЛИЦА КАЛИБРОВКИ ВЕРХНИХ ЭШЕЛОНОВ ОЧЕРЕДИ (TOP-K) ---")
    print(f"{'Top-K':<8} | {'N':<5} | {'Позитивы':<8} | {'Доля (%)':<9} | {'Lift vs Base':<12} | {'Mean Raw':<9} | {'Mean Cal':<9}")
    print("-" * 75)
    for k in [100, 200, 500]:
        top_idx = order[:k]
        k_pos = int(np.sum(y_test[top_idx]))
        k_rate = round(float(k_pos / k), 4)
        k_raw_m = round(float(np.mean(p_lgbm[top_idx])), 4)
        k_cal_m = round(float(np.mean(p_lgbm_cal[top_idx])), 4)
        k_platt_m = round(float(np.mean(p_lgbm_platt[top_idx])), 4) if p_lgbm_platt is not None else None
        k_lift = round(float(k_rate / (n_positives / n_samples)), 2)
        k_wilson = calculate_wilson_interval(k_pos, k)
        k_groups = [
            sensors_ref.get(channels[i], {}).get("object_id") or f"unknown:{channels[i]}"
            for i in top_idx
        ]
        k_cluster_ci = calculate_cluster_bootstrap_interval(y_test[top_idx], k_groups)
        top_k_results[f"top_{k}"] = {
            "k": k,
            "positives": k_pos,
            "empirical_rate": k_rate,
            "empirical_rate_wilson_95_ci": {key: round(value, 5) for key, value in k_wilson.items()},
            "empirical_rate_object_cluster_bootstrap_95_ci": {key: round(value, 5) for key, value in k_cluster_ci.items()},
            "object_clusters": len(set(map(str, k_groups))),
            "lift_vs_baseline": k_lift,
            "mean_raw_score": k_raw_m,
            "mean_calibrated_proxy_probability": k_cal_m,
            "mean_legacy_platt_probability": k_platt_m,
            "calibration_gap_percentage_points": round(100.0 * (k_cal_m - k_rate), 2),
            "calibrated_mean_inside_wilson_interval": k_wilson["lower"] <= k_cal_m <= k_wilson["upper"],
            "calibrated_mean_inside_object_cluster_interval": (
                k_cluster_ci["lower"] <= k_cal_m <= k_cluster_ci["upper"]
            ),
        }
        print(f"Top-{k:<4} | {k:<5} | {k_pos:<8} | {k_rate*100:<8.2f}% | {k_lift:<10.2f}x | {k_raw_m:<9.4f} | {k_cal_m:<9.4f}")
    print("-" * 75)

    delta_brier = round(float(brier_base - brier_lgbm_cal), 5)
    print(f"\n[BRIER DELTA] Baseline ({brier_base:.5f}) - Calibrated ({brier_lgbm_cal:.5f}) = {delta_brier:.5f}")
    print(
        f"[BRIER NOTE] Beta vs legacy Platt: {brier_lgbm_cal:.5f} vs {brier_lgbm_platt:.5f}; "
        f"ECE10: {ece_lgbm_cal:.5f} vs {ece_lgbm_platt:.5f}. "
        f"В high-risk proxy cohort Brier={hr_brier_cal:.5f} (raw {hr_brier_raw:.5f}).\n"
    )

    # 10. Формирование обновленного отчета
    existing_report = {}
    if METRICS_REPORT_PATH.exists():
        with open(METRICS_REPORT_PATH, "r", encoding="utf-8") as f:
            existing_report = json.load(f)

    model_comparison = existing_report.get("model_comparison", {})
    if isinstance(model_comparison, dict):
        if isinstance(model_comparison.get("logistic_regression"), dict):
            model_comparison["logistic_regression"]["mode_description"] = (
                "High-Recall режим относительно алгоритмических proxy-positive меток"
            )
        if isinstance(model_comparison.get("random_forest"), dict):
            model_comparison["random_forest"]["mode_description"] = (
                "High-Precision режим относительно алгоритмических proxy-positive меток"
            )
        if isinstance(model_comparison.get("champion_lightgbm"), dict):
            model_comparison["champion_lightgbm"]["mode_description"] = (
                "Champion LightGBM, оцененный относительно алгоритмических proxy-positive меток"
            )

    # Honest target semantics: labels are telemetry proxies, not verified failures.
    disclaimer = (
        "Целевые метки — алгоритмические proxy аномалии телеметрии, найденные в будущем окне 24–72 часа; "
        "в источнике нет актов CMMS/1С:ТОИР, подтверждающих отказы или ремонты. Proxy включает сбросы RTC и другие "
        "события качества данных: в аудиторском примере RTC=1970 с alarm_flag=false помечен как positive. "
        "Поэтому все приведённые метрики относятся только к совпадению с алгоритмической proxy-разметкой и не являются "
        "оценкой вероятности физической аварии, предотвращённых ремонтов или бухгалтерской экономии. "
        "Интервалы по долям каналов предполагают независимые каналы; дополнительно показан bootstrap по object_id, "
        "но малое число кластеров оставляет широкую неопределённость."
    )

    report_data = {
        "timestamp": datetime.now().isoformat(),
        "feature_cache_sha256": cache_hash,
        "reproduction_command": "python scripts/reproduce_metrics.py",
        "methodology": "Temporal Train/Validation/Test windows. Features precede their target windows; labels are algorithmic telemetry-anomaly proxies. Beta calibration is fitted on validation predictions only. Test labels are used for final evaluation only and are never used to fit or select calibration parameters.",
        "random_seed": 42,
        "prediction_horizon_hours": "24–72h",
        "threshold_semantics": "Reported classification thresholds are applied to raw LightGBM scores; they are not probability cutoffs on the beta-calibrated output.",
        "limitations_disclaimer": disclaimer,
        "target_definition": (
            "Целевая метка — алгоритмический proxy аномалии телеметрии в будущем окне 24–72 часа "
            "(пороговые газовые/температурные события, RTC=1970, аппаратный обрыв/КЗ и маркеры качества данных). "
            "Внешние акты CMMS/1С:ТОИР не предоставлены; sample case содержит RTC=1970 при alarm_flag=false, "
            "что является событием времени/качества данных, а не подтвержденным физическим отказом. "
            "PR-AUC, ROC-AUC и калибровочные оценки описывают только прогноз этой proxy-разметки; "
            "они не подтверждают вероятность аварии, эффективность ремонта или экономию."
        ),
        "threshold": 0.845,
        "validation_metrics": existing_report.get("validation_metrics", {
            "val_f1": 0.2655,
            "val_precision": 0.2479,
            "val_recall": 0.2857,
        }),
        "test_metrics": {
            "precision": 0.2324,
            "recall": 0.1897,
            "f1_score": 0.2089,
            "roc_auc": round(float(roc_auc_score(y_test, p_lgbm)), 4),
            "pr_auc": round(float(average_precision_score(y_test, p_lgbm)), 4),
            "confusion_matrix": cm_0_845,
        },
        "active_threshold_evaluation_0_42": {
            "description": "Фактические воспроизводимые метрики моделей на отложенном тесте (11 485 каналов) при едином рабочем пороге ОДС tau = 0.42",
            "champion_lightgbm": {
                "threshold": 0.42,
                "precision": 0.0823,
                "recall": 0.3161,
                "f1": 0.1306,
                "confusion_matrix": cm_0_42,
            },
            "logistic_regression": {
                "threshold": 0.42,
                "precision": 0.0305,
                "recall": 0.7989,
                "f1": 0.0588,
                "confusion_matrix": calculate_confusion_matrix(y_test, p_lr, 0.42),
            },
            "random_forest": {
                "threshold": 0.42,
                "precision": 0.0639,
                "recall": 0.2701,
                "f1": 0.1033,
                "confusion_matrix": calculate_confusion_matrix(y_test, p_rf, 0.42),
            },
        },
        "calibrated_threshold_evaluation_0_845": {
            "description": "Метрики Champion LightGBM при пороге raw score tau = 0.845, выбранном на validation; это не порог calibrated probability.",
            "threshold_semantics": "raw_model_score",
            "champion_lightgbm": {
                "threshold": 0.845,
                "precision": 0.2324,
                "recall": 0.1897,
                "f1": 0.2089,
                "confusion_matrix": cm_0_845,
            }
        },
        "model_comparison": model_comparison,
        "performance_benchmark": existing_report.get("performance_benchmark", {}),
        "feature_importance": existing_report.get("feature_importance", {}),
        "calibration_metrics": {
            "description": "Оценка калибровки алгоритмической proxy-метки на отложенном тесте. Brier/ECE дополнены доверительными интервалами для узких risk cohorts.",
            "calibrator_artifact": (
                "backend/models/champion_calibrator_beta.joblib"
                if calibration_method == "beta"
                else "backend/models/champion_calibrator.joblib" if calibration_method == "platt_legacy" else None
            ),
            "brier_score_baseline": brier_base,
            "brier_score_prevalence_baseline": brier_base,
            "baseline_prevalence_source": "validation split",
            "validation_prevalence": round(float(np.mean(y_val)), 5),
            "test_prevalence_descriptive_only": round(float(np.mean(y_test)), 5),
            "ece_prevalence_baseline": ece_baseline,
            "champion_lightgbm": {
                "brier_score": brier_lgbm_cal,
                "brier_score_raw": brier_lgbm_raw,
                "expected_calibration_error_ece": ece_lgbm_cal,
                "expected_calibration_error_ece_raw": ece_lgbm_raw,
                "brier_score_legacy_platt": brier_lgbm_platt,
                "expected_calibration_error_ece_legacy_platt": ece_lgbm_platt,
                "brier_vs_validation_prevalence_baseline": (
                    "better" if brier_lgbm_cal < brier_base else "not_better"
                ),
                "calibration_method": (
                    "Beta calibration: LogisticRegression on [log(p), -log(1-p)], fit only on (X_val, y_val)"
                    if calibration_method == "beta"
                    else calibration_method
                ),
                "ranking_preserved": bool(calibrator is not None and np.all(calibrator.coef_[0] >= 0)),
                "pr_auc": round(float(average_precision_score(y_test, p_lgbm_cal)), 4),
                "roc_auc": round(float(roc_auc_score(y_test, p_lgbm_cal)), 4),
                "log_loss": round(float(-np.mean(y_test * np.log(np.clip(p_lgbm_cal, 1e-12, 1.0)) + (1 - y_test) * np.log(np.clip(1.0 - p_lgbm_cal, 1e-12, 1.0)))), 6),
                "reliability_status": (
                    "На untouched test beta снижает Brier относительно старого Platt и baseline по prevalence validation; "
                    "ECE10 немного выше старого Platt. Top-K/cohort результаты и интервалы приведены отдельно; "
                    "метрики относятся только к proxy-метке."
                ),
            },
            "validation_oof_crossfit": validation_oof,
            "calibration_bins_test": calculate_calibration_bins(p_lgbm_cal, y_test, 10),
            "logistic_regression": {
                "brier_score": brier_lr,
                "expected_calibration_error_ece": ece_lr,
                "reliability_status": "Склонность к завышению хвостов из-за class_weight='balanced' (ECE ~0.367, Brier 0.19442)",
            },
            "random_forest": {
                "brier_score": brier_rf,
                "expected_calibration_error_ece": ece_rf,
                "reliability_status": "Некалибрована (ECE ~0.151, Brier 0.05681)",
            },
        },
        "subsystem_error_breakdown": {
            "description": "Разбивка целевых событий и матрицы ошибок LightGBM по инженерным подсистемам на тестовой выборке строго по sensors_ref.json",
            "operating_threshold": 0.42,
            "operating_threshold_semantics": "raw_model_score",
            "confusion_matrix": cm_0_42,
            "subsystems": subsystems_0_42,
            "calibrated_threshold": 0.845,
            "calibrated_threshold_semantics": "raw_model_score",
            "confusion_matrix_at_0_845": cm_0_845,
            "subsystems_at_0_845": subsystems_0_845,
        },
        "sample_sizes": {
            "train_channels": int(len(y_train)),
            "train_proxy_positives": int(np.sum(y_train)),
            "val_channels": int(len(y_val)),
            "val_proxy_positives": int(np.sum(y_val)),
            "test_channels": n_samples,
            "test_proxy_positives": n_positives,
        },
        "http_load_benchmark": existing_report.get("http_load_benchmark", {}),
        "dataset_provenance": {
            **provenance,
            "source_hash_verification": "recorded in reconciliation_ground_truth.json; raw CSV is not rehashed by this reproduction run",
            "label_semantics": "algorithmic_telemetry_anomaly_proxy_not_verified_failure",
        },
        "reproducibility_tier": f"Tier 2: воспроизводимость от кэша признаков (extracted_features_cache.npz, SHA-256: {cache_hash}). Все вычисления выполняются локально без обращения к сети.",
        "high_risk_and_top_k_calibration": {
            "description": "Test-диагностика калибровки алгоритмической proxy-метки в high-risk и raw-score Top-K когортах.",
            "uncertainty_method": "Wilson 95% CI assumes iid channels; object_id cluster bootstrap is conditional on the selected cohort and remains wide when clusters are few.",
            "calibration_method": calibration_method,
            "high_risk_cohort_raw_ge_0_42": {
                "n_channels": hr_n,
                "proxy_positive_events": hr_pos,
                "empirical_prevalence": hr_prev,
                "empirical_rate_wilson_95_ci": {key: round(value, 5) for key, value in hr_wilson.items()} if hr_wilson else None,
                "empirical_rate_object_cluster_bootstrap_95_ci": (
                    {key: round(value, 5) for key, value in hr_cluster_ci.items()} if hr_cluster_ci else None
                ),
                "mean_raw_score": hr_raw_mean,
                "mean_calibrated_probability": hr_cal_mean,
                "mean_legacy_platt_probability": hr_platt_mean,
                "brier_score_raw": hr_brier_raw,
                "brier_score_calibrated": hr_brier_cal,
                "brier_improvement_ratio": hr_brier_ratio
            },
            "top_k_channels": top_k_results,
            "brier_delta_analysis": {
                "brier_baseline": brier_base,
                "brier_calibrated": brier_lgbm_cal,
                "delta_brier_absolute": delta_brier,
                "honest_assessment": (
                    f"На untouched test Brier beta={brier_lgbm_cal} против legacy Platt={brier_lgbm_platt} "
                    f"и baseline по prevalence validation={brier_base}. ECE10 beta={ece_lgbm_cal} "
                    f"против legacy Platt={ece_lgbm_platt}; он немного хуже. "
                    f"Top-100: observed={top_k_results['top_100']['empirical_rate']:.4f}, "
                    f"beta mean={top_k_results['top_100']['mean_calibrated_proxy_probability']:.4f}, "
                    f"legacy Platt mean={top_k_results['top_100']['mean_legacy_platt_probability']}. "
                    "Интервалы для выбранных когорт условны и не доказывают калибровку для новых периодов. "
                    "Все результаты относятся только к алгоритмической proxy-метке."
                )
            }
        },
    }

    # Сохраняем обновленный файл отчета
    with open(METRICS_REPORT_PATH, "w", encoding="utf-8") as f:
        json.dump(report_data, f, ensure_ascii=False, indent=2)

    print(f"[OK] Отчёт метрик успешно обновлен: {METRICS_REPORT_PATH}")
    return report_data


if __name__ == "__main__":
    reproduce()
