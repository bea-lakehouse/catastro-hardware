#!/usr/bin/env bash
set -euo pipefail

# cron usa un entorno minimo; fija PATH incluyendo libpq (psql)
export PATH="/usr/local/opt/libpq/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

ROOT="/Users/bea/Desktop/Catastro"
LOG_DIR="$ROOT/logs"
TS="$(date +%Y%m%d-%H%M%S)"
LOG_FILE="$LOG_DIR/daily_refresh_${TS}.log"

mkdir -p "$LOG_DIR"
cd "$ROOT"

echo "== Daily refresh (after 18:00) ==" | tee "$LOG_FILE"
date | tee -a "$LOG_FILE"

# activar venv si existe
if [[ -f "$ROOT/.venv/bin/activate" ]]; then
  # shellcheck disable=SC1091
  source "$ROOT/.venv/bin/activate"
fi

########################################
# 1) Refresh MTR
########################################
echo
echo "== [1/6] Refresh MTR ==" | tee -a "$LOG_FILE"
python3 scripts/refresh_mtr.py 2>&1 | tee -a "$LOG_FILE"

########################################
# 2) dbt run
########################################
echo
echo "== [2/6] dbt run ==" | tee -a "$LOG_FILE"
cd "$ROOT/dbt_catastro"
dbt run 2>&1 | tee -a "$LOG_FILE"

########################################
# 3) dbt test COMPLETO
########################################
echo
echo "== [3/6] dbt test (ALL) ==" | tee -a "$LOG_FILE"
dbt test 2>&1 | tee -a "$LOG_FILE"

########################################
# 4) ML refresh v2
########################################
echo
echo "== [4/6] ML refresh v2 ==" | tee -a "$LOG_FILE"
curl -sS -X POST http://localhost:8000/ml/v2/score | tee -a "$LOG_FILE"
########################################
# 4.5) Sync analytics from vw_scores_v2_latest
########################################
echo
echo "== [4.5/6] Sync analytics ML from vw_scores_v2_latest ==" | tee -a "$LOG_FILE"
PGPASSWORD="${PGPASSWORD:-}" psql -h localhost -p 5432 -U bea -d ti_ops <<'SQL' | tee -a "$LOG_FILE"
WITH src AS (
  SELECT
    v.entity_id::text AS equipo_id,
    v.score::double precision AS score,
    COALESCE(v.risk_level, 'DESCONOCIDO')::text AS nivel_riesgo,
    COALESCE(
      v.explanations_json #>> '{motivo_principal}',
      v.explanations_json #>> '{main_reason}',
      v.explanations_json #>> '{top_reason}',
      v.explanations_json #>> '{reason}',
      v.alert_code,
      'N/A'
    )::text AS motivo_principal,
    CASE
      WHEN jsonb_typeof(v.explanations_json->'drivers') = 'array'
        THEN ARRAY(SELECT jsonb_array_elements_text(v.explanations_json->'drivers'))
      WHEN jsonb_typeof(v.explanations_json->'top_drivers') = 'array'
        THEN ARRAY(SELECT jsonb_array_elements_text(v.explanations_json->'top_drivers'))
      ELSE NULL::text[]
    END AS drivers,
    COALESCE((v.explanations_json->>'fallback_applied')::boolean, false) AS fallback_applied,
    'ml_v2'::text AS model_version,
    COALESCE(v.created_at, now()) AS model_run_at,
    NULL::timestamptz AS trained_at
  FROM ml.vw_scores_v2_latest v
)
INSERT INTO analytics.ml_scores_latest (
  equipo_id, score, nivel_riesgo, motivo_principal, drivers,
  fallback_applied, model_version, model_run_at, trained_at
)
SELECT
  equipo_id, score, nivel_riesgo, motivo_principal, drivers,
  fallback_applied, model_version, model_run_at, trained_at
FROM src
ON CONFLICT (equipo_id) DO UPDATE
SET
  score            = EXCLUDED.score,
  nivel_riesgo     = EXCLUDED.nivel_riesgo,
  motivo_principal = EXCLUDED.motivo_principal,
  drivers          = EXCLUDED.drivers,
  fallback_applied = EXCLUDED.fallback_applied,
  model_version    = EXCLUDED.model_version,
  model_run_at     = EXCLUDED.model_run_at,
  trained_at       = EXCLUDED.trained_at;

INSERT INTO analytics.ml_scores_history (
  equipo_id, score, nivel_riesgo, motivo_principal, drivers,
  fallback_applied, model_version, model_run_at, trained_at
)
SELECT
  s.equipo_id, s.score, s.nivel_riesgo, s.motivo_principal, s.drivers,
  s.fallback_applied, s.model_version, s.model_run_at, s.trained_at
