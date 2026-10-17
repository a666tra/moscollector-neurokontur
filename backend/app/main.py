import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from backend.app.core.config import settings
from backend.app.api.stats import router as stats_router
from backend.app.api.objects import router as objects_router
from backend.app.api.predictions import router as predictions_router
from backend.app.api.alarms import router as alarms_router
from backend.app.api.tickets import router as tickets_router
from backend.app.api.simulation import router as simulation_router
from backend.app.api.settings import router as settings_router
from backend.app.api.synthetic import router as synthetic_router
from backend.app.api.scenarios import router as scenarios_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=settings.DESCRIPTION,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/api/openapi.json"
)

# The UI is served from the same origin, so CORS is off by default. External web clients are
# allowed explicitly: LCT_CORS_ORIGINS="https://a.example,https://b.example".
_cors_origins = [o.strip() for o in os.environ.get("LCT_CORS_ORIGINS", "").split(",") if o.strip()]
if _cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH"],
        allow_headers=["Content-Type"],
    )

# API Routers
app.include_router(stats_router, prefix="/api/stats", tags=["Статистика и KPI"])
app.include_router(objects_router, prefix="/api/objects", tags=["Объекты и ГИС-сеть"])
app.include_router(predictions_router, prefix="/api/predictions", tags=["Предиктивный ML-анализ"])
app.include_router(alarms_router, prefix="/api/alarms", tags=["Ложные тревоги и СМВУ"])
app.include_router(tickets_router, prefix="/api/tickets", tags=["Заявки ТО/ППР"])
app.include_router(simulation_router, prefix="/api/simulation", tags=["Симулятор потока телеметрии"])
app.include_router(settings_router, prefix="/api/settings", tags=["Настройки и Безопасность"])
app.include_router(synthetic_router, prefix="/api/synthetic", tags=["Синтетическая валидация"])
app.include_router(scenarios_router, prefix="/api/scenarios", tags=["Сценарный полигон"])


def get_build_info() -> str:
    for env_var in ("RENDER_GIT_COMMIT", "GIT_COMMIT"):
        val = os.environ.get(env_var)
        if val and val.strip():
            return val.strip()
    return "unknown"


def get_data_snapshot_date() -> str:
    from backend.app.services.data_service import data_service
    rep = getattr(data_service, "metrics_report", {}) or {}
    prov = rep.get("dataset_provenance", {})
    cutoff = prov.get("prediction_cutoff")
    if cutoff and isinstance(cutoff, str):
        return cutoff[:10]
    return "2026-01-28"


@app.get("/api/health", tags=["Система"])
def health_check():
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "build": get_build_info(),
        "data_snapshot_date": get_data_snapshot_date(),
        "monitored_infrastructure": f"{settings.TOTAL_COLLECTOR_KM} км коллекторов Москвы",
        "inference_engine": "LightGBM Classifier + Rule Engine",
        "compliance": settings.COMPLIANCE_STANDARDS
    }

@app.get("/api/info", tags=["Система"])
def get_system_info():
    return {
        "name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "build": get_build_info(),
        "data_snapshot_date": get_data_snapshot_date(),
        "regulation": settings.REGULATION_NAME,
        "description": settings.DESCRIPTION,
        "docs_url": "/docs"
    }

# Mount frontend static files if built
frontend_dist = settings.FRONTEND_DIST
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
else:
    @app.get("/")
    def index_fallback():
        return {
            "message": f"Добро пожаловать в сервис {settings.PROJECT_NAME}!",
            "docs": "/docs",
            "health": "/api/health",
            "stats": "/api/stats/summary",
            "objects": "/api/objects",
            "predictions": "/api/predictions",
            "tickets": "/api/tickets"
        }

