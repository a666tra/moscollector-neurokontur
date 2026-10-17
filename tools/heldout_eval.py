# -*- coding: utf-8 -*-
"""Финальный прогон Сценарного полигона на отложенных seed 2000-2019 (режим day)
плюс демонстрационные seed 42 (day, month).

Протокол (docs/SCENARIOS_SPEC.md, раздел «Протокол оценки»): детектор и пороги заморожены
до этого запуска; seed 2000-2019 ранее не запускались; результат публикуется как есть.
Результаты: синтетика, проверка логики, НЕ оценка на реальных авариях.

Запуск:  python tools/heldout_eval.py [путь_к_выходному_json]
Вывод:   docs/SCENARIOS_HELDOUT_RESULTS.json по умолчанию (+ сводка в консоль);
         для сверки на другой платформе укажите другой путь, чтобы не затереть эталон.
"""
import hashlib
import json
import os
import statistics as st
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from backend.app.services import scenario_engine as se  # noqa: E402

HELDOUT_SEEDS = list(range(2000, 2020))
DETECTORS = ["fast", "static_dedup", "naive"]
SCENARIOS = ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"]


def sha256(path):
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


def git_head():
    try:
        return subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    except Exception:
        return "unknown"


def agg(values):
    values = [v for v in values if v is not None]
    if not values:
        return None
    return {"mean": round(st.mean(values), 3), "median": round(st.median(values), 3),
            "min": round(min(values), 3), "max": round(max(values), 3), "n": len(values)}


def main():
    runs = {s: se.run_scenario("day", s) for s in HELDOUT_SEEDS}
    out = {
        "data_origin": "SYNTHETIC",
        "label": "синтетика, отложенные seed 2000-2019 (day), проверка логики, не оценка на реальных авариях",
        "git_head": git_head(),
        "scenario_engine_sha256": sha256(os.path.join(ROOT, "backend", "app", "services", "scenario_engine.py")),
        "spec_sha256": sha256(os.path.join(ROOT, "docs", "SCENARIOS_SPEC.md")),
        "seeds": HELDOUT_SEEDS,
        "thresholds_used": runs[HELDOUT_SEEDS[0]]["thresholds_used"],
        "detectors": {},
        "ratios": {},
        "per_seed": {},
        "demo_seed_42": {},
    }
    for d in DETECTORS:
        block = {"overall": {}, "scenarios": {}, "false_alarms": {}, "incidents": {}, "alerts": {}}
        tot = sum(runs[s]["comparison"][d]["overall"]["total_events"] for s in HELDOUT_SEEDS)
        det = sum(runs[s]["comparison"][d]["overall"]["detected_events"] for s in HELDOUT_SEEDS)
        block["overall"] = {"total_events": tot, "detected_events": det, "detection_rate": round(det / tot, 4)}
        for sc in SCENARIOS:
            t = sum(runs[s]["comparison"][d]["scenarios"].get(sc, {}).get("total", 0) for s in HELDOUT_SEEDS)
            k = sum(runs[s]["comparison"][d]["scenarios"].get(sc, {}).get("detected", 0) for s in HELDOUT_SEEDS)
            entry = {"total": t, "detected": k, "detection_rate": round(k / t, 4) if t else None}
            for key in ("lead_time_median_min", "delay_median_sec"):
                vals = [runs[s]["comparison"][d]["scenarios"].get(sc, {}).get(key) for s in HELDOUT_SEEDS]
                a = agg(vals)
                if a:
                    entry[key + "_across_seeds"] = a
            if sc == "S8":
                for key in ("alerts_per_event", "incidents_per_event", "share_labelled_setpoint_chatter"):
                    entry[key] = agg([runs[s]["comparison"][d]["scenarios"][sc].get(key) for s in HELDOUT_SEEDS])
            block["scenarios"][sc] = entry
        fa = [runs[s]["comparison"][d]["false_alarms"] for s in HELDOUT_SEEDS]
        block["false_alarms"] = {"total_count": sum(x["count"] for x in fa),
                                 "per_100_channels_per_day": agg([x["per_100_channels_per_day"] for x in fa])}
        block["incidents"] = agg([runs[s]["comparison"][d]["incidents"] for s in HELDOUT_SEEDS])
        block["alerts"] = agg([runs[s]["comparison"][d]["alerts_total"] for s in HELDOUT_SEEDS])
        out["detectors"][d] = block
    out["ratios"] = {
        "naive_alerts_to_fast_incidents": agg([runs[s]["ratios"]["naive_alerts_to_fast_incidents"] for s in HELDOUT_SEEDS]),
        "static_dedup_incidents_to_fast_incidents": agg([runs[s]["ratios"]["static_dedup_incidents_to_fast_incidents"] for s in HELDOUT_SEEDS]),
    }
    for s in HELDOUT_SEEDS:
        c = runs[s]["comparison"]
        out["per_seed"][str(s)] = {
            "fast_detected": f'{c["fast"]["overall"]["detected_events"]}/{c["fast"]["overall"]["total_events"]}',
            "fast_false_alarms": c["fast"]["false_alarms"]["count"],
            "static_dedup_detected": f'{c["static_dedup"]["overall"]["detected_events"]}/{c["static_dedup"]["overall"]["total_events"]}',
            "static_dedup_false_alarms": c["static_dedup"]["false_alarms"]["count"],
            "naive_false_alarms": c["naive"]["false_alarms"]["count"],
            "fast_incidents": c["fast"]["incidents"],
        }
    for mode in ("day", "month"):
        r = se.run_scenario(mode, 42)
        c = r["comparison"]
        out["demo_seed_42"][mode] = {
            d: {"detected": f'{c[d]["overall"]["detected_events"]}/{c[d]["overall"]["total_events"]}',
                "false_alarms": c[d]["false_alarms"]["count"], "alerts": c[d]["alerts_total"], "incidents": c[d]["incidents"],
                "S1_lead_median_min": c[d]["scenarios"]["S1"].get("lead_time_median_min"),
                "S3_lead_median_min": c[d]["scenarios"]["S3"].get("lead_time_median_min"),
                "S8_incidents_per_event": c[d]["scenarios"]["S8"].get("incidents_per_event"),
                "S8_share_labelled_setpoint_chatter": c[d]["scenarios"]["S8"].get("share_labelled_setpoint_chatter")}
            for d in DETECTORS}
        out["demo_seed_42"][mode]["ratios"] = r["ratios"]
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "docs", "SCENARIOS_HELDOUT_RESULTS.json")
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