FROM analytics.ml_scores_latest s
WHERE NOT EXISTS (
  SELECT 1
  FROM analytics.ml_scores_history h
  WHERE h.equipo_id = s.equipo_id
    AND h.model_run_at = s.model_run_at
    AND h.model_version = s.model_version
);
SQL

########################################
# 5) Sanity checks mínimos
########################################
echo
echo "== [5/6] Sanity checks ==" | tee -a "$LOG_FILE"
PGPASSWORD="${PGPASSWORD:-}" psql -h localhost -p 5432 -U bea -d ti_ops <<'SQL' | tee -a "$LOG_FILE"
SELECT 'mart_historia_eventos_futuros' AS k,
       count(*) AS v
FROM analytics.mart_historia_eventos
WHERE fecha_evento > current_date + 1;

SELECT 'ml_scores_latest_count' AS k,
       count(*) AS v
FROM analytics.ml_scores_latest;

SELECT 'vw_scores_v2_latest_count' AS k,
       count(*) AS v
FROM ml.vw_scores_v2_latest;
SQL

########################################
# 6) ML Metrics automáticas (drift + % fallback)
########################################
echo
echo "== [6/6] ML metrics (drift + fallback) ==" | tee -a "$LOG_FILE"
PGPASSWORD="${PGPASSWORD:-}" psql -h localhost -p 5432 -U bea -d ti_ops <<'SQL' | tee -a "$LOG_FILE"
-- =========================
-- ML Metrics (Auto)
-- Output: k (text), v (text)
-- =========================

SELECT 'ml_latest_empty'::text AS k,
       (CASE WHEN COUNT(*)=0 THEN 'YES' ELSE 'NO' END)::text AS v
FROM analytics.ml_scores_latest;

SELECT 'ml_fallback_pct_latest'::text AS k,
       COALESCE(ROUND(100.0 * AVG(CASE WHEN fallback_applied THEN 1 ELSE 0 END)::numeric, 2)::text, '') AS v
FROM analytics.ml_scores_latest;

SELECT 'ml_nivel_riesgo_latest'::text AS k,
       (nivel_riesgo || ':' || count(*)::text)::text AS v
FROM analytics.ml_scores_latest
GROUP BY 1, nivel_riesgo
ORDER BY count(*) DESC;

WITH runs AS (
  SELECT DISTINCT model_run_at
  FROM analytics.ml_scores_history
  ORDER BY model_run_at DESC
  LIMIT 2
),
run_count AS (
  SELECT COUNT(*) AS c FROM runs
),
last_two AS (
  SELECT h.*
  FROM analytics.ml_scores_history h
  JOIN runs r ON r.model_run_at = h.model_run_at
),
agg AS (
  SELECT
    model_run_at,
    AVG(score) AS avg_score,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY score) AS p95_score,
    AVG(CASE WHEN fallback_applied THEN 1 ELSE 0 END) AS fallback_ratio
  FROM last_two
  GROUP BY 1
),
ordered AS (
  SELECT *, ROW_NUMBER() OVER (ORDER BY model_run_at DESC) AS rn
  FROM agg
)
SELECT 'ml_drift_status'::text AS k,
       CASE WHEN (SELECT c FROM run_count) < 2 THEN 'INSUFFICIENT_HISTORY' ELSE 'OK' END::text AS v
UNION ALL
SELECT 'ml_last_run_at'::text AS k,
       COALESCE((SELECT model_run_at::text FROM ordered WHERE rn=1), '') AS v
UNION ALL
SELECT 'ml_prev_run_at'::text AS k,
       COALESCE((SELECT model_run_at::text FROM ordered WHERE rn=2), '') AS v
UNION ALL
SELECT 'ml_drift_avg_score'::text AS k,
       COALESCE(
         CASE WHEN (SELECT c FROM run_count) < 2 THEN NULL
              ELSE ROUND(((SELECT avg_score FROM ordered WHERE rn=1)
                        - (SELECT avg_score FROM ordered WHERE rn=2))::numeric, 4)::text
         END
       , '') AS v
UNION ALL
SELECT 'ml_drift_p95_score'::text AS k,
       COALESCE(
         CASE WHEN (SELECT c FROM run_count) < 2 THEN NULL
              ELSE ROUND(((SELECT p95_score FROM ordered WHERE rn=1)
                        - (SELECT p95_score FROM ordered WHERE rn=2))::numeric, 4)::text
         END
       , '') AS v
UNION ALL
SELECT 'ml_drift_fallback_pp'::text AS k,
       COALESCE(
         CASE WHEN (SELECT c FROM run_count) < 2 THEN NULL
              ELSE ROUND((100.0*((SELECT fallback_ratio FROM ordered WHERE rn=1)
                        - (SELECT fallback_ratio FROM ordered WHERE rn=2)))::numeric, 3)::text
         END
       , '') AS v;
SQL

echo
echo "DONE ✅ $(date)" | tee -a "$LOG_FILE"
