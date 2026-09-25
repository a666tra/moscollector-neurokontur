import os
from typing import Optional, List
from pydantic import BaseModel

class Settings(BaseModel):
    PROJECT_NAME: str = "Москоллектор.НейроКонтур"
    VERSION: str = "2.0.0"
    API_V1_STR: str = "/api"
    DESCRIPTION: str = (
        "Интеллектуальный программный комплекс предиктивного мониторинга деградации датчиков СМВУ, "
        "фильтрации ложных тревог и автоматизации наряд-заказов на ТО/ППР подземных коллекторов АО «Москоллектор»"
    )
    
    BASE_DIR: str = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    ROOT_DIR: str = os.path.dirname(BASE_DIR)
    DATA_DIR: str = os.path.join(BASE_DIR, "data")
    MODELS_DIR: str = os.path.join(BASE_DIR, "models")
    FRONTEND_DIST: str = (
        os.path.join(ROOT_DIR, "frontend", "dist")
        if os.path.exists(os.path.join(ROOT_DIR, "frontend", "dist"))
        else os.path.join(BASE_DIR, "frontend", "dist")
    )
    
    # Enterprise Database & SCADA integration readiness
    DATABASE_URL: Optional[str] = os.getenv("DATABASE_URL", "postgresql://moscollector:sec_pass@localhost:5432/smvu_db")
    STORAGE_BACKEND: str = os.getenv("STORAGE_BACKEND", "JSON_FILE")  # "JSON_FILE" or "POSTGRES"
    SCADA_OPC_HOST: str = os.getenv("SCADA_OPC_HOST", "opc.tcp://10.20.12.10:4840")
    SCADA_READ_ONLY: bool = True  # 149-ФЗ: strict read-only access to critical infrastructure
    
    REGULATION_NAME: str = "Регламент технической эксплуатации коммуникационных коллекторов (Р ТЭК)"
    COMPLIANCE_STANDARDS: List[str] = [
        "152-ФЗ «О персональных данных» (Деперсонализация телеметрии)",
        "149-ФЗ «Об информации, информтехнологиях и защите информации» (Read-only АСУ ТП)",
        "ГОСТ Р 53195.1-2008 (Функциональная безопасность критических систем ЖКХ)"
    ]
    
    AVERAGE_CALLOUT_COST_RUB: float = 18500.0
    PREVENTIVE_MAINTENANCE_COST_RUB: float = 3200.0
    TOTAL_COLLECTOR_KM: float = 825.0
    TOTAL_MONITORED_CHANNELS: int = 10712

settings = Settings()
