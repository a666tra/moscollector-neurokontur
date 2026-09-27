#!/usr/bin/env python3
"""Create or replace one local dispatcher credential without exposing its PIN in argv."""

import argparse
import getpass
import hashlib
import json
import os
import re
import secrets
import tempfile
from pathlib import Path


ITERATIONS = 600_000
SALT_BYTES = 16
PIN_PATTERN = re.compile(r"\d{6}")
BADGE_PATTERN = re.compile(r"(?:ДИСП-\d{4}|\d{4}-ОДС)")


def hash_pin(pin: str) -> str:
    salt = secrets.token_bytes(SALT_BYTES)
    digest = hashlib.pbkdf2_hmac("sha256", pin.encode("utf-8"), salt, ITERATIONS, dklen=32)
    return f"pbkdf2_sha256${ITERATIONS}${salt.hex()}${digest.hex()}"


def write_atomic(path: Path, records: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=path.parent, delete=False
        ) as stream:
            temp_path = Path(stream.name)
            json.dump(records, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp_path, path)
        try:
            os.chmod(path, 0o600)
        except OSError:
            # Windows permissions are governed by the containing directory ACL.
            pass
    except Exception:
        if temp_path is not None:
            try:
                temp_path.unlink(missing_ok=True)
            except OSError:
                pass
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--registry-path",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "backend" / "data" / "authorized_dispatchers.json",
        help="Local credential registry path (default: backend/data/authorized_dispatchers.json)",
    )
    parser.add_argument("--clearance-level", type=int, choices=(1, 2, 3), required=True)
    parser.add_argument("--can-confirm-false-alarm", action="store_true")
    parser.add_argument("--can-force-dispatch", action="store_true")
    parser.add_argument("--replace", action="store_true", help="Replace an existing badge record")
    args = parser.parse_args()

    badge = input("Badge (ДИСП-1234 or 1234-ОДС): ").strip()
    if not BADGE_PATTERN.fullmatch(badge):
        parser.error("badge must match ДИСП-1234 or 1234-ОДС")
    full_name = input("Full name: ").strip()
    role = input("Role (display only): ").strip()
    if not full_name or not role:
        parser.error("full name and role are required")

    pin = getpass.getpass("Six-digit PIN: ")
    pin_repeat = getpass.getpass("Repeat PIN: ")
    if not PIN_PATTERN.fullmatch(pin) or pin != pin_repeat:
        parser.error("PIN must be six digits and both entries must match")

    registry_path = args.registry_path.expanduser().resolve()
    records = {}
    if registry_path.exists():
        try:
            loaded = json.loads(registry_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            parser.error(f"existing registry cannot be read safely: {exc}")
        if not isinstance(loaded, dict):
            parser.error("existing registry must be a JSON object; refusing to replace it")
        # Refuse legacy, malformed, or unknown entries instead of silently migrating them.
        for existing_badge, record in loaded.items():
            encoded_hash = record.get("pin_hash") if isinstance(record, dict) else None
            parts = encoded_hash.split("$") if isinstance(encoded_hash, str) else []
            hash_valid = False
            if len(parts) == 4 and parts[0] == "pbkdf2_sha256":
                try:
                    iterations = int(parts[1])
                    hash_valid = (
                        str(iterations) == parts[1]
                        and 600_000 <= iterations <= 2_000_000
                        and re.fullmatch(r"[0-9a-f]{32}", parts[2]) is not None
                        and re.fullmatch(r"[0-9a-f]{64}", parts[3]) is not None
                    )
                except ValueError:
                    hash_valid = False
            if (
                not isinstance(existing_badge, str)
                or not BADGE_PATTERN.fullmatch(existing_badge)
                or not isinstance(record, dict)
                or record.get("badge") != existing_badge
                or not isinstance(record.get("full_name"), str)
                or not record["full_name"].strip()
                or not isinstance(record.get("role"), str)
                or not record["role"].strip()
                or type(record.get("clearance_level")) is not int
                or record.get("clearance_level") not in (1, 2, 3)
                or type(record.get("can_confirm_false_alarm")) is not bool
                or type(record.get("can_force_dispatch")) is not bool
                or not hash_valid
            ):
                parser.error("existing registry uses an unsupported or unsafe record format")
        records = loaded

    if badge in records and not args.replace:
        parser.error("badge already exists; pass --replace to rotate its credentials")
    records[badge] = {
        "badge": badge,
        "full_name": full_name,
        "role": role,
        "clearance_level": args.clearance_level,
        "pin_hash": hash_pin(pin),
        "can_confirm_false_alarm": args.can_confirm_false_alarm,
        "can_force_dispatch": args.can_force_dispatch,
    }
    write_atomic(registry_path, records)
    print(f"Dispatcher credential provisioned at {registry_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
