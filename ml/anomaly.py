# ml/anomaly.py
from __future__ import annotations

import numpy as np
import pandas as pd

from sklearn.ensemble import IsolationForest
from sklearn.neighbors import LocalOutlierFactor
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.neural_network import MLPRegressor


# ------------------------------
# Configuración de features base
# ------------------------------
FEATURE_COLS = [
    "movimientos_totales",
    "movimientos_12m",
    "dias_rango_hist",
    "clientes_distintos",
    "personas_distintas",
    "dias_desde_compra",
]

NOMBRES_HUMANOS = {
    "movimientos_totales": "movimientos totales",
    "movimientos_12m": "movimientos últimos 12 meses",
    "dias_rango_hist": "días de rango histórico",
    "clientes_distintos": "clientes distintos",
    "personas_distintas": "personas distintas",
    "dias_desde_compra": "días desde la compra",
}


# ------------------------------
# Helpers de scoring (copias)
# ------------------------------
def _score_renovacion(texto: str | None) -> int:
    if not isinstance(texto, str):
        return 0
    if "Renovación vencida" in texto:
        return 4
    if "Próximo a vencer" in texto:
        return 3
    if "Sin fecha de compra" in texto:
        return 1
    return 0


def _score_historial(texto: str | None) -> int:
    if not isinstance(texto, str):
        return 0
    if texto.startswith("🔴"):
        return 4
    if texto.startswith("🟠"):
        return 3
    if texto.startswith("🔶"):
        return 2
    if texto.startswith("🟡"):
        return 1
    return 0


def _score_asignacion(texto: str | None) -> int:
    if not isinstance(texto, str):
        return 0
    if "Sin asignación" in texto:
        return 3
    return 0


def _score_ml_v1(texto: str | None) -> int:
    """Tu alerta_ml actual (IQR ligero)."""
    if not isinstance(texto, str):
        return 0
    if texto.startswith("🔴"):
        return 3
    return 0


def _score_ml_v2(texto: str | None) -> int:
    """Score fuerte para ML v2."""
    if not isinstance(texto, str):
        return 0
    if "Anómalo" in texto:
        return 8
    if "Sospechoso" in texto:
        return 4
    if "Ligeramente inusual" in texto:
        return 2
    return 0


def _nivel_riesgo(score_total: int) -> str:
    if score_total >= 14:
        return "Alta"
    if score_total >= 6:
        return "Media"
    return "Baja"


# ------------------------------
# Helpers internos ML
# ------------------------------
def _prepare_features(df_alertas: pd.DataFrame) -> pd.DataFrame:
    df = df_alertas.copy()

    # asegurar columnas numéricas
    for c in FEATURE_COLS:
        if c not in df.columns:
            df[c] = 0

    df_feats = df[FEATURE_COLS].copy()

    for c in FEATURE_COLS:
        df_feats[c] = pd.to_numeric(df_feats[c], errors="coerce").fillna(0)

    return df_feats


def _autoencoder_outliers(X_scaled: np.ndarray, contamination: float = 0.05):
    """
    Autoencoder muy simple con MLPRegressor como aproximación.
    Devuelve: labels (0 normal, 1 outlier), errores, umbral.
    """
    if X_scaled.shape[0] < 10:
        # muy pocos datos: mejor no entrenar nada
        labels = np.zeros(X_scaled.shape[0], dtype=int)
        errors = np.zeros_like(labels, dtype=float)
        return labels, errors, 0.0

    ae = MLPRegressor(
        hidden_layer_sizes=(4, 2, 4),
        activation="relu",
        max_iter=500,
        random_state=42,
    )
    ae.fit(X_scaled, X_scaled)
    X_pred = ae.predict(X_scaled)
    errors = np.mean((X_scaled - X_pred) ** 2, axis=1)

    thr = np.quantile(errors, 1 - contamination)
    labels = (errors > thr).astype(int)
    return labels, errors, float(thr)


def _explicar_anomalia_row(row_feats: pd.Series, means: pd.Series, stds: pd.Series) -> str:
    # z-score por columna
    z = (row_feats - means) / stds.replace(0, np.nan)
    z = z.replace([np.inf, -np.inf], np.nan)
    z_abs = z.abs().sort_values(ascending=False)

    top = z_abs.head(3)
    partes = []
    for col, val in top.items():
        if pd.isna(val) or val < 1.0:
            continue
        nombre = NOMBRES_HUMANOS.get(col, col)
        signo = "por encima" if z[col] > 0 else "por debajo"
        partes.append(f"{nombre} muy {signo} de lo normal (~{val:.1f}σ)")

    if not partes:
        return "Patrón algo distinto al promedio, pero sin una variable dominante."

    return "; ".join(partes)


