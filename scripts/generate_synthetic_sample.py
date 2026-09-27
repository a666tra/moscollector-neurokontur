import csv
import json
import random
from pathlib import Path
from datetime import datetime, timedelta

ROOT = Path(__file__).resolve().parent.parent
DATASET_DIR = ROOT / "dataset"
DATASET_DIR.mkdir(exist_ok=True)

# 1. Load sensor catalog to map channels to realistic physical systems
sensors_path = ROOT / "backend" / "data" / "sensors_ref.json"

ch4_channels = []
co_channels = []
water_channels = []
temp_channels = []
ops_channels = []

if sensors_path.exists():
    with open(sensors_path, "r", encoding="utf-8") as f:
        sensors_dict = json.load(f)
    for cid, s in sensors_dict.items():
        st = s.get("sensor_type", "").lower()
        sys_type = s.get("system_type", "").lower()
        tag = s.get("tag", "").lower()

        if "газ" in sys_type or "газ" in st or "метан" in st or "ch4" in tag or "co" in tag:
            if len(ch4_channels) <= len(co_channels):
                ch4_channels.append(cid)
            else:
                co_channels.append(cid)
        elif "затоплен" in st or "уровень" in st or "вода" in st or "насос" in st:
            water_channels.append(cid)
        elif "темп" in sys_type or "темп" in st or "тепловой" in st:
            temp_channels.append(cid)
        elif "охран" in sys_type or "люк" in st or "дверь" in st or "движен" in st or "кд" in st or "стекло" in st:
            ops_channels.append(cid)

# Fallbacks if reference is not found
if not ch4_channels:
    ch4_channels = [str(8800 + i) for i in range(20)]
if not co_channels:
    co_channels = [str(8900 + i) for i in range(20)]
if not water_channels:
    water_channels = [str(266700 + i) for i in range(20)]
if not temp_channels:
    temp_channels = [str(120200 + i) for i in range(20)]
if not ops_channels:
    ops_channels = [str(120500 + i) for i in range(20)]

out_csv = DATASET_DIR / "sample_synthetic_telemetry.csv"
readme_path = DATASET_DIR / "README.md"

# 2. Generator Configuration
RANDOM_SEED = 42
TOTAL_ROWS = 1000
random.seed(RANDOM_SEED)

ch4_pool = ch4_channels[:15]
co_pool = co_channels[:10]
water_pool = water_channels[:10]
temp_pool = temp_channels[:15]
ops_pool = ops_channels[:15]

# Proportions of channels:
# CH4: 250 rows, CO: 150 rows, Water: 150 rows, Cable Temp: 250 rows, OPS: 200 rows -> Sum = 1000
types_plan = (
    [("CH4", ch4_pool)] * 250 +
    [("CO", co_pool)] * 150 +
    [("WATER", water_pool)] * 150 +
    [("TEMP", temp_pool)] * 250 +
    [("OPS", ops_pool)] * 200
)
random.shuffle(types_plan)

start_time = datetime(2026, 1, 28, 8, 0, 0)
current_time = start_time
rows = []

