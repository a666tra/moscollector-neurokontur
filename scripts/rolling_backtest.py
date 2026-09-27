"""Rolling-origin backtest of the incident-risk model on the real СМВУ journal.

Weekly forecast dates (cutoffs) from 2026-01-14 to 2026-06-24. For every cutoff
we build features from history strictly before it and the label from telemetry
24–72 h after it (same rules as training, ``backend/ml/features.py``).

Stage 1 (``--extract``, needs dataset/extracted/ext-journal-2026.csv, ~1.5 GB):
    one streaming pass over the journal -> backend/data/rolling_backtest_features.npz
Stage 2 (default): evaluation from the cache, no raw data needed
    -> backend/models/rolling_backtest_report.json

Evaluated scorers on every test week:
  * deployed      – the shipped champion_lgbm.joblib, trained once on data up to
                    2026-01-17 and never retrained (out-of-time stability test);
  * lgbm_weekly   – LightGBM retrained each week on all earlier weeks
                    (expanding window), threshold picked on the previous week;
  * logreg_weekly – logistic regression with the same protocol;
  * persistence   – naive rule "channel already produced fault rows in the last 7 days"
                    (score = number of such rows); the baseline a dispatcher has today.
Two populations: all channels, and "new incidents" = channels with no fault row
in the 7 days before the cutoff (the case where a forecast adds information).
"""
import argparse
import csv
import json
import os
import sys
import time
from datetime import datetime, timedelta
from functools import lru_cache

import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, ROOT)
from backend.ml.features import FEATURE_NAMES, build_category_maps, channel_features, is_failure_value  # noqa: E402

CSV_PATH = os.path.join(ROOT, 'dataset', 'extracted', 'ext-journal-2026.csv')
CACHE_PATH = os.path.join(ROOT, 'backend', 'data', 'rolling_backtest_features.npz')
REPORT_PATH = os.path.join(ROOT, 'backend', 'models', 'rolling_backtest_report.json')
FIRST_CUTOFF = datetime(2026, 1, 14)
N_CUTOFFS = 24                      # 2026-01-14 ... 2026-06-24, weekly
LABEL_FROM, LABEL_TO = timedelta(hours=24), timedelta(hours=72)
TOP_K = (50, 100, 200)
SEED = 42


def cutoffs():
    return [FIRST_CUTOFF + timedelta(days=7 * i) for i in range(N_CUTOFFS)]


# --------------------------------------------------------------------------- stage 1
EPOCH0 = datetime(2026, 1, 1)


def load_journal(channel_index):
    """Read the journal into compact arrays sorted by time.

    The organizers' file is not globally sorted (≈5 M June rows are appended after
    the main block), so rows are loaded fully and sorted instead of streamed.
    Returns cid (int32), ts (int32, seconds since 2026-01-01), alarm (bool),
    value code (int32) and the list of distinct raw values.
    """
    from array import array
    cid_a, ts_a, al_a, val_a = array('i'), array('i'), array('b'), array('i')
    codes, values, day_cache = {}, [], {}
    with open(CSV_PATH, encoding='utf-8', errors='replace', newline='') as f:
        reader = csv.reader(f)
        next(reader)
        for row in reader:
            if len(row) < 6:
                continue
            ci = channel_index.get(row[1])
            if ci is None:
                continue
            d = row[2]
            base = day_cache.get(d)
            if base is None:
                try:
                    base = day_cache[d] = int((datetime(int(d[:4]), int(d[5:7]), int(d[8:10])) - EPOCH0).total_seconds())
                except ValueError:
                    continue
            t = row[3]
            try:
                sec = int(t[:2]) * 3600 + int(t[3:5]) * 60 + int(t[6:8])
            except ValueError:
                continue
            v = row[5]
            vc = codes.get(v)
            if vc is None:
                vc = codes[v] = len(values)
                values.append(v)
            cid_a.append(ci); ts_a.append(base + sec); al_a.append(row[4] in ('t', 'true', 'True', '1')); val_a.append(vc)
    cid, ts = np.frombuffer(cid_a, dtype=np.int32), np.frombuffer(ts_a, dtype=np.int32)
    alarm, val = np.frombuffer(al_a, dtype=np.int8).astype(bool), np.frombuffer(val_a, dtype=np.int32)
    unsorted = int((np.diff(ts) < 0).sum())
    order = np.argsort(ts, kind='stable')
    return cid[order], ts[order], alarm[order], val[order], values, unsorted


