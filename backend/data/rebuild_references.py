import os
import csv
import json

def rebuild():
    # 1. Objects: "ид_объект","иерархия_уровень","родитель","вид_объекта","диспетчерское_название_объекта"
    objects = {}
    obj_path = 'dataset/dataset/справочник_объектов_диспетчер.csv'
    with open(obj_path, 'r', encoding='utf-8', errors='ignore') as f:
        reader = csv.reader(f)
        header = next(reader)
        for r in reader:
            if len(r) >= 5:
                oid = r[0].strip()
                objects[oid] = {
                    'object_id': oid,
                    'hierarchy_level': int(r[1].strip() or 3),
                    'parent_id': r[2].strip(),
                    'object_type': r[3].strip(),
                    'name': r[4].strip()
                }
    print(f"Parsed {len(objects)} objects in UTF-8")

    # 2. Sensors: "ид_канала_данных","тип_инж_системы","тип_датчика","тег_инженерной_системы","название_датчика","ид_объект"
    channels = {}
    sens_path = 'dataset/dataset/справочник_каналов_датчиков.csv'
    with open(sens_path, 'r', encoding='utf-8', errors='ignore') as f:
        reader = csv.reader(f)
        header = next(reader)
        for r in reader:
            if len(r) >= 6:
                cid = r[0].strip()
                channels[cid] = {
                    'channel_id': cid,
                    'system_type': r[1].strip(),
                    'sensor_type': r[2].strip(),
                    'tag': r[3].strip(),
                    'sensor_name': r[4].strip(),
                    'object_id': r[5].strip()
                }
    print(f"Parsed {len(channels)} channels in UTF-8")

    # 3. States: "тип_датчика","ид_набор_состояний","название_состояния","тревожное"
    states = []
    states_path = 'dataset/dataset/справочник_состояний.csv'
    with open(states_path, 'r', encoding='utf-8', errors='ignore') as f:
        reader = csv.reader(f)
        header = next(reader)
        for r in reader:
            if len(r) >= 4:
                states.append({
                    'sensor_type': r[0].strip(),
                    'state_set_id': r[1].strip(),
                    'state_name': r[2].strip(),
                    'is_alarm': r[3].strip().lower() in ('true', 't', '1')
                })
    print(f"Parsed {len(states)} states in UTF-8")

    # Save to UTF-8 JSON files
    with open('backend/data/objects_ref.json', 'w', encoding='utf-8') as f:
        json.dump(objects, f, ensure_ascii=False, indent=2)

    with open('backend/data/sensors_ref.json', 'w', encoding='utf-8') as f:
        json.dump(channels, f, ensure_ascii=False, indent=2)

    with open('backend/data/states_ref.json', 'w', encoding='utf-8') as f:
        json.dump(states, f, ensure_ascii=False, indent=2)

    print("Successfully exported JSON reference files in clean UTF-8!")

if __name__ == '__main__':
    rebuild()
