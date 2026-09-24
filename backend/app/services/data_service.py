import os
import json
from typing import Dict, List, Optional, Any
from backend.app.core.config import settings

class DataService:
    def __init__(self):
        self.objects: Dict[str, Any] = {}
        self.sensors: Dict[str, Any] = {}
        self.object_coords: Dict[str, Any] = {}
        self.collector_geojson: Dict[str, Any] = {}
        self.predictions: List[Dict[str, Any]] = []
        self.predictions_by_channel: Dict[str, Dict[str, Any]] = {}
        self.predictions_by_object: Dict[str, List[Dict[str, Any]]] = {}
        self.sensors_by_object: Dict[str, List[Dict[str, Any]]] = {}
        self.metrics_report: Dict[str, Any] = {}
        self.load_data()

    def load_data(self):
        # 1. Objects
        obj_path = os.path.join(settings.DATA_DIR, "objects_ref.json")
        if os.path.exists(obj_path):
            with open(obj_path, "r", encoding="utf-8") as f:
                self.objects = json.load(f)

        # 2. Coordinates
        coords_path = os.path.join(settings.DATA_DIR, "object_coordinates.json")
        if os.path.exists(coords_path):
            with open(coords_path, "r", encoding="utf-8") as f:
                self.object_coords = json.load(f)

        # 3. Sensors
        sens_path = os.path.join(settings.DATA_DIR, "sensors_ref.json")
        if os.path.exists(sens_path):
            with open(sens_path, "r", encoding="utf-8") as f:
                self.sensors = json.load(f)
                for cid, s in self.sensors.items():
                    oid = s.get("object_id", "")
                    self.sensors_by_object.setdefault(oid, []).append(s)

        # 4. GeoJSON
        geo_path = os.path.join(settings.DATA_DIR, "collector_graph.geojson")
        if os.path.exists(geo_path):
            with open(geo_path, "r", encoding="utf-8") as f:
                self.collector_geojson = json.load(f)

        # 5. Predictions cache
        pred_path = os.path.join(settings.DATA_DIR, "predictions_cache.json")
        if os.path.exists(pred_path):
            with open(pred_path, "r", encoding="utf-8") as f:
                self.predictions = json.load(f)
                for p in self.predictions:
                    cid = p["channel_id"]
                    oid = p["object_id"]
                    self.predictions_by_channel[cid] = p
                    self.predictions_by_object.setdefault(oid, []).append(p)

        # 6. Metrics report
        met_path = os.path.join(settings.MODELS_DIR, "metrics_report.json")
        if os.path.exists(met_path):
            with open(met_path, "r", encoding="utf-8") as f:
                self.metrics_report = json.load(f)

    def get_object_risk_level(self, object_id: str) -> str:
        preds = self.predictions_by_object.get(object_id, [])
        if not preds:
            return "NORMAL"
        probs = [p["failure_probability"] for p in preds]
        max_p = max(probs)
        if max_p >= 0.70:
            return "CRITICAL"
        if max_p >= 0.45:
            return "WARNING"
        if max_p >= 0.30:
            return "ATTENTION"
        return "NORMAL"

data_service = DataService()