def extract():
    with open(os.path.join(ROOT, 'backend/data/sensors_ref.json'), encoding='utf-8') as f:
        sensors_ref = json.load(f)
    with open(os.path.join(ROOT, 'backend/data/objects_ref.json'), encoding='utf-8') as f:
        objects_ref = json.load(f)
    stype_map, sys_map = build_category_maps(sensors_ref)
    channels = sorted(sensors_ref.keys())
    n_ch = len(channels)
    cuts = cutoffs()
    t0 = time.time()
    cid, ts, alarm, val, values, unsorted = load_journal({c: i for i, c in enumerate(channels)})
    print(f'Loaded {len(ts):,} rows ({unsorted:,} order breaks, re-sorted) in {time.time()-t0:.0f}s', flush=True)

    # Fault flag per row, evaluated once per distinct (value, alarm, sensor group).
    groups = {}
    ch_group = np.array([groups.setdefault((sensors_ref[c].get('sensor_type', ''), sensors_ref[c].get('tag', '')),
                                           len(groups)) for c in channels], dtype=np.int64)
    inv_groups = {g: k for k, g in groups.items()}
    key = (val.astype(np.int64) * len(groups) + ch_group[cid]) * 2 + alarm
    uniq, inverse = np.unique(key, return_inverse=True)
    uniq_fault = np.array([is_failure_value(values[int(k // 2 // len(groups))], bool(k % 2),
                                            *inv_groups[int(k // 2 % len(groups))]) for k in uniq], dtype=bool)
    fault = uniq_fault[inverse]
    print(f'Fault rule evaluated on {len(uniq):,} distinct combinations, {int(fault.sum()):,} fault rows', flush=True)

    X = np.zeros((N_CUTOFFS, n_ch, len(FEATURE_NAMES)), dtype=np.float32)
    fault_7d = np.zeros((N_CUTOFFS, n_ch), dtype=np.int32)
    alarm_hist_7d = np.zeros((N_CUTOFFS, n_ch), dtype=np.int32)
    y_fault = np.zeros((N_CUTOFFS, n_ch), dtype=np.int8)
    y_alarm = np.zeros((N_CUTOFFS, n_ch), dtype=np.int8)
    last = np.full(n_ch, -1, dtype=np.int64)
    sec = lambda dt: int((dt - EPOCH0).total_seconds())  # noqa: E731
    prev_hi = 0
    for k, c in enumerate(cuts):
        lo, hi = np.searchsorted(ts, sec(c - timedelta(days=7))), np.searchsorted(ts, sec(c))
        np.maximum.at(last, cid[prev_hi:hi], ts[prev_hi:hi])       # last row strictly before c
        prev_hi = hi
        h_cid, h_ts, h_al, h_val = cid[lo:hi], ts[lo:hi], alarm[lo:hi], val[lo:hi]
        order = np.argsort(h_cid, kind='stable')                   # keeps time order per channel
        bounds = np.searchsorted(h_cid[order], np.arange(n_ch + 1))
        for i, ch in enumerate(channels):
            rows = order[bounds[i]:bounds[i + 1]]
            evs = [(EPOCH0 + timedelta(seconds=int(h_ts[r])), bool(h_al[r]), values[h_val[r]]) for r in rows]
            s_info = sensors_ref[ch]
            last_dt = EPOCH0 + timedelta(seconds=int(last[i])) if last[i] >= 0 else None
            X[k, i] = channel_features(evs, c, s_info, objects_ref.get(s_info.get('object_id', ''), {}),
                                       stype_map, sys_map, last_dt)
        fault_7d[k] = np.bincount(h_cid, weights=fault[lo:hi], minlength=n_ch).astype(np.int32)
        alarm_hist_7d[k] = np.bincount(h_cid, weights=h_al, minlength=n_ch).astype(np.int32)
        a = np.searchsorted(ts, sec(c + LABEL_FROM), 'left')
        b = np.searchsorted(ts, sec(c + LABEL_TO), 'right')                 # window is inclusive, as in training
        y_fault[k] = np.bincount(cid[a:b], weights=fault[a:b], minlength=n_ch) > 0
        y_alarm[k] = np.bincount(cid[a:b], weights=alarm[a:b], minlength=n_ch) > 0
        print(f'  cutoff {c:%Y-%m-%d}: history rows {hi-lo:,}, label positives {int(y_fault[k].sum())}, '
              f'{time.time()-t0:.0f}s', flush=True)
    np.savez_compressed(CACHE_PATH, X=X, y_fault=y_fault, y_alarm=y_alarm, fault_7d=fault_7d,
                        alarm_hist_7d=alarm_hist_7d, channels=np.array(channels),
                        cutoffs=np.array([c.isoformat() for c in cuts]),
                        feature_names=np.array(FEATURE_NAMES), rows_read=len(ts), order_breaks=unsorted)
    print('Saved', CACHE_PATH)


# --------------------------------------------------------------------------- stage 2
def topk_stats(y, score, k):
    order = np.argsort(-score, kind='stable')[:k]
    hits = int(y[order].sum())
    return hits, hits / k, hits / max(1, int(y.sum()))


def fold_metrics(y, score, threshold=None):
    from sklearn.metrics import average_precision_score, roc_auc_score
    out = {'n': int(len(y)), 'positives': int(y.sum()), 'prevalence': round(float(y.mean()), 5)}
    if 0 < y.sum() < len(y):
        out['roc_auc'] = round(float(roc_auc_score(y, score)), 4)
        out['pr_auc'] = round(float(average_precision_score(y, score)), 4)
    for k in TOP_K:
        hits, p, r = topk_stats(y, score, k)
        out[f'hits_at_{k}'], out[f'precision_at_{k}'], out[f'recall_at_{k}'] = hits, round(p, 4), round(r, 4)
    if threshold is not None:
        pred = score >= threshold
        tp = int((pred & (y == 1)).sum()); fp = int((pred & (y == 0)).sum())
        out.update(threshold=round(float(threshold), 4), flagged=int(pred.sum()), tp=tp, fp=fp,
                   precision=round(tp / max(1, tp + fp), 4), recall=round(tp / max(1, int(y.sum())), 4))
    return out


def best_f1_threshold(y, score):
    best_t, best_f = 0.5, -1.0
    for t in np.quantile(score, np.linspace(0.90, 0.999, 120)):
        pred = score >= t
        tp = (pred & (y == 1)).sum(); p = tp / max(1, pred.sum()); r = tp / max(1, y.sum())
        f = 2 * p * r / (p + r) if p + r else 0.0
        if f > best_f:
            best_t, best_f = float(t), f
    return best_t


def summarize(folds, key):
    vals = [f[key] for f in folds if key in f]
    if not vals:
        return None
    return {'mean': round(float(np.mean(vals)), 4), 'median': round(float(np.median(vals)), 4),
            'p25': round(float(np.percentile(vals, 25)), 4), 'p75': round(float(np.percentile(vals, 75)), 4),
            'min': round(float(np.min(vals)), 4), 'max': round(float(np.max(vals)), 4), 'weeks': len(vals)}


def evaluate():
    import joblib
    import lightgbm as lgb
    from sklearn.linear_model import LogisticRegression
    from sklearn.preprocessing import StandardScaler

    d = np.load(CACHE_PATH, allow_pickle=False)
    X, Y, F7 = d['X'], d['y_fault'].astype(int), d['fault_7d']
    cuts = [str(c)[:10] for c in d['cutoffs']]
    deployed = joblib.load(os.path.join(ROOT, 'backend/models/champion_lgbm.joblib'))
    deployed_thr = 0.845  # operating threshold selected on validation in train_validated_model.py

    first_test = 3   # 2026-02-04: training needs >= 2 earlier weeks + 1 validation week
    scorers = ('deployed', 'lgbm_weekly', 'logreg_weekly', 'persistence')
    weeks = []
    for k in range(first_test, N_CUTOFFS):
        tr = list(range(0, k - 1))
        Xtr, ytr = X[tr].reshape(-1, X.shape[2]), Y[tr].reshape(-1)
        Xva, yva, Xte, yte = X[k - 1], Y[k - 1], X[k], Y[k]
        spw = (len(ytr) - ytr.sum()) / max(1, ytr.sum()) * 0.75
        gbm = lgb.LGBMClassifier(n_estimators=240, learning_rate=0.03, max_depth=6, num_leaves=31,
                                 min_child_samples=15, scale_pos_weight=spw, subsample=0.85,
                                 subsample_freq=1, colsample_bytree=0.85, random_state=SEED, verbosity=-1)
        gbm.fit(Xtr, ytr)
        sc = StandardScaler().fit(Xtr)
        lr = LogisticRegression(class_weight='balanced', max_iter=800, random_state=SEED).fit(sc.transform(Xtr), ytr)
        scores_va = {'lgbm_weekly': gbm.predict_proba(Xva)[:, 1],
                     'logreg_weekly': lr.predict_proba(sc.transform(Xva))[:, 1],
                     'persistence': F7[k - 1].astype(float)}
        scores_te = {'deployed': deployed.predict_proba(Xte)[:, 1],
                     'lgbm_weekly': gbm.predict_proba(Xte)[:, 1],
                     'logreg_weekly': lr.predict_proba(sc.transform(Xte))[:, 1],
                     'persistence': F7[k].astype(float)}
        new_mask = F7[k] == 0
        week = {'cutoff': cuts[k], 'label_window': f'{cuts[k]} +24..72 h', 'train_weeks': len(tr),
                'all': {}, 'new_incidents': {}}
        for name in scorers:
            thr = deployed_thr if name == 'deployed' else (
                0.5 if name == 'persistence' else best_f1_threshold(yva, scores_va[name]))
            week['all'][name] = fold_metrics(yte, scores_te[name], thr)
            week['new_incidents'][name] = fold_metrics(yte[new_mask], scores_te[name][new_mask],
                                                       None if name == 'persistence' else thr)
        weeks.append(week)
        a = week['all']
        print(f"{cuts[k]} pos={a['deployed']['positives']:4d} "
              + ' '.join(f"{n}:AP={a[n].get('pr_auc', 0):.3f}/P@100={a[n]['precision_at_100']:.2f}" for n in scorers),
              flush=True)

    summary = {}
    for pop in ('all', 'new_incidents'):
        summary[pop] = {}
        for name in scorers:
            fl = [w[pop][name] for w in weeks]
            summary[pop][name] = {m: summarize(fl, m) for m in
                                  ('roc_auc', 'pr_auc', 'precision_at_50', 'precision_at_100', 'precision_at_200',
                                   'recall_at_100', 'precision', 'recall')}
            summary[pop][name]['total_hits_at_100'] = int(sum(f['hits_at_100'] for f in fl))
            summary[pop][name]['total_positives'] = int(sum(f['positives'] for f in fl))
        summary[pop]['prevalence'] = summarize([w[pop]['deployed'] for w in weeks], 'prevalence')
    # The first three cutoffs are exactly the train/validation/test cutoffs of the shipped model:
    # check that this independent pipeline reproduces its cached features and labels bit-for-bit.
    consistency = None
    jan_cache = os.path.join(ROOT, 'backend/data/extracted_features_cache.npz')
    if os.path.exists(jan_cache):
        c = np.load(jan_cache, allow_pickle=True)
        same_channels = list(c['channels_list']) == [str(x) for x in d['channels']]
        consistency = {'reference': 'backend/data/extracted_features_cache.npz', 'same_channel_order': same_channels}
        for k, split in enumerate(('train', 'val', 'test')):
            consistency[split] = {
                'max_abs_feature_diff': float(np.abs(X[k] - c[f'X_{split}']).max()) if same_channels else None,
                'label_mismatches': int((Y[k] != c[f'y_{split}']).sum()) if same_channels else None}
    report = {
        'consistency_with_training_cache': consistency,
        'generated_at': datetime.now().isoformat(timespec='seconds'),
        'reproduction_command': 'python scripts/rolling_backtest.py  (add --extract to rebuild the cache from the raw journal)',
        'source': 'dataset/extracted/ext-journal-2026.csv (real СМВУ journal provided by the organizers, 2026-01-01..2026-06-30)',
        'rows_read': int(d['rows_read']), 'source_order_breaks_resorted': int(d['order_breaks']),
        'channels': int(X.shape[1]), 'cutoffs': cuts, 'test_weeks': len(weeks),
        'horizon': 'forecast at cutoff 00:00 for the window +24..+72 h',
        'label': 'channel has at least one fault/hazard row (backend/ml/features.py::is_failure_value) in the window',
        'protocol': 'Expanding window: models for week k are trained on weeks < k-1, threshold chosen on week k-1 (max F1), '
                    'evaluated on week k. "deployed" is the shipped model trained once on January data, never retrained.',
        'populations': {'all': 'all registry channels',
                        'new_incidents': 'channels with zero fault rows in the 7 days before the cutoff'},
        'summary': summary, 'weeks': weeks,
    }
    with open(REPORT_PATH, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=1)
    print('Saved', REPORT_PATH)


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--extract', action='store_true', help='rebuild the feature cache from the raw CSV first')
    args = ap.parse_args()
    sys.stdout.reconfigure(encoding='utf-8')
    if args.extract or not os.path.exists(CACHE_PATH):
        extract()
    evaluate()
