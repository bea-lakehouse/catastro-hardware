#!/usr/bin/env bash
set -euo pipefail

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
  source "$ROOT/.venv/bin/activate"
fi

########################################
# 1) Refresh MTR
########################################
echo
echo "== [1/5] Refresh MTR ==" | tee -a "$LOG_FILE"
python3 scripts/refresh_mtr.py 2>&1 | tee -a "$LOG_FILE"

########################################
# 2) dbt run
########################################
echo
echo "== [2/5] dbt run ==" | tee -a "$LOG_FILE"
cd "$ROOT/dbt_catastro"
dbt run 2>&1 | tee -a "$LOG_FILE"

########################################
# 3) dbt test COMPLETO
########################################
echo
echo "== [3/5] dbt test (ALL) ==" | tee -a "$LOG_FILE"
dbt test 2>&1 | tee -a "$LOG_FILE"

########################################
# 4) ML refresh v2
########################################
echo
echo "== [4/5] ML refresh v2 ==" | tee -a "$LOG_FILE"
curl -sS -X POST http://localhost:8000/ml/v2/score \
  | tee -a "$LOG_FILE"

########################################
# 5) Sanity checks mínimos
########################################
echo
echo "== [5/5] Sanity checks ==" | tee -a "$LOG_FILE"
PGPASSWORD="${PGPASSWORD:-}" psql -h localhost -p 5432 -U bea -d ti_ops <<'SQL' | tee -a "$LOG_FILE"
SELECT 'mart_historia_eventos_futuros' AS k,
       count(*) AS v
FROM analytics.mart_historia_eventos
WHERE fecha_evento > current_date + 1;

SELECT 'ml_scores_latest' AS k,
       count(*) AS v
FROM ml.vw_scores_v2_latest;
SQL

echo
echo "DONE ✅ $(date)" | tee -a "$LOG_FILE"
