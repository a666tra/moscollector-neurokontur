import os
from pydantic import BaseModel

class Settings(BaseModel):
    PROJECT_NAME: str = "Москоллектор.НейроКонтур"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    DESCRIPTION: str = (
        "Интеллектуальный веб-сервис предиктивного мониторинга, "
        "фильтрации ложных тревог и автоматизации ТО/ППР инженерных коллекторов АО «Москоллектор»"
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
    
    REGULATION_NAME: str = "Регламент технической эксплуатации коммуникационных коллекторов (Р ТЭК)"
    COMPLIANCE_STANDARDS: list[str] = [
        "152-ФЗ «О персональных данных» (Деперсонализация телеметрии)",
        "149-ФЗ «Об информации, информтехнологиях и защите информации»",
        "ГОСТ Р 53195.1-2008 (Безопасность функциональных систем ЖКХ)"
    ]
    
    AVERAGE_CALLOUT_COST_RUB: float = 18500.0
    PREVENTIVE_MAINTENANCE_COST_RUB: float = 3200.0
    TOTAL_COLLECTOR_KM: float = 825.0
    TOTAL_MONITORED_CHANNELS: int = 11485

settings = Settings()
