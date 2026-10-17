#!/usr/bin/env python3
"""Normalize seeded tickets in backend/data/tickets_db.json.

Removes legacy saved_opex_rub key and sets failure_risk_percent to the calibrated
proxy probability percentage of each ticket's channel:
  failure_risk_percent = round(100 * calibrated_proxy_probability, 1)
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from backend.app.services.data_service import data_service


def main() -> None:
    db_path = ROOT / "backend" / "data" / "tickets_db.json"
    raw_bytes = db_path.read_bytes()
    newline = "\r\n" if b"\r\n" in raw_bytes else "\n"
    has_trailing_newline = raw_bytes.endswith(b"\n")
    tickets = json.loads(raw_bytes.decode("utf-8"))

    before_vals = [t.get("failure_risk_percent") for t in tickets]
    print(f"Before distinct failure_risk_percent count: {len(set(before_vals))} {sorted(set(before_vals))}")

    missing_channels = []
    removed_saved_opex_count = 0

    for t in tickets:
        if "saved_opex_rub" in t:
            del t["saved_opex_rub"]
            removed_saved_opex_count += 1

        cid = str(t.get("channel_id"))
        pred = data_service.predictions_by_channel.get(cid)
        if pred and "calibrated_proxy_probability" in pred:
            t["failure_risk_percent"] = round(100 * float(pred["calibrated_proxy_probability"]), 1)
        else:
            missing_channels.append(t.get("ticket_id"))

    after_vals = [t.get("failure_risk_percent") for t in tickets]
    print(f"After distinct failure_risk_percent count: {len(set(after_vals))} {sorted(set(after_vals))}")
    print(f"Removed saved_opex_rub from {removed_saved_opex_count} tickets.")

    if missing_channels:
        print(f"Tickets with channel not found in predictions: {missing_channels}")
    else:
        print("All ticket channels found in predictions (missing: 0).")

    json_str = json.dumps(tickets, ensure_ascii=False, indent=2)
    json_str = json_str.replace("\r\n", "\n").replace("\n", newline)
    if has_trailing_newline:
        json_str += newline
    db_path.write_bytes(json_str.encode("utf-8"))
    print(f"Wrote {len(tickets)} normalized tickets to {db_path}")


if __name__ == "__main__":
    main()
