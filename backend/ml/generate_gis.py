import json
import random

def build_collector_gis():
    with open('backend/data/objects_ref.json', 'r', encoding='utf-8') as f:
        objects = json.load(f)

    # Routes in Moscow
    routes = [
        {'name': 'Коллектор Садовое Кольцо (Север)', 'corridor': 'Садовое кольцо', 'start': (55.772, 37.595), 'end': (55.773, 37.655), 'picket_range': (0, 60)},
        {'name': 'Коллектор Садовое Кольцо (Юг)', 'corridor': 'Садовое кольцо', 'start': (55.731, 37.615), 'end': (55.735, 37.652), 'picket_range': (61, 120)},
        {'name': 'Магистральный коллектор Ленинский проспект', 'corridor': 'Юго-Запад', 'start': (55.728, 37.590), 'end': (55.695, 37.545), 'picket_range': (1, 85)},
        {'name': 'Кабельно-тепловой коллектор Новый Арбат — Сити', 'corridor': 'Запад', 'start': (55.753, 37.595), 'end': (55.748, 37.538), 'picket_range': (1, 45)},
        {'name': 'Коллектор Ленинградский проспект — Сокол', 'corridor': 'Север', 'start': (55.778, 37.580), 'end': (55.805, 37.515), 'picket_range': (1, 75)},
        {'name': 'Коллектор ТТК — Автозаводская ветвь', 'corridor': 'Юг', 'start': (55.708, 37.610), 'end': (55.705, 37.660), 'picket_range': (1, 65)},
        {'name': 'Коммуникационный коллектор Хамовники — Лужники', 'corridor': 'ЦАО-ЮЗ', 'start': (55.735, 37.575), 'end': (55.715, 37.555), 'picket_range': (1, 40)},
        {'name': 'Коллектор Шоссе Энтузиастов', 'corridor': 'Восток', 'start': (55.748, 37.685), 'end': (55.758, 37.755), 'picket_range': (1, 90)},
        {'name': 'Коллектор Проспект Мира — ВДНХ', 'corridor': 'СВАО', 'start': (55.779, 37.632), 'end': (55.825, 37.638), 'picket_range': (1, 70)},
        {'name': 'Коллектор Волгоградский — Текстильщики', 'corridor': 'ЮВАО', 'start': (55.730, 37.675), 'end': (55.705, 37.735), 'picket_range': (1, 80)},
    ]

    random.seed(42)
    geojson = {
        'type': 'FeatureCollection',
        'features': []
    }

    obj_coords = {}
    obj_list = list(objects.values())

    for idx, obj in enumerate(obj_list):
        r_idx = idx % len(routes)
        route = routes[r_idx]
        t = (idx // len(routes)) / max(1, (len(obj_list) // len(routes)))
        t = min(1.0, max(0.0, t))
        lat = route['start'][0] + (route['end'][0] - route['start'][0]) * t + (random.random() - 0.5) * 0.004
        lon = route['start'][1] + (route['end'][1] - route['start'][1]) * t + (random.random() - 0.5) * 0.004
        picket_num = int(route['picket_range'][0] + (route['picket_range'][1] - route['picket_range'][0]) * t)
        
        oid = obj['object_id']
        obj_coords[oid] = {
            'lat': round(lat, 6),
            'lon': round(lon, 6),
            'route_name': route['name'],
            'corridor': route['corridor'],
            'picket': f'ПК{picket_num}'
        }
        
        geojson['features'].append({
            'type': 'Feature',
            'id': f'obj_{oid}',
            'geometry': {
                'type': 'Point',
                'coordinates': [round(lon, 6), round(lat, 6)]
            },
            'properties': {
                'object_id': oid,
                'name': obj['name'],
                'object_type': obj['object_type'],
                'hierarchy_level': obj['hierarchy_level'],
                'route_name': route['name'],
                'corridor': route['corridor'],
                'picket': f'ПК{picket_num}',
                'status': 'normal'
            }
        })

    # Add LineString features for collector segments
    for r in routes:
        coords = []
        steps = 8
        for s in range(steps + 1):
            t = s / steps
            lt = r['start'][0] + (r['end'][0] - r['start'][0]) * t
            ln = r['start'][1] + (r['end'][1] - r['start'][1]) * t
            coords.append([round(ln, 6), round(lt, 6)])
        
        geojson['features'].append({
            'type': 'Feature',
            'geometry': {
                'type': 'LineString',
                'coordinates': coords
            },
            'properties': {
                'name': r['name'],
                'corridor': r['corridor'],
                'picket_start': f'ПК{r["picket_range"][0]}',
                'picket_end': f'ПК{r["picket_range"][1]}',
                'pipe_types': ['Силовые кабели', 'Связь', 'Теплотрасса'],
                'risk_level': 'normal'
            }
        })

    with open('backend/data/collector_graph.geojson', 'w', encoding='utf-8') as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)

    with open('backend/data/object_coordinates.json', 'w', encoding='utf-8') as f:
        json.dump(obj_coords, f, ensure_ascii=False, indent=2)

    print(f'Successfully created GeoJSON with {len(geojson["features"])} features!')

if __name__ == '__main__':
    build_collector_gis()
