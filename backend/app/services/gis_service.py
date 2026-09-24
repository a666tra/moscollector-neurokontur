import copy
from typing import Dict, Any
from backend.app.services.data_service import data_service

class GISService:
    def get_collector_geojson(self) -> Dict[str, Any]:
        base_geojson = copy.deepcopy(data_service.collector_geojson)
        if not base_geojson:
            return {"type": "FeatureCollection", "features": []}

        # Update point statuses based on current predictions
        for feature in base_geojson.get("features", []):
            f_type = feature.get("geometry", {}).get("type")
            props = feature.get("properties", {})
            
            if f_type == "Point":
                oid = props.get("object_id")
                risk = data_service.get_object_risk_level(oid)
                props["risk_level"] = risk
                preds = data_service.predictions_by_object.get(oid, [])
                props["critical_count"] = sum(1 for p in preds if p["risk_level"] == "CRITICAL")
                props["warning_count"] = sum(1 for p in preds if p["risk_level"] == "WARNING")
                props["sensors_total"] = len(data_service.sensors_by_object.get(oid, []))

        return base_geojson

gis_service = GISService()
