from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from backend.app.models.schemas import ObjectSummary, ObjectDetail, SensorChannel
from backend.app.services.data_service import data_service
from backend.app.services.gis_service import gis_service

router = APIRouter()

@router.get("", response_model=List[ObjectSummary])
def get_objects():
    res = []
    for oid, obj in data_service.objects.items():
        coords = data_service.object_coords.get(oid, {})
        preds = data_service.predictions_by_object.get(oid, [])
        sensors = data_service.sensors_by_object.get(oid, [])
        risk = data_service.get_object_risk_level(oid)
        fail_cnt = sum(1 for p in preds if p["is_predicted_failure_24h"])

        res.append(ObjectSummary(
            object_id=oid,
            name=obj.get("name", f"Объект {oid}"),
            object_type=obj.get("object_type", ""),
            hierarchy_level=int(obj.get("hierarchy_level", 3)),
            parent_id=obj.get("parent_id"),
            lat=coords.get("lat", 55.751),
            lon=coords.get("lon", 37.618),
            route_name=coords.get("route_name", "Магистральный сектор"),
            corridor=coords.get("corridor", "ЦАО"),
            picket=coords.get("picket", "ПК0"),
            risk_level=risk,
            sensor_count=len(sensors),
            predicted_failures_count=fail_cnt
        ))
    return res

@router.get("/{object_id}", response_model=ObjectDetail)
def get_object_detail(object_id: str):
    obj = data_service.objects.get(object_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Объект не найден")

    coords = data_service.object_coords.get(object_id, {})
    preds = data_service.predictions_by_object.get(object_id, [])
    sensors_raw = data_service.sensors_by_object.get(object_id, [])
    risk = data_service.get_object_risk_level(object_id)
    fail_cnt = sum(1 for p in preds if p["is_predicted_failure_24h"])

    sensors = [
        SensorChannel(
            channel_id=s["channel_id"],
            system_type=s["system_type"],
            sensor_type=s["sensor_type"],
            tag=s["tag"],
            sensor_name=s["sensor_name"],
            object_id=object_id
        )
        for s in sensors_raw
    ]

    return ObjectDetail(
        object_id=object_id,
        name=obj.get("name", f"Объект {object_id}"),
        object_type=obj.get("object_type", ""),
        hierarchy_level=int(obj.get("hierarchy_level", 3)),
        parent_id=obj.get("parent_id"),
        lat=coords.get("lat", 55.751),
        lon=coords.get("lon", 37.618),
        route_name=coords.get("route_name", "Магистральный сектор"),
        corridor=coords.get("corridor", "ЦАО"),
        picket=coords.get("picket", "ПК0"),
        risk_level=risk,
        sensor_count=len(sensors),
        predicted_failures_count=fail_cnt,
        sensors=sensors
    )

@router.get("/geojson/network")
def get_network_geojson() -> Dict[str, Any]:
    return gis_service.get_collector_geojson()
