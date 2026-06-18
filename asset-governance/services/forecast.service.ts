/**
 * services/forecast.service.ts
 * Feature-flag pattern.
 * Sprint 3: replace mock with live gold_forecast_v2 queries.
 */

// Types only — no DB queries yet (gold_forecast_v2 table not in Sprint 2 schema)
export interface RenovationLane {
  period:  string;
  count:   number;
  cost:    number;
  color:   string;
  bg:      string;
  desc:    string;
}

export interface GrowthPoint {
  mes: string;
  eq:  number;
}

export interface MlMilestone {
  phase:  string;
  date:   string;
  label:  string;
  desc:   string;
  status: 'done' | 'next' | 'planned' | 'future';
}

export interface ForecastPayload {
  renovation:   RenovationLane[];
  summary: {
    budget12mUSD:           number;
    projectedPark6m:        number;
    projectedPark12m:       number;
    netGrowthPerMonth:      number;
    ingressPerMonth:        number;
    outgressPerMonth:       number;
  };
  growth:       GrowthPoint[];
  mlRoadmap:    MlMilestone[];
  snapshotDate: string;
}

export async function getForecast(): Promise<ForecastPayload> {
  // Sprint 3: query gold_forecast_v2, gold_renovation_plan, etc.
  return {
    renovation: [
      { period:'Renovación inmediata', count:25, cost:50920, color:'text-red-600',     bg:'bg-red-50 border-red-200',     desc:'Defectuosos + De Baja' },
      { period:'Próximos 6 meses',     count:1,  cost:2060,  color:'text-amber-600',   bg:'bg-amber-50 border-amber-200', desc:'Intel ≥5a · score ≥70' },
      { period:'Próximos 12 meses',    count:22, cost:44450, color:'text-blue-600',    bg:'bg-blue-50 border-blue-200',   desc:'Score renovación ≥50' },
      { period:'Sin urgencia',         count:42, cost:0,     color:'text-emerald-600', bg:'bg-emerald-50 border-emerald-200', desc:'Score <30' },
    ],
    summary: {
      budget12mUSD:       97430,
      projectedPark6m:    101,
      projectedPark12m:   104,
      netGrowthPerMonth:  1.0,
      ingressPerMonth:    4.17,
      outgressPerMonth:   3.17,
    },
    growth: [
      { mes:'Jul',    eq:92  }, { mes:'Ago',    eq:94  }, { mes:'Sep',    eq:95  },
      { mes:'Oct',    eq:98  }, { mes:'Nov',    eq:100 }, { mes:'Dic 26', eq:101 },
      { mes:'Ene',    eq:102 }, { mes:'Feb',    eq:102 }, { mes:'Mar',    eq:103 },
      { mes:'Abr',    eq:103 }, { mes:'May',    eq:103 }, { mes:'Jun 27', eq:104 },
    ],
    mlRoadmap: [
      { phase:'Ahora',        date:'Jun 2026',      label:'Reglas de negocio', desc:'Score 0-100: antigüedad(30%) + estado(25%) + ciclos(20%) + CPU(15%) + RAM(10%)',                                               status:'done'    },
      { phase:'Sprint 5–7',   date:'Jul–Sep 2026',  label:'Infraestructura',   desc:'Supabase operativo · Pipeline automatizado · API REST · 3+ snapshots reales',                                                  status:'next'    },
      { phase:'Oct–Nov 2026', date:'Oct–Nov 2026',  label:'Preparación ML',    desc:'6 snapshots reales + riesgo_percibido_it completo + fact_movements fechas ≥90%',                                              status:'planned' },
      { phase:'Dic 2026',     date:'Dic 2026',      label:'Asset Risk ML v1',  desc:'XGBoost + SHAP · gold_risk_ml mart · A/B vs reglas · validación temporal',                                                    status:'planned' },
      { phase:'Mar 2027',     date:'Mar 2027',      label:'Forecast ML v1',    desc:'Prophet por cliente · forecast 3/6/12m · alertas de compra proactivas',                                                        status:'future'  },
    ],
    snapshotDate: '2026-06-17',
  };
}
