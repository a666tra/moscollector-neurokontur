import os
import csv
import time
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List, Optional
import numpy as np
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from backend.app.core.config import settings
from backend.app.services.ml_service import ml_service
from backend.app.services.data_service import data_service

router = APIRouter()

CSV_PATH = Path(settings.DATASET_DIR) / "sample_synthetic_telemetry.csv" if hasattr(settings, "DATASET_DIR") else Path(__file__).resolve().parent.parent.parent.parent / "dataset" / "sample_synthetic_telemetry.csv"


def parse_event_timestamp(date_str: str, time_str: str) -> float:
    """Парсинг даты и времени события телеметрии в POSIX-секунды."""
    dt_str = f"{date_str.strip()} {time_str.strip()}"
    try:
        return datetime.strptime(dt_str, "%Y-%m-%d %H:%M:%S").timestamp()
    except ValueError:
        try:
            return datetime.strptime(dt_str, "%Y-%m-%d %H:%M:%S.%f").timestamp()
        except ValueError:
            return 0.0


def filter_debounce_events(alarm_timestamps: List[float], debounce_window_sec: float) -> int:
    """
    Вычисляет количество подавленных дребезговых тревожных событий одного канала.
    Событие считается дребезгом (контактный флип), если интервал времени от
    непосредственно предшествующего тревожного события <= debounce_window_sec.
    """
    if not alarm_timestamps or len(alarm_timestamps) < 2:
        return 0

    sorted_ts = sorted(alarm_timestamps)
    suppressed = 0
    last_alarm_ts = None

    for ts in sorted_ts:
        if last_alarm_ts is not None and (ts - last_alarm_ts) <= debounce_window_sec:
            suppressed += 1
        last_alarm_ts = ts

    return suppressed


class SyntheticEvaluationRequest(BaseModel):
    threshold: float = Field(default=0.42, ge=0.0, le=1.0, description="Порог классификации риска")
    debounce_window_sec: int = Field(default=300, ge=30, le=3600, description="Окно фильтра дребезга в секундах")
    model_name: Optional[str] = Field(
        default="champion_lightgbm",
        description="ML-модель для инференса ('champion_lightgbm', 'logistic_regression', 'random_forest')"
    )


class SyntheticSampleResponse(BaseModel):
    is_synthetic: bool = True
    dataset_name: str = "sample_synthetic_telemetry.csv"
    total_rows: int
    preview_limit: int
    rows: List[Dict[str, Any]]
    disclaimer: str


class SyntheticEvaluationResponse(BaseModel):
    is_synthetic: bool = True
    dataset_name: str = "sample_synthetic_telemetry.csv"
    total_telemetry_rows: int
    unique_channels_evaluated: int
    processing_latency_ms: float
    risk_distribution: Dict[str, int]
    alarms_by_subsystem: Dict[str, int]
    high_risk_candidates: List[Dict[str, Any]]
    debounced_alarms_count: int
    model_used: str = "champion_lightgbm"
    debounce_window_sec: int = 300
    disclaimer: str = "Синтетический демонстрационный датасет для тестирования контура инференса и фильтрации дребезга"
    simulated_features_note: str = "7-дневные признаки (cnt_7d, alarms_7d, silence_hours) в демо-режиме экстраполированы из суточного среза; в боевой СМВУ рассчитываются по полной БД телеметрии"