for i in range(TOTAL_ROWS):
    sensor_cat, channel_pool = types_plan[i]
    event_id = 5000000000 + i
    current_time += timedelta(seconds=random.randint(5, 12))
    d_str = current_time.strftime("%Y-%m-%d")
    t_str = current_time.strftime("%H:%M:%S")

    ch_id = random.choice(channel_pool)
    roll = random.random()

    if sensor_cat == "CH4":
        # CH4 (метан): vol % [0.0 - 2.5%]
        # норма < 0.5% (88%), предупреждение 0.5 - 1.0% (8%), авария > 1.0% НКПР (4%)
        if roll < 0.88:
            val_num = random.uniform(0.01, 0.48)
            is_alarm = "f"
        elif roll < 0.96:
            val_num = random.uniform(0.50, 0.99)
            is_alarm = "t"
        else:
            val_num = random.uniform(1.01, 2.50)
            is_alarm = "t"
        val_str = f"{val_num:.2f}"

    elif sensor_cat == "CO":
        # CO (угарный газ): мг/м³ [0 - 150]
        # норма < 20 мг/м³ (88%), предупреждение 20 - 50 мг/м³ (8%), ПДК/тревога > 50-100 мг/м³ (4%)
        if roll < 0.88:
            val_num = random.uniform(0.5, 19.5)
            is_alarm = "f"
        elif roll < 0.96:
            val_num = random.uniform(20.0, 49.5)
            is_alarm = "t"
        else:
            val_num = random.uniform(50.0, 150.0)
            is_alarm = "t"
        val_str = f"{val_num:.1f}"

    elif sensor_cat == "WATER":
        # Уровень воды (затопление): см [0 - 120]
        # норма < 5 см (88%), предупреждение 10-30 см (8%), авария > 50 см (4%)
        if roll < 0.88:
            val_num = random.uniform(0.0, 4.9)
            is_alarm = "f"
        elif roll < 0.96:
            val_num = random.uniform(10.0, 30.0)
            is_alarm = "t"
        else:
            val_num = random.uniform(50.0, 120.0)
            is_alarm = "t"
        val_str = f"{val_num:.1f}"

    elif sensor_cat == "TEMP":
        # Температура кабелей: °C [15 - 90]
        # норма 20-55 °C (88%), предупреждение 60-70 °C (8%), авария > 80 °C (4%)
        if roll < 0.88:
            val_num = random.uniform(20.0, 55.0)
            is_alarm = "f"
        elif roll < 0.96:
            val_num = random.uniform(60.0, 70.0)
            is_alarm = "t"
        else:
            val_num = random.uniform(80.0, 90.0)
            is_alarm = "t"
        val_str = f"{val_num:.1f}"

    elif sensor_cat == "OPS":
        # Охранно-периметральная сигнализация: дискретные [0, 1]
        # 0 - норма/закрыто (94%), 1 - проникновение/вскрытие люка (6%)
        if roll < 0.94:
            val_str = "0"
            is_alarm = "f"
        else:
            val_str = "1"
            is_alarm = "t"

    rows.append([event_id, ch_id, d_str, t_str, is_alarm, val_str])

# Schedule realistic contact chatter bursts across specific channels
chatter_patterns = [
    # (channel, [delta_seconds relative to burst start], val_str)
    (ops_pool[0], [0, 12, 22, 28], "1"),          # 3 alarms with dt <= 30s
    (ops_pool[1], [0, 15, 25], "1"),              # 2 alarms with dt <= 30s
    (water_pool[0], [0, 40, 55], "65.0"),         # 2 alarms with dt in (30, 60]s
    (water_pool[1], [0, 45, 95], "72.0"),         # 1 with dt <= 60, 1 with dt in (60, 120]s
    (ch4_pool[0], [0, 120, 240], "1.85"),         # 2 alarms with dt in (60, 300]s
    (ch4_pool[1], [0, 180, 280], "1.60"),         # 2 alarms with dt in (60, 300]s
    (temp_pool[0], [0, 350, 550], "85.5"),        # 2 alarms with dt in (300, 600]s
    (temp_pool[1], [0, 420, 580], "88.0"),        # 2 alarms with dt in (300, 600]s
    (co_pool[0], [0, 20, 50, 180, 450], "80.0"),  # mixed deltas: 20s (<=30), 30s (<=60), 130s (<=300), 270s (<=300)
    (ops_pool[2], [0, 10, 20], "1"),              # 2 alarms with dt <= 30s
    (water_pool[2], [0, 35, 55], "58.0"),         # 2 alarms with dt in (30, 60]s
    (ch4_pool[2], [0, 150, 270], "1.45"),         # 2 alarms with dt in (60, 300]s
    (temp_pool[2], [0, 380, 560], "82.0")         # 2 alarms with dt in (300, 600]s
]

burst_insert_idx = 50
for ch_id, deltas, val_str in chatter_patterns:
    base_t = datetime.strptime(rows[burst_insert_idx][2] + " " + rows[burst_insert_idx][3], "%Y-%m-%d %H:%M:%S")
    for d in deltas:
        t_event = base_t + timedelta(seconds=d)
        rows[burst_insert_idx][1] = ch_id
        rows[burst_insert_idx][2] = t_event.strftime("%Y-%m-%d")
        rows[burst_insert_idx][3] = t_event.strftime("%H:%M:%S")
        rows[burst_insert_idx][4] = "t"
        rows[burst_insert_idx][5] = val_str
        burst_insert_idx += 4

