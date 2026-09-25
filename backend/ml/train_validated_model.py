import os
import sys
import json
import csv
import time
import collections
from datetime import datetime, timedelta
import numpy as np
import joblib

from sklearn.metrics import (
    precision_score, recall_score, f1_score, roc_auc_score,
    average_precision_score, confusion_matrix
)
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
import lightgbm as lgb

sys.stdout.reconfigure(encoding='utf-8')

FAILURE_VALUES = {
    'неисправен', 'отключено устройство', 'много неисправных устройств',
    '01.01.1970 03:00:00', '01.01.1970 03:00:01', 'обрыв датчика',
    'короткое замыкание', 'ошибка связи', 'нет ответа'
}

def is_failure_value(val_str: str, is_alarm: bool) -> bool:
    v = str(val_str).strip().lower()
    if v in FAILURE_VALUES:
        return True
    if 'неисправ' in v or 'отключ' in v or 'обрыв' in v or 'сбой' in v or 'авар' in v or 'кз' in v:
        return True
    if '1970' in v:
        return True
    try:
        num = float(v)
        # Out-of-bounds analog sensor failure
        if num < 0.0 or num > 100.0:
            return True
        # Severe methane or temperature threshold in alarm state
        if is_alarm and num >= 1.0:
            return True
    except ValueError:
        pass
    return False

