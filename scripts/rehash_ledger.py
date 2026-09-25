import json
import hashlib

path = 'backend/data/confirmed_alarms.json'
with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)

# Chronological order is reversed
chronological = list(reversed(data))
expected_prev = '0' * 64

for rec in chronological:
    rec['prev_hash'] = expected_prev
    avoided = float(rec.get('avoided_cost_rub', 0.0))
    badge = rec['dispatcher_badge']
    cid = rec['channel_id']
    dec = rec['decision']
    ts = rec['timestamp']
    notes = rec['notes']
    payload = f"{expected_prev}|{cid}|{dec}|{badge}|{ts}|{avoided:.2f}|{notes}".encode('utf-8')
    rec_hash = hashlib.sha256(payload).hexdigest()
    rec['record_hash'] = rec_hash
    expected_prev = rec_hash

new_data = list(reversed(chronological))
with open(path, 'w', encoding='utf-8') as f:
    json.dump(new_data, f, ensure_ascii=False, indent=2)

print('Successfully re-hashed confirmed_alarms.json. Head hash:', new_data[0]['record_hash'])