# Chronological sorting to ensure monotonically advancing time
rows.sort(key=lambda r: r[2] + " " + r[3])
for i, r in enumerate(rows):
    r[0] = 5000000000 + i

with open(out_csv, "w", encoding="utf-8", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(["ид_события", "ид_канала_данных", "дата", "время", "тревожное", "значение_датчика"])
    writer.writerows(rows)

print(f"Generated {len(rows)} physical telemetry rows in {out_csv} ({out_csv.stat().st_size} bytes)")

readme_content = f"""# Датасеты проекта «Москоллектор.НейроКонтур»

## 1. Сырой исторический датасет (Исходные данные организаторов)
- **Файл:** `dataset/extracted/ext-journal-2026.csv`
- **Объём:** ~1.49 ГБ (~31 млн строк телеметрии за 2026 г.).
- **Статус в репозитории:** Исключён из состава Git-репозитория и релизного ZIP-архива в соответствии с регламентом ограничения размера дистрибутива.
- **Хэш SHA-256:** `4dbbb1068eacdfa896321c17fa0076fe26db8a26b2b73bc36691ec50ef2e09ff` (зафиксирован в `backend/data/reconciliation_ground_truth.json`).

## 2. Авторизованный физически калиброванный синтетический демо-датасет
- **Файл:** `dataset/sample_synthetic_telemetry.csv`
- **Объём:** {len(rows)} строк телеметрии (~{out_csv.stat().st_size // 1024} КБ).
- **Воспроизводимость:** `seed = {RANDOM_SEED}` (псевдослучайный генератор зафиксирован для 100% повторяемости).
- **Скрипт генерации:** `scripts/generate_synthetic_sample.py`.
- **Назначение:** Обеспечивает 100% автономную самодостаточность распакованного репозитория и релизного архива. Позволяет запускать локальные симуляции, интеграционные тесты (`tests/test_synthetic_pipeline.py`) и проверять сквозной контур инференса без необходимости скачивания 1.5 ГБ архива.
- **Структура колонок:**
  - `ид_события`: Уникальный целочисленный идентификатор записи телеметрии (`5000000000+`).
  - `ид_канала_данных`: Реальный идентификатор канала измерения датчика из паспорта СМВУ (`backend/data/sensors_ref.json`).
  - `дата`: Дата фиксации значения (`ГГГГ-ММ-ДД`, тестовое окно 2026-01-28).
  - `время`: Время фиксации значения (`ЧЧ:ММ:СС`, монотонный поток с шагом 5–15 сек).
  - `тревожное`: Флаг превышения порога СМВУ (`t` / `f`).
  - `значение_датчика`: Физическое показание в инженерных единицах измерения.

### Физические диапазоны и градации датчиков коллекторного хозяйства Москвы

| Тип датчика / Подсистема | Единица измерения | Физический диапазон | Норма (`тревожное=f`) | Предупреждение (`тревожное=t`) | Авария / ЧС (`тревожное=t`) | Доля строк |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **CH4 (Метан)** | vol % (об. %) | `[0.00 – 2.50]` | `< 0.50%` | `0.50 – 1.00%` | `> 1.00%` (порог НКПР) | 25% (250) |
| **CO (Угарный газ)** | мг/м³ | `[0.0 – 150.0]` | `< 20.0 мг/м³` | `20.0 – 50.0 мг/м³` | `> 50.0 мг/м³` (до 150 ПДК) | 15% (150) |
| **Уровень воды (Затопление)** | см | `[0.0 – 120.0]` | `< 5.0 см` | `10.0 – 30.0 см` | `> 50.0 см` (аварийное) | 15% (150) |
| **Температура кабелей** | °C | `[15.0 – 90.0]` | `20.0 – 55.0 °C` | `60.0 – 70.0 °C` | `> 80.0 °C` (кабели 10–220 кВ) | 25% (250) |
| **ОПС (Люки / Двери / Движение)** | дискретный | `{0, 1}` | `0` (закрыто / норма) | — | `1` (вскрытие люка / тревога) | 20% (200) |
"""

with open(readme_path, "w", encoding="utf-8") as f:
    f.write(readme_content)

print(f"Written {readme_path}")
