from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/kpis", tags=["kpis"])

class KpisOut(BaseModel):
    equipos: int
    alertas_activas: int
    anomalias_ml_v2: int
    acciones_dbt: int

@router.get("/", response_model=KpisOut)
def get_kpis():
    # TODO: reemplazar por query real a Postgres
    return {
        "equipos": 933,
        "alertas_activas": 131,
        "anomalias_ml_v2": 7,
        "acciones_dbt": 131,
    }
       