@router.get("/sample", response_model=SyntheticSampleResponse, summary="Предпросмотр строк синтетического датасета")
def get_synthetic_sample(limit: int = Query(default=20, ge=1, le=200)):
    if not CSV_PATH.exists():
        raise HTTPException(status_code=404, detail="Синтетический датасет не найден по пути " + str(CSV_PATH))

    rows = []
    with open(CSV_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            if i >= limit:
                break
            rows.append({
                "event_id": int(row.get("ид_события", 0)),
                "channel_id": str(row.get("ид_канала_данных", "")),
                "date": row.get("дата", ""),
                "time": row.get("время", ""),
                "is_alarm": row.get("тревожное", "") == "t",
                "value": float(row.get("значение_датчика", 0.0))
            })

    total = sum(1 for _ in open(CSV_PATH, "r", encoding="utf-8")) - 1

    return SyntheticSampleResponse(
        is_synthetic=True,
        dataset_name=CSV_PATH.name,
        total_rows=total,
        preview_limit=limit,
        rows=rows,
        disclaimer="Демонстрационный физически калиброванный синтетический датасет телеметрии коллекторного хозяйства Москвы (seed=42)"
    )


@router.post("/evaluate", response_model=SyntheticEvaluationResponse, summary="Сквозная обработка и скоринг синтетического датасета")
def evaluate_synthetic_dataset(req: SyntheticEvaluationRequest):
    if not CSV_PATH.exists():
        raise HTTPException(status_code=404, detail="Синтетический датасет не найден")

    # Валидация запрошенной ML-модели
    valid_models = {"champion_lightgbm", "logistic_regression", "random_forest"}
    selected_model = req.model_name or "champion_lightgbm"
    if selected_model not in valid_models:
        raise HTTPException(
            status_code=400,
            detail=f"Недопустимая ML-модель: '{selected_model}'. Допустимые: {sorted(list(valid_models))}"
        )

    t_start = time.perf_counter()

    # Считывание и группировка телеметрии по каналам
    channel_telemetry: Dict[str, List[Dict[str, Any]]] = {}
    alarms_count = {
        "Метан (CH4)": 0,
        "Угарный газ (CO)": 0,
        "Затопление": 0,
        "Температура кабелей": 0,
        "Охранный периметр": 0
    }
    total_rows = 0

    with open(CSV_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            total_rows += 1
            cid = str(row.get("ид_канала_данных", ""))
            is_al = row.get("тревожное", "") == "t"
            val = float(row.get("значение_датчика", 0.0))
            ts = parse_event_timestamp(row.get("дата", ""), row.get("время", ""))

            # Определение метаданных датчика для классификации тревоги
            s_meta = data_service.sensors.get(cid, {})
            stype = s_meta.get("sensor_type", "").lower()
            systype = s_meta.get("system_type", "").lower()

            if is_al:
                if ("газ" in systype or "газ" in stype) and val > 2.5:
                    alarms_count["Угарный газ (CO)"] += 1
                elif "газ" in systype or "газ" in stype:
                    alarms_count["Метан (CH4)"] += 1
                elif "затоп" in stype or "вод" in stype or "насос" in stype:
                    alarms_count["Затопление"] += 1
                elif "темп" in systype or "темп" in stype:
                    alarms_count["Температура кабелей"] += 1
                else:
                    alarms_count["Охранный периметр"] += 1

            if cid not in channel_telemetry:
                channel_telemetry[cid] = []
            channel_telemetry[cid].append({
                "value": val,
                "is_alarm": is_al,
                "timestamp": ts,
                "date": row.get("дата", ""),
                "time": row.get("время", "")
            })

    # Фильтрация дребезга и реальный ML-инференс
    risk_dist = {"high": 0, "medium": 0, "low": 0}
    high_risk_candidates = []
    total_debounced_count = 0
    model_name_used = selected_model

    for cid, events in channel_telemetry.items():
        # Сортировка событий по времени
        events.sort(key=lambda e: e["timestamp"])
        values = [e["value"] for e in events]
        alarm_events = [e for e in events if e["is_alarm"]]
        alarm_timestamps = [e["timestamp"] for e in alarm_events]

        # Реальный фильтр дребезга по временным меткам
        suppressed_channel = filter_debounce_events(alarm_timestamps, req.debounce_window_sec)
        total_debounced_count += suppressed_channel

        # Извлечение реальных признаков с учётом отфильтрованного дребезга
        cnt_24h = len(events)
        raw_alarms_24h = len(alarm_events)
        effective_alarms_24h = max(0, raw_alarms_24h - suppressed_channel)
        mean_val = float(np.mean(values)) if values else 0.0
        std_val = float(np.std(values)) if values else 0.0
        num_max = float(np.max(values)) if values else 0.0

        # Вызов реального инференса через ml_service
        score_res = ml_service.score_realtime(
            channel_id=cid,
            cnt_24h=cnt_24h,
            alarms_24h=effective_alarms_24h,
            mean_val=mean_val,
            std_val=std_val,
            num_max=num_max,
            chatter_cnt=suppressed_channel,
            cnt_7d=max(cnt_24h * 5, 20),
            alarms_7d=effective_alarms_24h * 3,
            silence_hours=4.0 if effective_alarms_24h > 0 else 1.0,
            model_name=selected_model
        )

        prob = score_res["failure_probability"]
        model_name_used = score_res.get("model_used", model_name_used)

        # Распределение риска и кандидаты
        if prob >= req.threshold:
            risk_dist["high"] += 1
            rec_action = score_res.get("recommended_action", "Плановый осмотр")
            if suppressed_channel > 0:
                rec_action = f"{rec_action} (Подавлен дребезг: {suppressed_channel} событий)"
                candidate_status = "REQUIRES_DISPATCH_DEBOUNCED"
            else:
                candidate_status = "REQUIRES_DISPATCH"

            high_risk_candidates.append({
                "channel_id": cid,
                "sensor_name": score_res.get("sensor_name", f"Датчик {cid}"),
                "object_name": score_res.get("object_name", "Коллекторный узел"),
                "risk_score": round(prob, 4),
                "calibrated_probability": score_res.get("calibrated_probability", round(prob, 4)),
                "total_events": cnt_24h,
                "alarm_events_count": raw_alarms_24h,
                "effective_alarms_count": effective_alarms_24h,
                "debounced_chatter_count": suppressed_channel,
                "recommended_action": rec_action,
                "status": candidate_status
            })
        elif prob >= 0.20:
            risk_dist["medium"] += 1
        else:
            risk_dist["low"] += 1

    t_elapsed_ms = (time.perf_counter() - t_start) * 1000.0

    return SyntheticEvaluationResponse(
        is_synthetic=True,
        dataset_name=CSV_PATH.name,
        total_telemetry_rows=total_rows,
        unique_channels_evaluated=len(channel_telemetry),
        processing_latency_ms=round(t_elapsed_ms, 2),
        risk_distribution=risk_dist,
        alarms_by_subsystem=alarms_count,
        high_risk_candidates=sorted(high_risk_candidates, key=lambda x: x["risk_score"], reverse=True)[:10],
        debounced_alarms_count=total_debounced_count,
        model_used=model_name_used,
        debounce_window_sec=req.debounce_window_sec,
        disclaimer="Синтетический демонстрационный датасет для тестирования контура инференса и фильтрации дребезга"
    )
