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
    
    # Optional configuration placeholders; no SCADA or PostgreSQL integration is active.
    DATABASE_URL: Optional[str] = os.getenv("DATABASE_URL")
    STORAGE_BACKEND: str = "JSON_FILE"
    SCADA_OPC_HOST: Optional[str] = os.getenv("SCADA_OPC_HOST")
    SCADA_READ_ONLY: bool = True
    
    REGULATION_NAME: str = "Регламент технической эксплуатации коммуникационных коллекторов (РТЭК)"
    COMPLIANCE_STANDARDS: List[str] = []  # No formal compliance assessment was performed.
    
    AVERAGE_CALLOUT_COST_RUB: float = 18500.0
    PREVENTIVE_MAINTENANCE_COST_RUB: float = 3200.0
    TOTAL_COLLECTOR_KM: float = 825.0
    TOTAL_MONITORED_CHANNELS: int = 10712

settings = Settings()
