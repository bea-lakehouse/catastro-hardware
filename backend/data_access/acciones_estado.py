from sqlalchemy import text

DDL = """
CREATE TABLE IF NOT EXISTS acciones_estado (
  accion_id TEXT PRIMARY KEY,
  estado TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""

def ensure_table(conn):
    conn.execute(text(DDL))

def upsert_estado(conn, accion_id: str, estado: str):
    ensure_table(conn)
    conn.execute(
        text("""
        INSERT INTO acciones_estado (accion_id, estado)
        VALUES (:accion_id, :estado)
        ON CONFLICT (accion_id)
        DO UPDATE SET estado = EXCLUDED.estado, updated_at = now()
        """),
        {"accion_id": accion_id, "estado": estado},
    )

def get_estados(conn) -> dict[str, str]:
    ensure_table(conn)
    rows = conn.execute(text("SELECT accion_id, estado FROM acciones_estado")).fetchall()
    return {r[0]: r[1] for r in rows}
