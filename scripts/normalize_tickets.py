#!/usr/bin/env python3
"""Normalize seeded tickets in backend/data/tickets_db.json.

Removes legacy saved_opex_rub key, sets failure_risk_percent to the calibrated
proxy probability percentage of each ticket's channel, and cleans test/duplicate
demo tickets per specification:
  (a) delete tickets whose work_description starts with «Тестовая превентивная заявка»;
  (b) delete З-ТО-202609-1013;
  (c) for each channel_id keep only ONE ticket: the one with the most advanced status
      (ВЫПОЛНЕН > В_РАБОТЕ > НАЗНАЧЕН > ЧЕРНОВИК), ties -> the oldest ticket_id.
      Keep at least one ВЫПОЛНЕН ticket in the file if any non-test one exists;
      if none remains, keep nothing and report.
"""

import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from backend.app.services.data_service import data_service

STATUS_RANK = {
    "ВЫПОЛНЕН": 4,
    "В_РАБОТЕ": 3,
    "НАЗНАЧЕН": 2,
    "ЧЕРНОВИК": 1,
}


def _ticket_suffix(tid: str) -> int:
    m = re.search(r"-(\d+)$", str(tid))
    return int(m.group(1)) if m else float("inf")


def clean_tickets(tickets: list) -> tuple[list, list[str]]:
    """Clean test tickets and duplicate channel tickets idempotently.

    Returns (cleaned_tickets, deleted_ticket_ids).
    """
    deleted_ids: list[str] = []

    # (a) delete tickets whose work_description starts with «Тестовая превентивная заявка»
    after_a = []
    for t in tickets:
        desc = t.get("work_description") or ""
        if desc.startswith("Тестовая превентивная заявка"):
            deleted_ids.append(t.get("ticket_id"))
        else:
            after_a.append(t)

    # (b) delete З-ТО-202609-1013
    after_b = []
    for t in after_a:
        if t.get("ticket_id") == "З-ТО-202609-1013":
            deleted_ids.append(t.get("ticket_id"))
        else:
            after_b.append(t)

    # (c) for each channel_id keep only ONE ticket:
    # most advanced status (ВЫПОЛНЕН > В_РАБОТЕ > НАЗНАЧЕН > ЧЕРНОВИК), ties -> oldest ticket_id
    by_channel = defaultdict(list)
    for t in after_b:
        cid = str(t.get("channel_id"))
        by_channel[cid].append(t)

    kept_ticket_ids = set()
    for cid, ch_tickets in by_channel.items():
        if len(ch_tickets) == 1:
            kept_ticket_ids.add(ch_tickets[0].get("ticket_id"))
        else:
            best_ticket = max(
                ch_tickets,
                key=lambda t: (
                    STATUS_RANK.get(t.get("status"), 0),
                    -_ticket_suffix(t.get("ticket_id", "")),
                ),
            )
            kept_ticket_ids.add(best_ticket.get("ticket_id"))
            for t in ch_tickets:
                tid = t.get("ticket_id")
                if tid != best_ticket.get("ticket_id"):
                    deleted_ids.append(tid)

    # Preserve original file order for kept tickets
    cleaned_tickets = [t for t in after_b if t.get("ticket_id") in kept_ticket_ids]

    # Rule: Keep at least one ВЫПОЛНЕН ticket in the file if any non-test one exists;
    # if none remains, keep nothing and report.
    non_test_completed_exist = any(t.get("status") == "ВЫПОЛНЕН" for t in after_b)
    final_completed_count = sum(1 for t in cleaned_tickets if t.get("status") == "ВЫПОЛНЕН")
    if not non_test_completed_exist:
        print("ВЫПОЛНЕН status check: non-test ВЫПОЛНЕН tickets not found in dataset; keeping nothing as specified.")
    elif final_completed_count == 0:
        resurrect_candidates = [t for t in after_b if t.get("status") == "ВЫПОЛНЕН"]
        best_completed = min(resurrect_candidates, key=lambda t: _ticket_suffix(t.get("ticket_id", "")))
        cleaned_tickets.append(best_completed)
        if best_completed.get("ticket_id") in deleted_ids:
            deleted_ids.remove(best_completed.get("ticket_id"))
        print(f"ВЫПОЛНЕН status check: preserved {best_completed.get('ticket_id')} to keep at least one completed ticket.")
    else:
        print(f"ВЫПОЛНЕН status check: kept {final_completed_count} completed ticket(s).")

    return cleaned_tickets, deleted_ids


def main() -> None:
    db_path = ROOT / "backend" / "data" / "tickets_db.json"
    raw_bytes = db_path.read_bytes()
    newline = "\r\n" if b"\r\n" in raw_bytes else "\n"
    has_trailing_newline = raw_bytes.endswith(b"\n")
    tickets = json.loads(raw_bytes.decode("utf-8"))

    print(f"Initial ticket count: {len(tickets)}")
    before_statuses = dict(Counter(t.get("status") for t in tickets))
    print(f"Initial status counts: {before_statuses}")

    # Cleaning step
    tickets, deleted_ids = clean_tickets(tickets)
    print(f"Deleted ticket IDs ({len(deleted_ids)}): {deleted_ids}")

    # Normalization step
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

    final_statuses = dict(Counter(t.get("status") for t in tickets))
    print(f"Final ticket count: {len(tickets)}")
    print(f"Final status counts: {final_statuses}")
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
    print(f"Wrote {len(tickets)} normalized and cleaned tickets to {db_path}")


if __name__ == "__main__":
    main()
