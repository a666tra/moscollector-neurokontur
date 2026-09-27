"""Refresh cached proxy probabilities from the active validation-fitted calibrator.

The cache stores rounded raw LightGBM scores, so these probabilities can differ
by a few ten-thousandths from metrics computed from full-precision test scores.
"""

import json
import os
import tempfile
from pathlib import Path

import joblib
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "backend" / "data" / "predictions_cache.json"
CALIBRATOR = ROOT / "backend" / "models" / "champion_calibrator_beta.joblib"


def main() -> None:
    rows = json.loads(CACHE.read_text(encoding="utf-8"))
    if not isinstance(rows, list) or not rows:
        raise ValueError("Prediction cache is empty or malformed")
    raw = np.asarray([float(row["raw_model_score"]) for row in rows])
    clipped = np.clip(raw, 1e-6, 1.0 - 1e-6)
    features = np.column_stack((np.log(clipped), -np.log1p(-clipped)))
    calibrator = joblib.load(CALIBRATOR)
    if int(calibrator.n_features_in_) != 2:
        raise ValueError("Expected a two-feature beta calibrator")
    calibrated = calibrator.predict_proba(features)[:, 1]
    for row, score, probability in zip(rows, raw, calibrated):
        row["failure_probability"] = round(float(score), 4)
        row["calibrated_proxy_probability"] = round(float(probability), 4)
        row["is_calibrated"] = True
        row["calibration_status"] = "CALIBRATED_BETA"
        row["score_semantics"] = (
            "raw_model_score: безразмерный балл модели для ранжирования; "
            "calibrated_proxy_probability: beta-калиброванная вероятность "
            "proxy-отклонения телеметрии 24–72 ч, не физического отказа."
        )
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=CACHE.parent, delete=False) as stream:
        temp_path = Path(stream.name)
        json.dump(rows, stream, ensure_ascii=False, indent=2)
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temp_path, CACHE)
    print(f"Updated {len(rows)} cached scores with beta calibration")


if __name__ == "__main__":
    main()
