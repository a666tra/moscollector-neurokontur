import os
import json
import time
import joblib
import numpy as np
from datetime import datetime
from typing import Dict, Any, Optional, List
from backend.app.core.config import settings
from backend.app.services.data_service import data_service
from backend.app.api.settings import current_system_settings

CONFIRMED_ALARMS_PATH = os.path.join(settings.DATA_DIR, "confirmed_alarms.json")

class MLService:
    def __init__(self):
        self.model = None
        self.confirmed_alarms: List[Dict[str, Any]] = []
        self.load_model()
        self.load_confirmed_alarms()

    def load_model(self):
        model_path = os.path.join(settings.MODELS_DIR, "champion_lgbm.joblib")
        if os.path.exists(model_path):
            try:
                self.model = joblib.load(model_path)
            except Exception as e:
                print(f"Error loading model: {e}")

    def load_confirmed_alarms(self):
        if os.path.exists(CONFIRMED_ALARMS_PATH):
            try:
                with open(CONFIRMED_ALARMS_PATH, 'r', encoding='utf-8') as f:
                    self.confirmed_alarms = json.load(f)
            except Exception:
                self.confirmed_alarms = []

    def save_confirmed_alarms(self):
        try:
            os.makedirs(os.path.dirname(CONFIRMED_ALARMS_PATH), exist_ok=True)
            with open(CONFIRMED_ALARMS_PATH, 'w', encoding='utf-8') as f:
                json.dump(self.confirmed_alarms, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"Error saving confirmed alarms: {e}")

    def get_confirmed_saved_opex(self) -> float:
        return sum(a.get("avoided_cost_rub", 0.0) for a in self.confirmed_alarms if a.get("decision") == "CONFIRM_FALSE_ALARM")

    def score_realtime(
        self,
        channel_id: str,
        cnt_24h: int = 10,
        cnt_7d: int = 70,
        alarms_24h: int = 0,
        alarms_7d: int = 1,
        chatter_cnt: int = 0,
        silence_hours: float = 1.0,
        battery_glitches: int = 0,
        date_corruptions: int = 0,
        gas_spikes: int = 0,
        last_value: str = "Норма"
    ) -> Dict[str, Any]:
        """Real-time dynamic inference using LightGBM champion model with exact latency measurement."""
        t_start = time.perf_counter()
        
        s_info = data_service.sensors.get(channel_id, {})
        oid = s_info.get("object_id", "")
        obj = data_service.objects.get(oid, {})
        coords = data_service.object_coords.get(oid, {})
        
        picket = coords.get("picket", "ПК28")
        obj_name = obj.get("name", "Коллекторный узел")
        s_name = s_info.get("sensor_name", f"Датчик {channel_id}")

        alarm_ratio = alarms_7d / max(1, cnt_7d)
        acc_events = cnt_24h / (cnt_7d / 7.0 + 0.1)
        acc_alarms = alarms_24h / (alarms_7d / 7.0 + 0.1)
        chatter_ratio = chatter_cnt / max(1, cnt_7d)
        
        stype = s_info.get("sensor_type", "").lower()
        stype_code = 1 if "газ" in stype else (2 if "кд" in stype or "ав" in stype else 0)
        sys_code = 1 if "опс" in s_info.get("system_type", "").lower() else 0

        # 21-dim feature vector matching training schema
        feature_vec = np.array([[
            cnt_24h,
            cnt_7d,
            alarms_24h,
            alarms_7d,
            alarm_ratio,
            acc_events,
            acc_alarms,
            chatter_cnt,
            chatter_ratio,
            battery_glitches,
            date_corruptions,
            max(2, chatter_cnt + 1), # unique_states
            silence_hours,
            0.0, # num_mean
            0.0, # num_std
            0.0, # num_max
            stype_code,
            sys_code,
            gas_spikes,
            0, # temp_spikes
            int(obj.get("hierarchy_level", 3))
        ]], dtype=np.float32)

        prob = 0.05
        if self.model is not None:
            try:
                probs = self.model.predict_proba(feature_vec)
                prob = float(probs[0][1])
            except Exception as e:
                print(f"Inference error: {e}")
        
        latency_ms = (time.perf_counter() - t_start) * 1000

        # Evaluate against active threshold
        threshold = current_system_settings.decision_threshold
        is_degradation = prob >= threshold

        if prob >= 0.70:
            risk = "CRITICAL"
            action = "Срочный наряд-заказ ТО на пикет. Превентивная замена сенсорного элемента."
        elif prob >= threshold:
            risk = "WARNING"
            action = "Плановый осмотр в графике ППР текущей недели."
        elif prob >= 0.25:
            risk = "ATTENTION"
            action = "Повышенный контроль диспетчером ОДС. Мониторинг параметров питания."
        else:
            risk = "NORMAL"
            action = "Параметры в норме. Штатный мониторинг СМВУ."

        factors = []
        if silence_hours > 24:
            factors.append(f"Длительное молчание ({silence_hours:.1f} ч)")
        if chatter_cnt > 3:
            factors.append(f"Дребезг контактов ({chatter_cnt} переключений)")
        if battery_glitches > 0:
            factors.append("Просадка вторичного питания")
        if date_corruptions > 0:
            factors.append("Сброс часов контроллера (1970г)")
        if gas_spikes > 0:
            factors.append(f"Всплески концентрации метана ({gas_spikes} раз)")
        if not factors:
            factors = ["Штатные технологические колебания"]

        return {
            "channel_id": channel_id,
            "sensor_name": s_name,
            "object_name": obj_name,
            "picket": picket,
            "failure_probability": round(prob, 4),
            "risk_level": risk,
            "threshold_used": round(threshold, 4),
            "is_degradation_detected": is_degradation,
            "top_factors": factors,
            "recommended_action": action,
            "inference_latency_ms": round(latency_ms, 3)
        }

    def classify_alarm(
        self,
        channel_id: str,
        current_value: str,
        recent_events_count_1h: int = 1,
        recent_flips_count_1h: int = 0,
        duration_minutes: float = 2.0
    ) -> Dict[str, Any]:
        """Classify incoming alarm with Human-in-the-Loop safety confirmation."""
        s_info = data_service.sensors.get(channel_id, {})
        stype = s_info.get("sensor_type", "").lower()
        pred = data_service.predictions_by_channel.get(channel_id, {})
        base_fail_prob = pred.get("failure_probability", 0.05)

        # 1. Fire / Gas Risk check (Hazardous)
        try:
            val_num = float(current_value)
            if "газ" in stype:
                if val_num >= 5.0:
                    return {
                        "channel_id": channel_id,
                        "verdict": "REAL_RISK",
                        "is_false_alarm": False,
                        "confidence": 0.99,
                        "diagnosis": f"Взрывоопасная концентрация метана ({val_num}% об.)! Превышение аварийного предела 5.0%.",
                        "recommended_action": "НЕМЕДЛЕННАЯ ЭВАКУАЦИЯ И ВЫЕЗД АВАРИЙНОЙ ГАЗОВОЙ СЛУЖБЫ ОДС",
                        "avoided_callout_cost_rub": 0.0
                    }
                elif val_num >= current_system_settings.gas_warning_threshold_vol_pct:
                    return {
                        "channel_id": channel_id,
                        "verdict": "REAL_RISK",
                        "is_false_alarm": False,
                        "confidence": 0.92,
                        "diagnosis": f"Предупредительный порог загазованности ({val_num}% об. метана).",
                        "recommended_action": "Запуск принудительной вентиляции шахты, экстренный наряд ТО/ППР на пикет.",
                        "avoided_callout_cost_rub": 0.0
                    }
            if "темп" in stype and val_num >= 40.0:
                return {
                    "channel_id": channel_id,
                    "verdict": "REAL_RISK",
                    "is_false_alarm": False,
                    "confidence": 0.94,
                    "diagnosis": f"Критический перегрев в коллекторе ({val_num}°C). Возможен прорыв теплотрассы или возгорание.",
                    "recommended_action": "Направление оперативно-выездной бригады РТС / Москоллектор",
                    "avoided_callout_cost_rub": 0.0
                }
        except ValueError:
            pass

        # 2. Contact Chatter / False Alarm Check
        chatter_threshold = current_system_settings.chatter_min_flips
        if recent_flips_count_1h >= chatter_threshold or (duration_minutes <= 2.5 and recent_events_count_1h >= 3):
            confidence = 0.85 + min(0.12, recent_flips_count_1h * 0.02)
            return {
                "channel_id": channel_id,
                "verdict": "FALSE_ALARM",
                "is_false_alarm": True,
                "confidence": round(confidence, 3),
                "diagnosis": (
                    f"Характерный спектр механического дребезга геркона/люка СМВУ "
                    f"({recent_flips_count_1h} микропереключений за {duration_minutes} мин). Вибрационный шум."
                ),
                "recommended_action": (
                    "Рекомендация ИИ: Подавление ложной тревоги. ТРЕБУЕТСЯ ПОДТВЕРЖДЕНИЕ ДИСПЕТЧЕРА ОДС "
                    "в соответствии с регламентом безопасности перед отменой выезда бригады."
                ),
                "avoided_callout_cost_rub": current_system_settings.callout_cost_rub
            }

        # 3. Sensor Degradation vs Real Failure
        if base_fail_prob >= current_system_settings.decision_threshold or "неисправ" in current_value.lower() or "отключ" in current_value.lower():
            return {
                "channel_id": channel_id,
                "verdict": "SENSOR_DEGRADATION",
                "is_false_alarm": False,
                "confidence": round(max(0.75, base_fail_prob), 3),
                "diagnosis": f"Аппаратный сбой канала: деградация сенсорного узла ({current_value}). Вероятность отказа: {int(base_fail_prob*100)}%.",
                "recommended_action": "Автоматическое создание наряд-заказа на превентивную замену датчика (ППР) до аварии.",
                "avoided_callout_cost_rub": current_system_settings.callout_cost_rub - current_system_settings.preventive_cost_rub
            }

        # 4. Normal / Transient Event
        return {
            "channel_id": channel_id,
            "verdict": "NORMAL",
            "is_false_alarm": False,
            "confidence": 0.95,
            "diagnosis": "Штатное технологическое событие в пределах нормы.",
            "recommended_action": "Штатное протоколирование в журнале ОДС без вызова бригады.",
            "avoided_callout_cost_rub": 0.0
        }

    def confirm_alarm(
        self,
        channel_id: str,
        decision: str,
        dispatcher_badge: str = "7041-ОДС",
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """Human-in-the-loop decision confirmation by ODS dispatcher."""
        now = datetime.now()
        is_suppress = decision == "CONFIRM_FALSE_ALARM"
        avoided = current_system_settings.callout_cost_rub if is_suppress else 0.0
        
        record = {
            "channel_id": channel_id,
            "decision": decision,
            "status": "SUPPRESSED_CONFIRMED" if is_suppress else "DISPATCH_CONFIRMED",
            "avoided_cost_rub": avoided,
            "dispatcher_badge": dispatcher_badge,
            "timestamp": now.strftime("%Y-%m-%d %H:%M:%S"),
            "notes": notes or ("Подтверждена ложная тревога диспетчером" if is_suppress else "Принудительный выезд бригады")
        }
        self.confirmed_alarms.insert(0, record)
        self.save_confirmed_alarms()

        msg = (
            f"Решение диспетчера [{dispatcher_badge}] зафиксировано: выезд отменен, сохранено {avoided:,.0f} руб."
            if is_suppress else
            f"Решение диспетчера [{dispatcher_badge}]: аварийная бригада направлена на объект."
        )

        return {
            "channel_id": channel_id,
            "decision": decision,
            "status": record["status"],
            "avoided_cost_rub": avoided,
            "dispatcher_badge": dispatcher_badge,
            "timestamp": record["timestamp"],
            "message": msg
        }

ml_service = MLService()
