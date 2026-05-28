# schemas/acciones.py
# backend/schemas/acciones.py
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime


class Accion(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: Optional[str] = None
    tipo: Optional[str] = None
    prioridad: Optional[str] = None
    titulo: Optional[str] = None
    mensaje: Optional[str] = None
    created_at: Optional[datetime] = None


class AccionesResponse(BaseModel):
    rows: List[Accion]

from pydantic import BaseModel
from typing import List, Literal

class BulkEstadoRequest(BaseModel):
    ids: List[str]
    estado: Literal["RESUELTA", "DESCARTADA"]