# ------------------------------
# API PRINCIPAL PARA EL DASHBOARD
# ------------------------------
def aplicar_ml_v2(df_alertas: pd.DataFrame) -> pd.DataFrame:
    """
    Aplica:
      - Isolation Forest
      - LOF
      - Autoencoder simple
    y añade columnas:
      ml_iso, ml_lof, ml_ae, ml_score_v2,
      alerta_ml_v2, alerta_ml_v3, motivo_ml_v2,
      score_ml_v2, riesgo_total (recalculado), nivel_riesgo (recalculado)
    """
    if df_alertas is None or df_alertas.empty:
        return df_alertas

    df = df_alertas.copy()

    # --------- 1) Construir matriz de features ---------
    df_feats = _prepare_features(df)
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(df_feats)

    n_rows = X_scaled.shape[0]
    if n_rows < 5:
        # muy pocos equipos → rellenamos columnas y salimos
        df["ml_iso"] = 0
        df["ml_lof"] = 0
        df["ml_ae"] = 0
        df["ml_score_v2"] = 0
        df["alerta_ml_v2"] = "🟢 Normal"
        df["alerta_ml_v3"] = "🟢 Normal"
        df["motivo_ml_v2"] = ""
    else:
        # --------- 2) Isolation Forest ---------
        iso = IsolationForest(
            n_estimators=200,
            contamination=0.05,
            random_state=42,
        )
        iso_labels = iso.fit_predict(X_scaled)  # -1 = outlier

        # --------- 3) LOF ---------
        lof = LocalOutlierFactor(
            n_neighbors=min(20, n_rows - 1),
            contamination=0.05,
        )
        lof_labels = lof.fit_predict(X_scaled)  # -1 = outlier

        # --------- 4) Autoencoder (approx) ---------
        ae_labels, errors, thr = _autoencoder_outliers(X_scaled, contamination=0.05)

        df["ml_iso"] = (iso_labels == -1).astype(int)
        df["ml_lof"] = (lof_labels == -1).astype(int)
        df["ml_ae"] = ae_labels.astype(int)
        df["ml_err"] = errors
        df["ml_thr"] = thr

        # Score combinado
        df["ml_score_v2"] = df["ml_iso"] + df["ml_lof"] + df["ml_ae"] * 2

        # Etiqueta ML v2
        def _etq_v2(score):
            if score >= 4:
                return "🔴 Anómalo (ML v2)"
            if score >= 2:
                return "🟠 Sospechoso (ML v2)"
            if score >= 1:
                return "🟡 Ligeramente inusual (ML v2)"
            return "🟢 Normal"

        df["alerta_ml_v2"] = df["ml_score_v2"].apply(_etq_v2)

        # Etiqueta ML v3 (solo autoencoder)
        df["alerta_ml_v3"] = df["ml_ae"].apply(
            lambda v: "🔴 Anómalo (ML v3)" if v == 1 else "🟢 Normal"
        )

        # --------- 5) Explicaciones por equipo ---------
        means = df_feats.mean()
        stds = df_feats.std()

        motivos = []
        for i in range(len(df)):
            if df.loc[i, "ml_score_v2"] >= 2:  # solo explicar anomalías/sospechosos
                motivos.append(
                    _explicar_anomalia_row(df_feats.iloc[i], means, stds)
                )
            else:
                motivos.append("")
        df["motivo_ml_v2"] = motivos

    # --------- 6) Recalcular riesgo_total + nivel_riesgo ---------
    # Si no existen los scores base, los calculamos.
    if "score_renovacion" not in df.columns and "alerta_renovacion" in df.columns:
        df["score_renovacion"] = df["alerta_renovacion"].apply(_score_renovacion)

    if "score_historial" not in df.columns and "alerta_historial" in df.columns:
        df["score_historial"] = df["alerta_historial"].apply(_score_historial)

    if "score_asignacion" not in df.columns and "alerta_asignacion" in df.columns:
        df["score_asignacion"] = df["alerta_asignacion"].apply(_score_asignacion)

    if "score_ml" not in df.columns and "alerta_ml" in df.columns:
        df["score_ml"] = df["alerta_ml"].apply(_score_ml_v1)

    # Nuevo score fuerte para ML v2
    df["score_ml_v2"] = df["alerta_ml_v2"].apply(_score_ml_v2)

    # riesgo_total y nivel_riesgo finales
    for col in [
        "score_renovacion",
        "score_historial",
        "score_asignacion",
        "score_ml",
        "score_ml_v2",
    ]:
        if col not in df.columns:
            df[col] = 0

    df["riesgo_total"] = (
        df["score_renovacion"]
        + df["score_historial"]
        + df["score_asignacion"]
        + df["score_ml"]
        + df["score_ml_v2"]
    )

    df["nivel_riesgo"] = df["riesgo_total"].apply(_nivel_riesgo)

    return df


def preparar_scatter_ml(df_alertas: pd.DataFrame) -> pd.DataFrame:
    """
    Devuelve un DataFrame con columnas:
      x, y, alerta_ml_v2, nivel_riesgo, persona_actual, cliente_actual, sku
    para graficar un scatter 2D (PCA) en Altair.
    """
    if df_alertas is None or df_alertas.empty:
        return pd.DataFrame()

    df = df_alertas.copy()
    df_feats = _prepare_features(df)

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(df_feats)

    pca = PCA(n_components=2, random_state=42)
    coords = pca.fit_transform(X_scaled)

    out = pd.DataFrame(
        {
            "x": coords[:, 0],
            "y": coords[:, 1],
        }
    )

    out["alerta_ml_v2"] = df.get("alerta_ml_v2", "🟢 Normal")
    out["nivel_riesgo"] = df.get("nivel_riesgo", "Baja")
    out["persona_actual"] = df.get("persona_actual", "")
    out["cliente_actual"] = df.get("cliente_actual", "")
    out["sku"] = df.get("sku", "")
    out["riesgo_total"] = pd.to_numeric(
        df.get("riesgo_total", 0), errors="coerce"
    ).fillna(0).astype(int)

    return out
    
