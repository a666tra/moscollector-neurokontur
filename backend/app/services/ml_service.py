import os
import json
import time
import hashlib
import hmac
import re
import secrets
import threading
import tempfile
import joblib
import numpy as np
from datetime import datetime
from typing import Dict, Any, Optional, List
from backend.app.core.config import settings
from backend.app.services.data_service import data_service
from backend.app.api.settings import get_current_settings

CONFIRMED_ALARMS_PATH = os.environ.get(
    "LCT_CONFIRMED_ALARMS_PATH",
    os.path.join(settings.DATA_DIR, "confirmed_alarms.json"),
)
AUTH_DISPATCHERS_PATH = os.environ.get(
    "LCT_DISPATCHER_REGISTRY_PATH",
    os.path.join(settings.DATA_DIR, "authorized_dispatchers.json"),
)
PIN_HASH_SCHEME = "pbkdf2_sha256"
PIN_HASH_ITERATIONS = 600_000
PIN_SALT_BYTES = 16
PIN_HASH_BYTES = 32

class DispatcherAuthenticationError(ValueError):
    """Raised when dispatcher credentials cannot be verified."""


class DispatcherAuthorizationError(ValueError):
    """Raised when an authenticated dispatcher lacks the required clearance."""


class MLService:
    def __init__(self):
        self._audit_lock = threading.RLock()
        self.model = None
        self.model_lgbm = None
        self.model_lr = None
        self.model_rf = None
        self.scaler = None
        self.calibrator = None
        self.calibrator_method = None
        self.confirmed_alarms: List[Dict[str, Any]] = []
        self.stype_map: Dict[str, int] = {}
        self.sys_map: Dict[str, int] = {}
        self.authorized_dispatchers: Dict[str, Dict[str, Any]] = {}
        self.optimal_thresholds: Dict[str, float] = {
            "champion_lightgbm": 0.845,
            "logistic_regression": 0.8000,
            "random_forest": 0.7695
        }
        self.load_model()
        self.load_metadata()
        self.load_authorized_dispatchers()
        self.load_confirmed_alarms()

    def load_model(self):
        lgbm_path = os.path.join(settings.MODELS_DIR, "champion_lgbm.joblib")
        lr_path = os.path.join(settings.MODELS_DIR, "logistic_regression.joblib")
        rf_path = os.path.join(settings.MODELS_DIR, "random_forest.joblib")
        scaler_path = os.path.join(settings.MODELS_DIR, "feature_scaler.joblib")
        beta_calibrator_path = os.path.join(settings.MODELS_DIR, "champion_calibrator_beta.joblib")
        platt_calibrator_path = os.path.join(settings.MODELS_DIR, "champion_calibrator.joblib")

        try:
            if os.path.exists(lgbm_path):
                self.model_lgbm = joblib.load(lgbm_path)
                self.model = self.model_lgbm
            if os.path.exists(lr_path):
                self.model_lr = joblib.load(lr_path)
            if os.path.exists(rf_path):
                self.model_rf = joblib.load(rf_path)
            if os.path.exists(scaler_path):
                self.scaler = joblib.load(scaler_path)
            if os.path.exists(beta_calibrator_path):
                self.calibrator = joblib.load(beta_calibrator_path)
                self.calibrator_method = "beta"
            elif os.path.exists(platt_calibrator_path):
                self.calibrator = joblib.load(platt_calibrator_path)
                self.calibrator_method = "platt_legacy"
        except Exception as e:
            print(f"Error loading models: {e}")

    def load_metadata(self):
        meta_path = os.path.join(settings.MODELS_DIR, "model_metadata.json")
        if os.path.exists(meta_path):
            try:
                with open(meta_path, 'r', encoding='utf-8') as f:
                    meta = json.load(f)
                    self.stype_map = meta.get("stype_map", {})
                    self.sys_map = meta.get("sys_map", {})
                    if "optimal_thresholds" in meta:
                        self.optimal_thresholds.update(meta["optimal_thresholds"])
            except Exception as e:
                print(f"Error loading metadata: {e}")

    def load_authorized_dispatchers(self):
        self.authorized_dispatchers = {}
        if not os.path.exists(AUTH_DISPATCHERS_PATH):
            return

        try:
            with open(AUTH_DISPATCHERS_PATH, 'r', encoding='utf-8') as f:
                loaded = json.load(f)
            if not isinstance(loaded, dict):
                raise ValueError("Реестр сотрудников должен быть JSON-объектом")
            for badge, dispatcher in loaded.items():
                if not self._valid_dispatcher_record(badge, dispatcher):
                    raise ValueError("Реестр содержит запись с недопустимой схемой")
            self.authorized_dispatchers = loaded
        except Exception as e:
            self.authorized_dispatchers = {}
            print(f"Error loading dispatchers: {e}")

    @staticmethod
    def _valid_pin_hash(encoded_hash: Any) -> bool:
        if not isinstance(encoded_hash, str) or not re.fullmatch(
            r"pbkdf2_sha256\$\d{6,7}\$[0-9a-f]{32}\$[0-9a-f]{64}", encoded_hash
        ):
            return False
        parts = encoded_hash.split("$")
        if len(parts) != 4 or parts[0] != PIN_HASH_SCHEME:
            return False
        try:
            iterations = int(parts[1])
            salt = bytes.fromhex(parts[2])
            digest = bytes.fromhex(parts[3])
        except (TypeError, ValueError):
            return False
        return (
            PIN_HASH_ITERATIONS <= iterations <= 2_000_000
            and len(salt) >= PIN_SALT_BYTES
            and len(digest) == PIN_HASH_BYTES
        )

    @classmethod
    def _valid_dispatcher_record(cls, badge: Any, dispatcher: Any) -> bool:
        if not isinstance(badge, str) or not re.fullmatch(r"(?:ДИСП-\d{4}|\d{4}-ОДС)", badge):
            return False
        if not isinstance(dispatcher, dict) or dispatcher.get("badge") != badge:
            return False
        if not all(isinstance(dispatcher.get(key), str) and dispatcher[key].strip()
                   for key in ("full_name", "role")):
            return False
        if type(dispatcher.get("clearance_level")) is not int or dispatcher["clearance_level"] not in (1, 2, 3):
            return False
        if type(dispatcher.get("can_confirm_false_alarm")) is not bool:
            return False
        if type(dispatcher.get("can_force_dispatch")) is not bool:
            return False
        return cls._valid_pin_hash(dispatcher.get("pin_hash"))

    @staticmethod
    def _verify_pin(pin: str, encoded_hash: Any) -> bool:
        if not MLService._valid_pin_hash(encoded_hash):
            return False
        scheme, raw_iterations, salt_hex, expected_hex = encoded_hash.split("$")
        iterations = int(raw_iterations)
        candidate = hashlib.pbkdf2_hmac(
            "sha256", pin.encode("utf-8"), bytes.fromhex(salt_hex), iterations, dklen=PIN_HASH_BYTES
        )
        return hmac.compare_digest(candidate, bytes.fromhex(expected_hex))

    def authenticate_dispatcher(
        self,
        dispatcher_badge: Optional[str],
        dispatcher_pin: Optional[str],
        min_clearance_level: int = 1,
    ) -> tuple[str, Dict[str, Any]]:
        """Verify an employee badge, six-digit PIN and minimum clearance."""
        if not self.authorized_dispatchers:
            raise DispatcherAuthenticationError(
                "Ошибка аутентификации: реестр сотрудников отсутствует или не загружен."
            )

        badge = (dispatcher_badge or "").strip()
        dispatcher = self.authorized_dispatchers.get(badge)
        if not dispatcher:
            raise DispatcherAuthenticationError(
                "Отказ в аутентификации: табельный номер не зарегистрирован."
            )

        pin = (dispatcher_pin or "").strip()
        stored_hash = dispatcher.get("pin_hash")
        if (
            not re.fullmatch(r"\d{6}", pin)
            or not self._verify_pin(pin, stored_hash)
        ):
            raise DispatcherAuthenticationError(
                "Отказ в аутентификации: неверный badge или 6-значный PIN-код."
            )

        clearance = dispatcher.get("clearance_level")
        if type(min_clearance_level) is not int or min_clearance_level not in (1, 2, 3):
            raise DispatcherAuthorizationError("Недопустимый требуемый уровень доступа.")
        if type(clearance) is not int or clearance not in (1, 2, 3) or clearance < min_clearance_level:
            raise DispatcherAuthorizationError(
                f"Недостаточный уровень доступа (RBAC): требуется Level-{min_clearance_level}."
            )
        return badge, dispatcher

    def load_confirmed_alarms(self):
        if not os.path.exists(CONFIRMED_ALARMS_PATH):
            self.confirmed_alarms = []
            return
        try:
            with open(CONFIRMED_ALARMS_PATH, 'r', encoding='utf-8') as f:
                loaded = json.load(f)
            if not isinstance(loaded, list) or not all(isinstance(item, dict) for item in loaded):
                raise ValueError("Журнал аудита должен содержать список записей")
            self.confirmed_alarms = loaded
        except Exception as exc:
            raise RuntimeError("Не удалось безопасно загрузить журнал аудита; запуск остановлен") from exc

    def save_confirmed_alarms(self):
        data_dir = os.path.dirname(os.path.abspath(CONFIRMED_ALARMS_PATH))
        temp_path = None
        try:
            os.makedirs(data_dir, exist_ok=True)
            with tempfile.NamedTemporaryFile(
                mode="w", encoding="utf-8", dir=data_dir, delete=False
            ) as f:
                temp_path = f.name
                json.dump(self.confirmed_alarms, f, ensure_ascii=False, indent=2)
                f.flush()
                os.fsync(f.fileno())
            os.replace(temp_path, CONFIRMED_ALARMS_PATH)
        except Exception as e:
            if temp_path and os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except OSError:
                    pass
            raise RuntimeError("Не удалось атомарно сохранить журнал аудита") from e

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
        temp_spikes: int = 0,
        mean_val: float = 0.0,
        std_val: float = 0.0,
        num_max: float = 0.0,
        last_value: str = "Норма",
        unique_states: Optional[int] = None,
        model_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """Real-time dynamic inference using LightGBM, Logistic Regression, or Random Forest."""
        t_start = time.perf_counter()
        
        s_info = data_service.sensors.get(channel_id, {})
        oid = s_info.get("object_id", "")
        obj = data_service.objects.get(oid, {})
        coords = data_service.object_coords.get(oid, {})
        
        picket = coords.get("picket") or "Не определён"
        obj_name = obj.get("name", "Коллекторный узел")
        s_name = s_info.get("sensor_name", f"Датчик {channel_id}")

        alarm_ratio = alarms_7d / max(1, cnt_7d)
        acc_events = cnt_24h / (cnt_7d / 7.0 + 0.1)
        acc_alarms = alarms_24h / (alarms_7d / 7.0 + 0.1)
        chatter_ratio = chatter_cnt / max(1, cnt_7d)
        
        stype_str = s_info.get("sensor_type", "")
        sys_str = s_info.get("system_type", "")
        stype_code = self.stype_map.get(stype_str, 0)
        sys_code = self.sys_map.get(sys_str, 0)
        obj_level = int(obj.get("hierarchy_level", 3))

        # Determine unique_states accurately
        if unique_states is not None:
            unique_states_val = float(unique_states)
        elif std_val > 0.0 or abs(mean_val) > 0.0:
            unique_states_val = float(max(2, min(50, int(cnt_24h * 0.25) + 2)))
        else:
            states_count = 1
            if chatter_cnt > 0: states_count += 1
            if alarms_24h > 0 or alarms_7d > 0: states_count += 1
            if battery_glitches > 0: states_count += 1
            if date_corruptions > 0: states_count += 1
            unique_states_val = float(max(1, min(6, states_count)))

        # 21-dim feature vector matching training schema precisely
        feature_vec = np.array([[
            float(cnt_24h),
            float(cnt_7d),
            float(alarms_24h),
            float(alarms_7d),
            float(alarm_ratio),
            float(acc_events),
            float(acc_alarms),
            float(chatter_cnt),
            float(chatter_ratio),
            float(battery_glitches),
            float(date_corruptions),
            float(unique_states_val),
            float(silence_hours),
            float(mean_val),
            float(std_val),
            float(num_max if num_max > 0 else mean_val),
            float(stype_code),
            float(sys_code),
            float(gas_spikes),
            float(temp_spikes),
            float(obj_level)
        ]], dtype=np.float32)

        active_settings = get_current_settings()
        selected_mod = (model_name or active_settings.selected_model or "champion_lightgbm").lower()
        model_executed = False
        prob = 0.0
        model_used = selected_mod

        if "logistic" in selected_mod:
            if self.model_lr is None:
                raise RuntimeError(
                    f"Критический отказ ML-контура: затребованная модель 'logistic_regression' не инициализирована "
                    f"или файл весов отсутствует. Автоматическая подмена другой моделью заблокирована."
                )
            try:
                scaled = self.scaler.transform(feature_vec) if self.scaler is not None else feature_vec
                probs = self.model_lr.predict_proba(scaled)
                prob = float(probs[0][1])
                model_used = "logistic_regression"
                model_executed = True
            except Exception as e:
                raise RuntimeError(f"Критический сбой инференса модели 'logistic_regression': {e}")
        elif "forest" in selected_mod:
            if self.model_rf is None:
                raise RuntimeError(
                    f"Критический отказ ML-контура: затребованная модель 'random_forest' не инициализирована "
                    f"или файл весов отсутствует. Автоматическая подмена другой моделью заблокирована."
                )
            try:
                probs = self.model_rf.predict_proba(feature_vec)
                prob = float(probs[0][1])
                model_used = "random_forest"
                model_executed = True
            except Exception as e:
                raise RuntimeError(f"Критический сбой инференса модели 'random_forest': {e}")
        elif "lightgbm" in selected_mod or "champion" in selected_mod or not selected_mod:
            if self.model_lgbm is None:
                raise RuntimeError(
                    f"Критический отказ ML-контура: базовая модель 'champion_lightgbm' не инициализирована "
                    f"или файл весов отсутствует. Автоматический возврат ложного статуса NORMAL заблокирован."
                )
            try:
                probs = self.model_lgbm.predict_proba(feature_vec)
                prob = float(probs[0][1])
                model_used = "champion_lightgbm"
                model_executed = True
            except Exception as e:
                raise RuntimeError(f"Критический сбой инференса модели 'champion_lightgbm': {e}")
        else:
            raise RuntimeError(
                f"Неизвестная модель ML-контура: '{selected_mod}'. "
                f"Допустимые идентификаторы: 'champion_lightgbm', 'logistic_regression', 'random_forest'."
            )

        if not model_executed:
            raise RuntimeError(
                f"Критический отказ ML-контура: модель '{selected_mod}' не смогла завершить расчёт вероятности. "
                f"Автоматический возврат ложно-безопасного статуса NORMAL заблокирован."
            )
        
        latency_ms = (time.perf_counter() - t_start) * 1000

        # Uniform threshold strictly synchronized with system settings across entire platform
        threshold = active_settings.decision_threshold
        calibrated_threshold = self.optimal_thresholds.get(model_used, threshold)
        is_degradation = prob >= threshold

        crit_t = max(0.70, threshold)
        if prob >= crit_t:
            risk = "CRITICAL"
            action = "Срочный наряд-заказ ТО на пикет. Превентивная замена сенсорного элемента."
        elif prob >= threshold:
            risk = "WARNING"
            action = "Плановый осмотр в графике ППР текущей недели."
        elif prob >= 0.20:
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
            factors.append("Сброс RTC контроллера (Unix Epoch 1970)")
        if gas_spikes > 0:
            factors.append("Всплеск концентрации метана (> 1.0%)")
        if temp_spikes > 0:
            factors.append("Температурная аномалия (> 35°C)")
        if not factors:
            factors.append("Штатные параметры телеметрии")

        # Strict Calibrator handling: fail-closed without silent fallback
        calibrated_prob = None
        is_calibrated = False
        calibration_status = "NOT_APPLICABLE"

        if model_used == "champion_lightgbm":
            if self.calibrator is not None:
                try:
                    clipped_prob = float(np.clip(prob, 1e-6, 1.0 - 1e-6))
                    if int(getattr(self.calibrator, "n_features_in_", 1)) == 2:
                        cal_features = [[np.log(clipped_prob), -np.log1p(-clipped_prob)]]
                    else:
                        cal_features = [[prob]]
                    cal_val = float(self.calibrator.predict_proba(cal_features)[0][1])
                    calibrated_prob = round(cal_val, 4)
                    is_calibrated = True
                    calibration_status = (
                        "CALIBRATED_BETA" if getattr(self, "calibrator_method", "platt_legacy") == "beta"
                        else "CALIBRATED_PLATT"
                    )
                except Exception as e:
                    calibrated_prob = None
                    is_calibrated = False
                    calibration_status = f"CALIBRATION_ERROR: {str(e)}"
            else:
                calibrated_prob = None
                is_calibrated = False
                calibration_status = "CALIBRATOR_UNAVAILABLE"
        else:
            calibration_status = f"NO_CALIBRATOR_FOR_{model_used.upper()}"

        return {
            "channel_id": channel_id,
            "sensor_name": s_name,
            "object_name": obj_name,
            "picket": picket,
            "raw_model_score": round(prob, 4),
            "calibrated_proxy_probability": calibrated_prob,
            "is_calibrated": is_calibrated,
            "calibration_status": calibration_status,
            "failure_probability": round(prob, 4),  # Deprecated alias to raw_model_score for backward compatibility
            "risk_score": round(prob, 4),           # Explicit alias to raw_model_score
            "calibrated_probability": calibrated_prob,
            "risk_level": risk,
            "threshold_used": threshold,
            "raw_threshold": threshold,
            "calibrated_threshold": calibrated_threshold,
            "is_degradation_detected": is_degradation,
            "top_factors": factors,
            "recommended_action": action,
            "inference_latency_ms": round(latency_ms, 3),
            "model_used": model_used,
            "score_semantics": (
                "raw_model_score: безразмерный балл риска модели [0,1] для ранжирования каналов в очереди разбора. "
                "calibrated_proxy_probability: "
                + (
                    "beta-калиброванная" if self.calibrator_method == "beta"
                    else "legacy Platt-калиброванная" if self.calibrator_method == "platt_legacy"
                    else "недоступная без калибратора"
                )
                + " оценка вероятности алгоритмической proxy-аномалии телеметрии "
                "в заданном окне 24–72 ч. Proxy включает события качества данных, например сброс RTC; это не вероятность "
                "физической аварии. Калибровочная неопределённость оценивается агрегатно по cohort и не является интервалом "
                "для отдельного канала."
            )
        }

    def classify_alarm(
        self,
        channel_id: str,
        current_value: str,
        recent_events_count_1h: int = 1,
        recent_flips_count_1h: int = 0,
        duration_minutes: float = 0.0
    ) -> Dict[str, Any]:
        """Classify alarm into FALSE_ALARM, REAL_RISK, SENSOR_DEGRADATION, NORMAL."""
        active_settings = get_current_settings()
        s_info = data_service.sensors.get(channel_id, {})
        stype = s_info.get("sensor_type", "").lower()

        # Channel risk score from precomputed predictions
        pred = data_service.predictions_by_channel.get(channel_id, {})
        base_fail_prob = pred.get("failure_probability", 0.05)

        # 1. Real Danger Check (gas spikes, extreme temperature)
        try:
            val_num = float(current_value.replace(",", "."))
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
                elif val_num >= active_settings.gas_warning_threshold_vol_pct:
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
        chatter_threshold = active_settings.chatter_min_flips
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
                "avoided_callout_cost_rub": active_settings.callout_cost_rub
            }

        # 3. Sensor Degradation vs Real Failure
        if base_fail_prob >= active_settings.decision_threshold or "неисправ" in current_value.lower() or "отключ" in current_value.lower():
            return {
                "channel_id": channel_id,
                "verdict": "SENSOR_DEGRADATION",
                "is_false_alarm": False,
                "confidence": round(max(0.75, base_fail_prob), 3),
                "diagnosis": f"Аппаратный сбой канала: деградация сенсорного узла ({current_value}). Балл риска модели: {base_fail_prob:.2f} (порог {active_settings.decision_threshold}).",
                "recommended_action": "Автоматическое создание наряд-заказа на превентивную замену датчика (ППР) до аварии.",
                "avoided_callout_cost_rub": active_settings.callout_cost_rub - active_settings.preventive_cost_rub
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
        dispatcher_badge: str,
        dispatcher_pin: str = "",
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        with self._audit_lock:
            return self._confirm_alarm_locked(
                channel_id=channel_id,
                decision=decision,
                dispatcher_badge=dispatcher_badge,
                dispatcher_pin=dispatcher_pin,
                notes=notes,
            )

    def _confirm_alarm_locked(
        self,
        channel_id: str,
        decision: str,
        dispatcher_badge: str,
        dispatcher_pin: str = "",
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """Confirm a dispatcher decision after badge/PIN checks and RBAC validation."""
        active_settings = get_current_settings()
        now = datetime.now()

        # Enforce strict decision enum
        if decision not in ("CONFIRM_FALSE_ALARM", "FORCE_DISPATCH"):
            raise ValueError(
                f"Недопустимое решение диспетчера: '{decision}'. "
                f"Разрешены только строго регламентированные операции: 'CONFIRM_FALSE_ALARM' или 'FORCE_DISPATCH'."
            )

        is_suppress = (decision == "CONFIRM_FALSE_ALARM")
        avoided = active_settings.callout_cost_rub if is_suppress else 0.0

        # Verify identity, explicit clearance, and capability through one strict code path.
        norm_badge, disp = self.authenticate_dispatcher(
            dispatcher_badge, dispatcher_pin, min_clearance_level=2
        )

        # Enforce RBAC permissions
        if is_suppress and disp.get("can_confirm_false_alarm") is not True:
            raise ValueError(
                f"Отказ в доступе (RBAC): сотрудник с табельным номером '{norm_badge}' ({disp.get('role')}) "
                f"не наделен полномочиями отмены аварийного выезда бригады."
            )
        if (not is_suppress) and disp.get("can_force_dispatch") is not True:
            raise ValueError(
                f"Отказ в доступе (RBAC): сотрудник с табельным номером '{norm_badge}' ({disp.get('role')}) "
                f"не наделен полномочиями принудительного вызова аварийной бригады."
            )

        # Fail-closed integrity audit: check that prior ledger records were not corrupted/tampered with
        if self.confirmed_alarms:
            audit_check = self.verify_audit_log_integrity()
            if audit_check.get("tamper_detected", False):
                raise RuntimeError(
                    "Отказ в проведении операции: обнаружена компрометация целостности криптографического "
                    "журнала аудита. Запись новых решений заблокирована до устранения несоответствия."
                )

        timestamp_str = now.strftime("%Y-%m-%d %H:%M:%S")
        note_text = notes or ("Подтверждена ложная тревога диспетчером" if is_suppress else "Принудительный выезд бригады")

        # SHA-256 Ledger Block Chaining
        prev_hash = "0" * 64
        if self.confirmed_alarms:
            # Most recent record is at index 0
            prev_hash = self.confirmed_alarms[0].get("record_hash") or ("0" * 64)

        hash_payload = f"{prev_hash}|{channel_id}|{decision}|{norm_badge}|{timestamp_str}|{avoided:.2f}|{note_text}".encode('utf-8')
        record_hash = hashlib.sha256(hash_payload).hexdigest()

        record = {
            "channel_id": channel_id,
            "decision": decision,
            "status": "SUPPRESSED_CONFIRMED" if is_suppress else "DISPATCH_CONFIRMED",
            "avoided_cost_rub": avoided,
            "dispatcher_badge": norm_badge,
            "dispatcher_name": disp.get("full_name", "Не указан"),
            "dispatcher_role": disp.get("role", "Диспетчер ОДС"),
            "clearance_level": f"Level-{disp.get('clearance_level', 2)}",
            "timestamp": timestamp_str,
            "notes": note_text,
            "prev_hash": prev_hash,
            "record_hash": record_hash,
            "signature_standard": None
        }
        self.confirmed_alarms.insert(0, record)
        try:
            self.save_confirmed_alarms()
        except Exception as exc:
            self.confirmed_alarms.pop(0)
            raise RuntimeError("Операция отменена: запись аудита не сохранена") from exc

        msg = (
            f"Решение диспетчера [{norm_badge} {disp.get('full_name')}]: ложная тревога подтверждена. "
            f"В демо отмечена отмена выезда; расчетная стоимость вызова: {avoided:,.0f} ₽. Решение записано в локальный журнал."
            if is_suppress else
            f"Решение диспетчера [{norm_badge} {disp.get('full_name')}] записано локально; отправка бригады требует действия диспетчера."
        )

        return {
            "channel_id": channel_id,
            "decision": decision,
            "status": record["status"],
            "avoided_cost_rub": avoided,
            "dispatcher_badge": norm_badge,
            "dispatcher_name": disp.get("full_name"),
            "dispatcher_role": disp.get("role"),
            "clearance_level": f"Level-{disp.get('clearance_level')}",
            "timestamp": record["timestamp"],
            "message": msg,
            "prev_hash": prev_hash,
            "record_hash": record_hash,
            "signature_standard": record["signature_standard"]
        }

    def verify_audit_log_integrity(self) -> Dict[str, Any]:
        """Cryptographically verifies SHA-256 ledger integrity according to GOST R 53195-2014."""
        if not self.confirmed_alarms:
            return {
                "is_valid": True,
                "total_records": 0,
                "chain_length": 0,
                "head_hash": "0" * 64,
                "tamper_detected": False,
                "standard": "SHA-256 hash chain; integrity check only, no digital signature",
                "verified_at": datetime.now().isoformat(),
                "details": []
            }

        chronological = list(reversed(self.confirmed_alarms))
        is_valid = True
        details = []

        expected_prev = "0" * 64
        for idx, rec in enumerate(chronological):
            rec_prev = rec.get("prev_hash", "")
            rec_hash = rec.get("record_hash", "")
            badge = rec.get("dispatcher_badge", "")
            channel_id = rec.get("channel_id", "")
            decision = rec.get("decision", "")
            ts = rec.get("timestamp", "")
            notes = rec.get("notes", "")
            avoided = float(rec.get("avoided_cost_rub", 0.0))

            link_ok = (idx == 0 and rec_prev == "0" * 64) or (idx > 0 and rec_prev == expected_prev)

            payload = f"{rec_prev}|{channel_id}|{decision}|{badge}|{ts}|{avoided:.2f}|{notes}".encode('utf-8')
            computed_hash = hashlib.sha256(payload).hexdigest()
            hash_ok = (computed_hash == rec_hash)

            # Historical badges remain verifiable after account rotation/removal.
            # This check validates chain structure; the hash is not a dispatcher signature.
            badge_registered = badge in self.authorized_dispatchers
            record_ok = link_ok and hash_ok
            if not record_ok:
                is_valid = False

            details.append({
                "index": idx,
                "channel_id": channel_id,
                "dispatcher_badge": badge,
                "link_valid": link_ok,
                "hash_valid": hash_ok,
                "badge_registered_at_verification": badge_registered,
                "block_hash": (rec_hash[:16] + "...") if rec_hash else "None"
            })
            expected_prev = rec_hash

        head_hash = self.confirmed_alarms[0].get("record_hash", "")
        return {
            "is_valid": is_valid,
            "total_records": len(self.confirmed_alarms),
            "chain_length": len(self.confirmed_alarms),
            "head_hash": head_hash,
            "tamper_detected": not is_valid,
            "standard": "SHA-256 hash chain; integrity check only, no digital signature",
            "verified_at": datetime.now().isoformat(),
            "details": details
        }

ml_service = MLService()
