import os
import json
import time
import hashlib
import joblib
import numpy as np
from datetime import datetime
from typing import Dict, Any, Optional, List
from backend.app.core.config import settings
from backend.app.services.data_service import data_service
from backend.app.api.settings import get_current_settings

CONFIRMED_ALARMS_PATH = os.path.join(settings.DATA_DIR, "confirmed_alarms.json")
AUTH_DISPATCHERS_PATH = os.path.join(settings.DATA_DIR, "authorized_dispatchers.json")

class MLService:
    def __init__(self):
        self.model = None
        self.model_lgbm = None
        self.model_lr = None
        self.model_rf = None
        self.scaler = None
        self.confirmed_alarms: List[Dict[str, Any]] = []
        self.stype_map: Dict[str, int] = {}
        self.sys_map: Dict[str, int] = {}
        self.authorized_dispatchers: Dict[str, Dict[str, Any]] = {}
        self.optimal_thresholds: Dict[str, float] = {
            "champion_lightgbm": 0.8147,
            "logistic_regression": 0.8000,
            "random_forest": 0.7797
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
        if os.path.exists(AUTH_DISPATCHERS_PATH):
            try:
                with open(AUTH_DISPATCHERS_PATH, 'r', encoding='utf-8') as f:
                    self.authorized_dispatchers = json.load(f)
            except Exception as e:
                print(f"Error loading dispatchers: {e}")
        if not self.authorized_dispatchers:
            self.authorized_dispatchers = {
                "ДИСП-7041": {
                    "badge": "ДИСП-7041",
                    "full_name": "Кузнецов Артем Дмитриевич",
                    "role": "Главный инженер смены ОДС",
                    "clearance_level": "Level-3 (Главный диспетчер)",
                    "pin_hash": hashlib.sha256("704192".encode('utf-8')).hexdigest(),
                    "can_confirm_false_alarm": True,
                    "can_force_dispatch": True
                },
                "ДИСП-0482": {
                    "badge": "ДИСП-0482",
                    "full_name": "Иванов Илья Сергеевич",
                    "role": "Старший диспетчер ОДС №1",
                    "clearance_level": "Level-2 (КИИ/ГОСТ Р 53195)",
                    "pin_hash": hashlib.sha256("048251".encode('utf-8')).hexdigest(),
                    "can_confirm_false_alarm": True,
                    "can_force_dispatch": True
                },
                "ДИСП-3318": {
                    "badge": "ДИСП-3318",
                    "full_name": "Смирнова Елена Михайловна",
                    "role": "Ведущий диспетчер ОДС",
                    "clearance_level": "Level-2 (КИИ/ГОСТ Р 53195)",
                    "pin_hash": hashlib.sha256("331844".encode('utf-8')).hexdigest(),
                    "can_confirm_false_alarm": True,
                    "can_force_dispatch": True
                },
                "ДИСП-1094": {
                    "badge": "ДИСП-1094",
                    "full_name": "Петров Сергей Владимирович",
                    "role": "Инженер-диспетчер телеметрии",
                    "clearance_level": "Level-1 (Оператор СМВУ)",
                    "pin_hash": hashlib.sha256("109407".encode('utf-8')).hexdigest(),
                    "can_confirm_false_alarm": False,
                    "can_force_dispatch": True
                }
            }

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
        
        picket = coords.get("picket", "ПК28")
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
                    f"или файл весов отсутствует. Автоматическая подмена другой моделью заблокирована (ГОСТ Р 53195)."
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
                    f"или файл весов отсутствует. Автоматическая подмена другой моделью заблокирована (ГОСТ Р 53195)."
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
                f"Автоматический возврат ложно-безопасного статуса NORMAL заблокирован согласно требованиям ГОСТ Р 53195."
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

        return {
            "channel_id": channel_id,
            "sensor_name": s_name,
            "object_name": obj_name,
            "picket": picket,
            "failure_probability": round(prob, 4),
            "risk_level": risk,
            "threshold_used": threshold,
            "calibrated_threshold": calibrated_threshold,
            "is_degradation_detected": is_degradation,
            "top_factors": factors,
            "recommended_action": action,
            "inference_latency_ms": round(latency_ms, 3),
            "model_used": model_used
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
                "diagnosis": f"Аппаратный сбой канала: деградация сенсорного узла ({current_value}). Вероятность отказа: {int(base_fail_prob*100)}%.",
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
        """Human-in-the-loop decision confirmation by ODS dispatcher with 2FA (Badge + PIN), RBAC & SHA-256 ledger chaining."""
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

        # Normalization and RBAC verification
        norm_badge = dispatcher_badge.strip()
        if norm_badge == "7041-ОДС":
            norm_badge = "ДИСП-7041"
        
        if norm_badge not in self.authorized_dispatchers:
            raise ValueError(
                f"Отказ в авторизации: табельный номер '{dispatcher_badge}' не зарегистрирован "
                f"в реестре уполномоченного персонала ОДС АО 'Москоллектор'. "
                f"Операция отклонена согласно ГОСТ Р 53195 / 187-ФЗ."
            )

        disp = self.authorized_dispatchers[norm_badge]

        # Authenticate dispatcher via PIN hash check (Fail-Closed security)
        clean_pin = (dispatcher_pin or "").strip()
        pin_hash = hashlib.sha256(clean_pin.encode('utf-8')).hexdigest()
        stored_hash = disp.get("pin_hash")
        if not stored_hash or pin_hash != stored_hash:
            raise ValueError(
                f"Отказ в аутентификации: неверный PIN-код для табельного номера '{norm_badge}'. "
                f"Операция подтверждения решения заблокирована согласно регламенту ИБ ОДС."
            )

        # Enforce RBAC permissions
        if is_suppress and not disp.get("can_confirm_false_alarm", True):
            raise ValueError(
                f"Отказ в доступе (RBAC): сотрудник с табельным номером '{norm_badge}' ({disp.get('role')}) "
                f"не наделен полномочиями отмены аварийного выезда бригады."
            )
        if (not is_suppress) and not disp.get("can_force_dispatch", True):
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
                    "реестра аудита (ГОСТ Р 53195-2014). Запись новых решений заблокирована до устранения несоответствия."
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
            "clearance_level": disp.get("clearance_level", "Level-2"),
            "timestamp": timestamp_str,
            "notes": note_text,
            "prev_hash": prev_hash,
            "record_hash": record_hash,
            "signature_standard": "ГОСТ Р 53195-2014 / SHA-256 Ledger"
        }
        self.confirmed_alarms.insert(0, record)
        self.save_confirmed_alarms()

        msg = (
            f"Решение диспетчера [{norm_badge} {disp.get('full_name')}]: ложная тревога подтверждена. "
            f"Выезд отменен. Предотвращен ущерб: {avoided:,.0f} ₽. Запись заверена в криптографическом реестре аудита."
            if is_suppress else
            f"Решение диспетчера [{norm_badge} {disp.get('full_name')}]: аварийная бригада направлена на объект. Запись заверена."
        )

        return {
            "channel_id": channel_id,
            "decision": decision,
            "status": record["status"],
            "avoided_cost_rub": avoided,
            "dispatcher_badge": norm_badge,
            "dispatcher_name": disp.get("full_name"),
            "dispatcher_role": disp.get("role"),
            "clearance_level": disp.get("clearance_level"),
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
                "standard": "ГОСТ Р 53195-2014 / SHA-256 Ledger",
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

            badge_ok = badge in self.authorized_dispatchers
            link_ok = (idx == 0 and rec_prev == "0" * 64) or (idx > 0 and rec_prev == expected_prev)

            payload = f"{rec_prev}|{channel_id}|{decision}|{badge}|{ts}|{avoided:.2f}|{notes}".encode('utf-8')
            computed_hash = hashlib.sha256(payload).hexdigest()
            hash_ok = (computed_hash == rec_hash)

            record_ok = link_ok and hash_ok and badge_ok
            if not record_ok:
                is_valid = False

            details.append({
                "index": idx,
                "channel_id": channel_id,
                "dispatcher_badge": badge,
                "link_valid": link_ok,
                "hash_valid": hash_ok,
                "badge_authorized": badge_ok,
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
            "standard": "ГОСТ Р 53195-2014 / SHA-256 Ledger",
            "verified_at": datetime.now().isoformat(),
            "details": details
        }

ml_service = MLService()
