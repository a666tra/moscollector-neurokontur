"""Rebuild telemetry-proxy evidence from the supplied journal (run at repo root)."""

import csv
import hashlib
import json
from datetime import datetime
from pathlib import Path

import numpy as np

from backend.ml.train_validated_model import is_failure_value

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "dataset/extracted/ext-journal-2026.csv"
OUTPUT = ROOT / "backend/data/reconciliation_ground_truth.json"
SAMPLES = ("113980", "103937", "104014", "115574", "120500", "212218", "104040")
ROW_LIMIT = 7_000_000  # Same as train_validated_model.py.
START = datetime(2026, 1, 29)
END = datetime(2026, 1, 31)


def confusion(labels, scores, threshold):
    positive = scores >= threshold
    tp = int(np.sum(positive & labels))
    fp = int(np.sum(positive & ~labels))
    fn = int(np.sum(~positive & labels))
    tn = int(np.sum(~positive & ~labels))
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    prevalence = float(np.mean(labels))
    return {"threshold": threshold, "true_positives": tp, "false_positives": fp,
            "false_negatives": fn, "true_negatives": tn,
            "precision": round(precision, 4), "recall": round(recall, 4),
            "f1_score": round(2 * precision * recall / (precision + recall), 4) if precision + recall else 0.0,
            "lift_vs_baseline": round(precision / prevalence, 2) if prevalence else 0.0}


def witnesses(sensors):
    if not SOURCE.is_file():
        raise FileNotFoundError(f"Source journal required: {SOURCE}")
    found = {cid: {"target_window_rows": 0, "first_proxy_event": None} for cid in SAMPLES}
    scanned = 0
    with SOURCE.open("r", encoding="utf-8", errors="replace", newline="") as source:
        reader = csv.reader(source)
        next(reader)
        for index, row in enumerate(reader):
            if index >= ROW_LIMIT:
                break
            scanned += 1
            if len(row) < 6 or row[1] not in found:
                continue
            try:
                dt = datetime.strptime(f"{row[2]} {row[3]}", "%Y-%m-%d %H:%M:%S")
            except ValueError:
                continue
            if not START <= dt <= END:
                continue
            cid = row[1]
            item = found[cid]
            item["target_window_rows"] += 1
            sensor = sensors[cid]
            if item["first_proxy_event"] is None and is_failure_value(
                row[5], row[4] in ("t", "true", "True", "1"),
                sensor.get("sensor_type", ""), sensor.get("tag", "")):
                item["first_proxy_event"] = {
                    "source_csv_line": index + 2, "event_id": row[0],
                    "event_timestamp": dt.isoformat(sep=" "), "alarm_flag": row[4],
                    "raw_sensor_value": row[5],
                    "label_rule": "is_failure_value in backend/ml/train_validated_model.py"}
    return found, scanned


def build():
    with np.load(ROOT / "backend/data/extracted_features_cache.npz", allow_pickle=True) as cache:
        channels = [str(cid) for cid in cache["channels_list"]]
        labels = np.asarray(cache["y_test"], dtype=bool)
    predictions = json.loads((ROOT / "backend/data/predictions_cache.json").read_text(encoding="utf-8"))
    sensors = json.loads((ROOT / "backend/data/sensors_ref.json").read_text(encoding="utf-8"))
    objects = json.loads((ROOT / "backend/data/objects_ref.json").read_text(encoding="utf-8"))
    report = json.loads((ROOT / "backend/models/metrics_report.json").read_text(encoding="utf-8"))
    by_channel = {str(p["channel_id"]): p for p in predictions}
    if set(channels) != set(by_channel) or len(channels) != len(labels):
        raise ValueError("Prediction and feature caches cover different channels")
    scores = np.array([float(by_channel[cid]["failure_probability"]) for cid in channels])
    for threshold, expected in (
        (0.42, report["active_threshold_evaluation_0_42"]["champion_lightgbm"]["confusion_matrix"]),
        (0.845, report["test_metrics"]["confusion_matrix"]),
    ):
        measured = confusion(labels, scores, threshold)
        if any(measured[name] != expected[short] for name, short in (
            ("true_positives", "tp"), ("false_positives", "fp"),
            ("false_negatives", "fn"), ("true_negatives", "tn"),
        )):
            raise ValueError(f"Cached scores disagree with model report at threshold {threshold}")
    evidence, scanned = witnesses(sensors)
    digest = hashlib.sha256()
    with SOURCE.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    cases = []
    for cid in SAMPLES:
        index = channels.index(cid)
        label = bool(labels[index])
        witness = evidence[cid]
        if label != (witness["first_proxy_event"] is not None):
            raise ValueError(f"Journal and cached proxy label disagree for {cid}")
        sensor = sensors[cid]
        score = float(scores[index])
        classified = score >= 0.42
        cases.append({
            "channel_id": cid, "sensor_name": sensor.get("sensor_name", ""),
            "sensor_type": sensor.get("sensor_type", ""),
            "object_name": objects.get(str(sensor.get("object_id", "")), {}).get("name", ""),
            "predicted_prob": score, "proxy_label": int(label),
            "classification_at_tau_0_42": "TP" if label and classified else "FP" if classified else "FN" if label else "TN",
            "target_window_rows": witness["target_window_rows"],
            "first_proxy_event": witness["first_proxy_event"]})
    payload = {
        "evidence_type": "algorithmic_telemetry_proxy",
        "methodology": "Прогноз по истории до 28.01.2026 00:00; целевая метка определяется функцией is_failure_value по телеметрии 29–31.01.2026. Это алгоритмическая аномалия, а не подтвержденный акт ремонта, предотвращенная авария или экономия.",
        "source_journal": "dataset/extracted/ext-journal-2026.csv",
        "source_journal_sha256": digest.hexdigest(),
        "source_journal_bytes": SOURCE.stat().st_size,
        "source_csv_committed": False, "source_rows_scanned": scanned, "source_row_limit": ROW_LIMIT,
        "prediction_cutoff": "2026-01-28 00:00:00", "target_window_start": "2026-01-29 00:00:00",
        "target_window_end_inclusive": "2026-01-31 00:00:00",
        "dataset_channels_total": len(channels), "proxy_positive_channels": int(np.sum(labels)),
        "operational_matrix_tau_0_42": confusion(labels, scores, 0.42),
        "high_precision_matrix_tau_0_845": confusion(labels, scores, 0.845),
        "ranking_metrics_from_report": {"roc_auc": report["test_metrics"]["roc_auc"],
                                        "pr_auc": report["test_metrics"]["pr_auc"]},
        "sample_cases": cases,
        "limitations": [
            "Метка выводится из будущей телеметрии и не сверена с журналом ремонтных работ или CMMS.",
            "Отсутствие прокси-события в ограниченном окне не доказывает исправность датчика.",
            "Прогнозы в поставляемом JSON округлены; матрицы по ним могут немного отличаться от метрик модели полного разрешения.",
            "Исходный CSV не включен в репозиторий; номера строк и ID событий позволяют сверить примеры при наличии датасета."]}
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Generated {OUTPUT}; scanned {scanned:,} source rows")


if __name__ == "__main__":
    build()