def run_leakage_free_pipeline():
    print("=" * 60)
    print("  МОСКОЛЛЕКТОР: СТРОГОЕ ОБУЧЕНИЕ И 3-WAY ТЕМПОРАЛЬНАЯ ВАЛИДАЦИЯ")
    print("  (Защита от утечек данных, честная оценка горизонта 24–72ч)")
    print("=" * 60)

    # 1. Load references
    with open('backend/data/sensors_ref.json', 'r', encoding='utf-8') as f:
        sensors_ref = json.load(f)
    with open('backend/data/objects_ref.json', 'r', encoding='utf-8') as f:
        objects_ref = json.load(f)

    csv_path = 'dataset/extracted/ext-journal-2026.csv'
    max_rows = 7000000

    # Strict temporal cuts
    # Train: history < Jan 14, evaluate failure in [Jan 15 00:00, Jan 17 00:00] (24-72h)
    cutoff_train = datetime(2026, 1, 14)
    target_train_start = cutoff_train + timedelta(hours=24)
    target_train_end = cutoff_train + timedelta(hours=72)

    # Val: history < Jan 21, evaluate failure in [Jan 22 00:00, Jan 24 00:00] (24-72h)
    cutoff_val = datetime(2026, 1, 21)
    target_val_start = cutoff_val + timedelta(hours=24)
    target_val_end = cutoff_val + timedelta(hours=72)

    # Test (strictly held-out): history < Jan 28, evaluate failure in [Jan 29 00:00, Jan 31 00:00] (24-72h)
    cutoff_test = datetime(2026, 1, 28)
    target_test_start = cutoff_test + timedelta(hours=24)
    target_test_end = cutoff_test + timedelta(hours=72)

    history_train = collections.defaultdict(list)
    failures_train = set()

    history_val = collections.defaultdict(list)
    failures_val = set()

    history_test = collections.defaultdict(list)
    failures_test = set()

    all_channels = set(sensors_ref.keys())
    active_channels = set()

    print(f"Чтение журнала СМВУ (до {max_rows} записей)...")
    t0 = time.time()
    with open(csv_path, 'r', encoding='utf-8', errors='replace') as f:
        reader = csv.reader(f)
        next(reader) # skip header
        for i, row in enumerate(reader):
            if i >= max_rows:
                break
            if len(row) < 6:
                continue

            cid, d_str, t_str, alarm_str, val_str = row[1], row[2], row[3], row[4], row[5]
            if cid not in all_channels:
                continue

            try:
                dt = datetime.strptime(f"{d_str} {t_str}", "%Y-%m-%d %H:%M:%S")
            except Exception:
                continue

            active_channels.add(cid)
            is_alarm = alarm_str in ('t', 'true', 'True', '1')
            is_fail = is_failure_value(val_str, is_alarm)

            # Train split
            if dt < cutoff_train:
                history_train[cid].append((dt, is_alarm, val_str))
            elif target_train_start <= dt <= target_train_end and is_fail:
                failures_train.add(cid)

            # Val split
            if dt < cutoff_val:
                history_val[cid].append((dt, is_alarm, val_str))
            elif target_val_start <= dt <= target_val_end and is_fail:
                failures_val.add(cid)

            # Test split (completely separate)
            if dt < cutoff_test:
                history_test[cid].append((dt, is_alarm, val_str))
            elif target_test_start <= dt <= target_test_end and is_fail:
                failures_test.add(cid)

    print(f"Обработано за {time.time() - t0:.1f} сек. Активных каналов: {len(active_channels)}")
    print(f"Реальных отказов в окне 24–72ч: Train={len(failures_train)}, Val={len(failures_val)}, Test={len(failures_test)}")

    channels_list = sorted(list(active_channels))

    # Encoder for categorical fields
    sensor_types = sorted(list(set(s.get('sensor_type', 'unknown') for s in sensors_ref.values())))
    stype_map = {t: idx for idx, t in enumerate(sensor_types)}
    system_types = sorted(list(set(s.get('system_type', 'unknown') for s in sensors_ref.values())))
    sys_map = {s: idx for idx, s in enumerate(system_types)}

    def extract_features(events_dict, cutoff_dt):
        X = []
        for cid in channels_list:
            s_info = sensors_ref.get(cid, {})
            oid = s_info.get('object_id', '')
            o_info = objects_ref.get(oid, {})

            evs = events_dict.get(cid, [])
            evs.sort(key=lambda x: x[0])

            dt_24h = cutoff_dt - timedelta(hours=24)
            dt_7d = cutoff_dt - timedelta(days=7)

            evs_24h = [e for e in evs if e[0] >= dt_24h]
            evs_7d = [e for e in evs if e[0] >= dt_7d]

            cnt_24h = len(evs_24h)
            cnt_7d = len(evs_7d)

            alarms_24h = sum(1 for e in evs_24h if e[1])
            alarms_7d = sum(1 for e in evs_7d if e[1])
            alarm_ratio = alarms_7d / max(1, cnt_7d)

            acc_events = cnt_24h / (cnt_7d / 7.0 + 0.1)
            acc_alarms = alarms_24h / (alarms_7d / 7.0 + 0.1)

            chatter_cnt = 0
            prev_dt = None
            prev_val = None
            date_corruptions = 0
            battery_glitches = 0
            unique_states = set()
            numeric_vals = []
            gas_spikes = 0
            temp_spikes = 0

            for dt, is_al, v in evs_7d:
                v_str = str(v).strip()
                unique_states.add(v_str)

                if prev_dt is not None:
                    gap = (dt - prev_dt).total_seconds()
                    if gap < 60 and v_str != prev_val:
                        chatter_cnt += 1
                prev_dt = dt
                prev_val = v_str

                if '1970' in v_str:
                    date_corruptions += 1
                if 'батаре' in v_str.lower() or 'обесточ' in v_str.lower():
                    battery_glitches += 1

                try:
                    num = float(v_str)
                    numeric_vals.append(num)
                    stype = s_info.get('sensor_type', '').lower()
                    if 'газ' in stype and num >= 1.0:
                        gas_spikes += 1
                    if 'темп' in stype and num >= 35.0:
                        temp_spikes += 1
                except ValueError:
                    pass

            chatter_ratio = chatter_cnt / max(1, cnt_7d)
            silence_hours = max(0.0, (cutoff_dt - evs[-1][0]).total_seconds() / 3600.0) if evs else 168.0
            num_mean = float(np.mean(numeric_vals)) if numeric_vals else 0.0
            num_std = float(np.std(numeric_vals)) if len(numeric_vals) > 1 else 0.0
            num_max = float(np.max(numeric_vals)) if numeric_vals else 0.0

            stype_str = s_info.get('sensor_type', '')
            sys_str = s_info.get('system_type', '')
            obj_level = int(o_info.get('hierarchy_level', 3)) if o_info else 3

            feat = [
                cnt_24h,
                cnt_7d,
                alarms_24h,
                alarms_7d,
                alarm_ratio,
                acc_events,
                acc_alarms,
                chatter_cnt,
                chatter_ratio,
                battery_glitches,
                date_corruptions,
                len(unique_states),
                silence_hours,
                num_mean,
                num_std,
                num_max,
                stype_map.get(stype_str, 0),
                sys_map.get(sys_str, 0),
                gas_spikes,
                temp_spikes,
                obj_level
            ]
            X.append(feat)

        return np.array(X, dtype=np.float32)

    print("\nИзвлечение физических признаков для Train, Val, Test...")
    X_train = np.nan_to_num(extract_features(history_train, cutoff_train))
    y_train = np.array([1 if cid in failures_train else 0 for cid in channels_list], dtype=np.int32)

    X_val = np.nan_to_num(extract_features(history_val, cutoff_val))
    y_val = np.array([1 if cid in failures_val else 0 for cid in channels_list], dtype=np.int32)

    X_test = np.nan_to_num(extract_features(history_test, cutoff_test))
    y_test = np.array([1 if cid in failures_test else 0 for cid in channels_list], dtype=np.int32)

    print(f"Размер выборки Train: {X_train.shape}, Целевых отказов: {sum(y_train)} / {len(y_train)}")
    print(f"Размер выборки Val:   {X_val.shape}, Целевых отказов: {sum(y_val)} / {len(y_val)}")
    print(f"Размер выборки Test:  {X_test.shape}, Целевых отказов: {sum(y_test)} / {len(y_test)}")

    feature_names = [
        "cnt_24h", "cnt_7d", "alarms_24h", "alarms_7d", "alarm_ratio",
        "acc_events", "acc_alarms", "chatter_cnt", "chatter_ratio",
        "battery_glitches", "date_corruptions", "unique_states",
        "silence_hours", "num_mean", "num_std", "num_max",
        "sensor_type_code", "system_type_code", "gas_spikes", "temp_spikes", "obj_level"
    ]

    # Model 1: Dummy Zero-Rule Baseline (Always Negative)
    dummy_prec = 0.0
    dummy_rec = 0.0
    dummy_f1 = 0.0
    print("\n[Baseline 1] Zero-Rule (Константный прогноз нормы): F1=0.0")

    # Model 2: Logistic Regression (Standard Scaled)
    scaler = StandardScaler()
    X_tr_s = scaler.fit_transform(X_train)
    X_val_s = scaler.transform(X_val)
    X_te_s = scaler.transform(X_test)

    lr_model = LogisticRegression(class_weight='balanced', max_iter=800, random_state=42)
    lr_model.fit(X_tr_s, y_train)
    lr_val_probs = lr_model.predict_proba(X_val_s)[:, 1]
    
    # Tune threshold for Logistic Regression on Validation set
    best_t_lr = 0.5
    best_f1_lr = 0.0
    for t in np.linspace(0.2, 0.8, 60):
        f = f1_score(y_val, (lr_val_probs >= t).astype(int), zero_division=0)
        if f > best_f1_lr:
            best_f1_lr = f
            best_t_lr = t

    lr_test_probs = lr_model.predict_proba(X_te_s)[:, 1]
    lr_test_preds = (lr_test_probs >= best_t_lr).astype(int)
    lr_prec = precision_score(y_test, lr_test_preds, zero_division=0)
    lr_rec = recall_score(y_test, lr_test_preds, zero_division=0)
    lr_f1 = f1_score(y_test, lr_test_preds, zero_division=0)
    lr_roc = roc_auc_score(y_test, lr_test_probs) if len(set(y_test)) > 1 else 0.5
    print(f"[Baseline 2] Logistic Regression (на тесте): Precision={lr_prec:.4f}, Recall={lr_rec:.4f}, F1={lr_f1:.4f}, ROC-AUC={lr_roc:.4f}")

    # Model 3: Random Forest
    rf_model = RandomForestClassifier(n_estimators=100, max_depth=8, class_weight='balanced', random_state=42, n_jobs=-1)
    rf_model.fit(X_train, y_train)
    rf_val_probs = rf_model.predict_proba(X_val)[:, 1]
    best_t_rf = 0.5
    best_f1_rf = 0.0
    for t in np.linspace(0.2, 0.8, 60):
        f = f1_score(y_val, (rf_val_probs >= t).astype(int), zero_division=0)
        if f > best_f1_rf:
            best_f1_rf = f
            best_t_rf = t
    rf_test_probs = rf_model.predict_proba(X_test)[:, 1]
    rf_test_preds = (rf_test_probs >= best_t_rf).astype(int)
    rf_prec = precision_score(y_test, rf_test_preds, zero_division=0)
    rf_rec = recall_score(y_test, rf_test_preds, zero_division=0)
    rf_f1 = f1_score(y_test, rf_test_preds, zero_division=0)
    rf_roc = roc_auc_score(y_test, rf_test_probs) if len(set(y_test)) > 1 else 0.5
    print(f"[Model 3]    Random Forest (на тесте):       Precision={rf_prec:.4f}, Recall={rf_rec:.4f}, F1={rf_f1:.4f}, ROC-AUC={rf_roc:.4f}")

    # Model 4: Champion LightGBM
    pos_count = sum(y_train)
    neg_count = len(y_train) - pos_count
    spw = (neg_count / max(1, pos_count)) * 0.75

    champ_lgbm = lgb.LGBMClassifier(
        n_estimators=240,
        learning_rate=0.03,
        max_depth=6,
        num_leaves=31,
        min_child_samples=15,
        scale_pos_weight=spw,
        subsample=0.85,
        colsample_bytree=0.85,
        random_state=42,
        verbosity=-1
    )
    champ_lgbm.fit(X_train, y_train)

    # STRICT THRESHOLD SELECTION ON VALIDATION SET ONLY
    champ_val_probs = champ_lgbm.predict_proba(X_val)[:, 1]
    best_threshold = 0.5
    best_val_f1 = -1.0
    val_prec_at_best, val_rec_at_best = 0.0, 0.0

    for t in np.linspace(0.15, 0.85, 140):
        preds = (champ_val_probs >= t).astype(int)
        p = precision_score(y_val, preds, zero_division=0)
        r = recall_score(y_val, preds, zero_division=0)
        score = 2 * (p * r) / (p + r) if (p + r) > 0 else 0
        if score > best_val_f1:
            best_val_f1 = score
            best_threshold = float(t)
            val_prec_at_best = p
            val_rec_at_best = r

    print(f"\nПорог отсечки отобран строго на Validation выборке: tau = {best_threshold:.4f} (Val F1={best_val_f1:.4f})")

    # FINAL INDEPENDENT EVALUATION ON TEST SET
    champ_test_probs = champ_lgbm.predict_proba(X_test)[:, 1]
    champ_test_preds = (champ_test_probs >= best_threshold).astype(int)

    test_prec = float(precision_score(y_test, champ_test_preds, zero_division=0))
    test_rec = float(recall_score(y_test, champ_test_preds, zero_division=0))
    test_f1 = float(f1_score(y_test, champ_test_preds, zero_division=0))
    test_roc_auc = float(roc_auc_score(y_test, champ_test_probs)) if len(set(y_test)) > 1 else 0.5
    test_pr_auc = float(average_precision_score(y_test, champ_test_probs)) if len(set(y_test)) > 1 else 0.5
    tn, fp, fn, tp = confusion_matrix(y_test, champ_test_preds).ravel()

    print("\n" + "=" * 60)
    print("  ФИНАЛЬНЫЕ ЧЕСТНЫЕ МЕТРИКИ НА НЕЗАВИСИМОМ ТЕСТЕ (HELD-OUT):")
    print(f"  Precision: {test_prec:.4f} ({test_prec*100:.1f}%)")
    print(f"  Recall:    {test_rec:.4f} ({test_rec*100:.1f}%)")
    print(f"  F1-Score:  {test_f1:.4f}")
    print(f"  ROC-AUC:   {test_roc_auc:.4f}")
    print(f"  PR-AUC:    {test_pr_auc:.4f}")
    print(f"  Confusion Matrix: TP={tp}, FP={fp}, FN={fn}, TN={tn}")
    print("=" * 60)

    # 4. Latency Benchmark
    print("\nЗамер честной производительности инференса (100 итераций)...")
    # Batch latency
    batch_times = []
    for _ in range(30):
        t_start = time.perf_counter()
        _ = champ_lgbm.predict_proba(X_test)
        batch_times.append(time.perf_counter() - t_start)

    avg_batch_sec = float(np.mean(batch_times))
    p95_batch_sec = float(np.percentile(batch_times, 95))

    # Single sensor latency
    single_x = X_test[0:1]
    single_times = []
    for _ in range(200):
        t_start = time.perf_counter()
        _ = champ_lgbm.predict_proba(single_x)
        single_times.append(time.perf_counter() - t_start)

    avg_single_ms = float(np.mean(single_times) * 1000)
    p95_single_ms = float(np.percentile(single_times, 95) * 1000)
    throughput_rps = int(len(X_test) / avg_batch_sec)

    print(f"  Время скоринга ВСЕЙ сети ({len(X_test)} каналов): {avg_batch_sec*1000:.2f} мс (P95: {p95_batch_sec*1000:.2f} мс)")
    print(f"  Инференс одного датчика: {avg_single_ms:.3f} мс")
    print(f"  Пропускная способность: {throughput_rps:,} датчиков/сек")

    # Feature Importance
    importances = dict(zip(feature_names, [int(x) for x in champ_lgbm.feature_importances_]))
    sorted_fi = dict(sorted(importances.items(), key=lambda item: item[1], reverse=True))

    # Save models
    os.makedirs('backend/models', exist_ok=True)
    joblib.dump(champ_lgbm, 'backend/models/champion_lgbm.joblib')
    joblib.dump(scaler, 'backend/models/feature_scaler.joblib')
    joblib.dump(lr_model, 'backend/models/logistic_regression.joblib')
    joblib.dump(rf_model, 'backend/models/random_forest.joblib')

    metrics_report = {
        "timestamp": datetime.now().isoformat(),
        "methodology": "Strict 3-Way Temporal Split (Train -> Validation -> Test). No data leakage. Target defined strictly by future physical events in horizon 24-72h.",
        "random_seed": 42,
        "prediction_horizon_hours": "24–72h",
        "threshold": round(best_threshold, 4),
        "validation_metrics": {
            "val_f1": round(best_val_f1, 4),
            "val_precision": round(val_prec_at_best, 4),
            "val_recall": round(val_rec_at_best, 4)
        },
        "test_metrics": {
            "precision": round(test_prec, 4),
            "recall": round(test_rec, 4),
            "f1_score": round(test_f1, 4),
            "roc_auc": round(test_roc_auc, 4),
            "pr_auc": round(test_pr_auc, 4),
            "confusion_matrix": {
                "tp": int(tp), "fp": int(fp), "fn": int(fn), "tn": int(tn)
            }
        },
        "model_comparison": {
            "zero_rule": {"precision": 0.0, "recall": 0.0, "f1": 0.0},
            "logistic_regression": {
                "precision": round(lr_prec, 4), "recall": round(lr_rec, 4), "f1": round(lr_f1, 4), "roc_auc": round(lr_roc, 4)
            },
            "random_forest": {
                "precision": round(rf_prec, 4), "recall": round(rf_rec, 4), "f1": round(rf_f1, 4), "roc_auc": round(rf_roc, 4)
            },
            "champion_lightgbm": {
                "precision": round(test_prec, 4), "recall": round(test_rec, 4), "f1": round(test_f1, 4), "roc_auc": round(test_roc_auc, 4)
            }
        },
        "performance_benchmark": {
            "full_batch_channels_count": len(X_test),
            "full_batch_latency_ms": round(avg_batch_sec * 1000, 2),
            "full_batch_p95_latency_ms": round(p95_batch_sec * 1000, 2),
            "single_sensor_latency_ms": round(avg_single_ms, 3),
            "single_sensor_p95_latency_ms": round(p95_single_ms, 3),
            "throughput_sensors_per_sec": throughput_rps,
            "tz_sla_seconds": 300.0,
            "speedup_vs_sla": round(300.0 / avg_batch_sec, 0)
        },
        "feature_importance": sorted_fi,
        "sample_sizes": {
            "train_channels": len(X_train),
            "train_failures": int(sum(y_train)),
            "val_channels": len(X_val),
            "val_failures": int(sum(y_val)),
            "test_channels": len(X_test),
            "test_failures": int(sum(y_test))
        }
    }

    with open('backend/models/metrics_report.json', 'w', encoding='utf-8') as f:
        json.dump(metrics_report, f, ensure_ascii=False, indent=2)

    # 5. Generate fresh prediction cache for active channels
    print("\nГенерация кэша предиктивного анализа...")
    predictions_cache = []
    champ_probs = champ_lgbm.predict_proba(X_test)[:, 1]

    for idx, cid in enumerate(channels_list):
        prob = float(champ_probs[idx])
        s_info = sensors_ref.get(cid, {})
        oid = s_info.get('object_id', '')
        obj_name = objects_ref.get(oid, {}).get('name', 'Коллекторный узел')
        stype = s_info.get('sensor_type', 'Датчик')
        systype = s_info.get('system_type', 'СМВУ')

        if prob >= 0.70:
            risk = "CRITICAL"
        elif prob >= 0.45:
            risk = "WARNING"
        elif prob >= 0.25:
            risk = "ATTENTION"
        else:
            risk = "NORMAL"

        feats = X_test[idx]
        factors = []
        if feats[12] > 24: # silence
            factors.append(f"Молчание канала ({feats[12]:.0f} ч)")
        if feats[7] > 3: # chatter
            factors.append(f"Дребезг контактов ({int(feats[7])} флипов)")
        if feats[9] > 0: # battery
            factors.append("Просадка вторичного питания")
        if feats[10] > 0: # clock
            factors.append("Сброс часов контроллера (1970г)")
        if feats[18] > 0:
            factors.append(f"Всплески метана ({int(feats[18])} раз)")

        if not factors:
            factors = ["Штатные колебания телеметрии"]

        if risk == "CRITICAL":
            action = "Срочный наряд-заказ ТО на пикет. Проверка контактной группы и калибровка."
        elif risk == "WARNING":
            action = "Плановый осмотр в графике ППР текущей недели."
        elif risk == "ATTENTION":
            action = "Увеличение частоты телеметрии, контроль диспетчером ОДС."
        else:
            action = "Штатный мониторинг."

        predictions_cache.append({
            "channel_id": cid,
            "object_id": oid,
            "object_name": obj_name,
            "sensor_name": s_info.get('sensor_name', f"Датчик {cid}"),
            "sensor_type": stype,
            "system_type": systype,
            "tag": s_info.get('tag', ''),
            "failure_probability": round(prob, 4),
            "risk_level": risk,
            "is_predicted_failure_24h": prob >= best_threshold,
            "recommended_action": action,
            "explanation_factors": factors,
            "horizon_hours": 48
        })

    # Sort so most critical are first
    predictions_cache.sort(key=lambda x: x["failure_probability"], reverse=True)

    with open('backend/data/predictions_cache.json', 'w', encoding='utf-8') as f:
        json.dump(predictions_cache, f, ensure_ascii=False, indent=2)

    print(f"Успешно сохранено: {len(predictions_cache)} каналов.")
    print("ГОТОВО!")

if __name__ == '__main__':
    run_leakage_free_pipeline()
