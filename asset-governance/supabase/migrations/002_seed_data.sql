-- ============================================================
-- Migration 002 — Seed data
-- Static config tables + initial Gold snapshot (Jun 2026)
-- ============================================================

-- ── cfg_bronze_sources ────────────────────────────────────────
insert into cfg_bronze_sources (name, source_type, sheet_name, last_load_date, status, records_count, missing_serial, missing_date) values
  ('Equipos Asignados',   'Excel sheet', 'Equipos Asignados',                 '2026-06-17', 'ok',      48, 0,  0 ),
  ('Equipos Disponibles', 'Excel sheet', 'Equipos disponibles',               '2026-06-17', 'ok',      12, 0,  0 ),
  ('Por Recuperar',       'Excel sheet', 'Equ. Por RecuperarDefectuosoObs',    '2026-06-17', 'ok',      30, 0,  5 ),
  ('Ingresos',            'Excel sheet', 'Ingresos - Equipos Asignado - 2',    '2026-06-17', 'warning', 31, 14, 6 ),
  ('Salidas',             'Excel sheet', 'Salidas',                            '2026-06-17', 'warning', 29, 15, 10),
  ('Compras 2026',        'Excel sheet', 'Compras 2026',                       '2026-06-17', 'ok',      12, 0,  0 ),
  ('Monitores',           'Excel sheet', 'Monitores - AsignadosDisponible',    '2026-06-17', 'ok',      6,  0,  0 );

-- ── cfg_silver_rules ──────────────────────────────────────────
insert into cfg_silver_rules (field_name, function_name, description) values
  ('serial',    'normalize_serial()',   'Strip, uppercase, remove spaces. Ej: "c02h35s0q05f " → "C02H35S0Q05F"'),
  ('cpu',       'normalize_cpu()',      'Mapea variantes a familia estándar. Ej: "M5 " → "Apple M5"'),
  ('estado',    'normalize_estado()',   'Unifica casing y variantes. Ej: "asignado" → "Asignado"'),
  ('cliente',   'normalize_cliente()',  'Mapeo de alias a nombre canónico. Ej: "banco de chile" → "Banco de Chile"'),
  ('modelo',    'normalize_modelo()',   'Estandariza casing MacBook. Ej: "macbook pro" → "MacBook Pro"'),
  ('marca',     'normalize_marca()',    'Strip y title case de marca del equipo'),
  ('bat_cond',  'normalize_bateria()',  'Texto a float 0.0–1.0. Ej: "Nornal" → corregido → 0.83');

-- ── cfg_gold_marts ────────────────────────────────────────────
insert into cfg_gold_marts (id, name, description, status, source_desc, business_value, record_count, last_updated) values
  ('fact_asset_snapshot',        'fact_asset_snapshot',        'Fotografía mensual del parque. Habilita análisis de tendencias históricas y series de tiempo.',              'operational', 'dim_asset (Silver)',                     'Responder: ¿Cómo era el parque hace 3 meses? ¿Qué cambió?',                                                     90, '2026-06-17'),
  ('gold_financiero',            'gold_financiero',            'Valorización del parque por CPU, cliente y antigüedad. Modelo de depreciación lineal 5 años.',               'partial',     'dim_asset + CPU price table',            'Presupuesto de renovación y seguros de activos. Precios actualmente estimados.',                                 90, '2026-06-17'),
  ('gold_park_quality',          'gold_park_quality',          'Score de calidad del inventario 0-100. 5 componentes ponderados con tendencia histórica.',                    'operational', 'dim_asset (Silver)',                     'Medir salud global del inventario. Score actual: 88.5/100.',                                                     4,  '2026-06-17'),
  ('gold_risk',                  'gold_risk_v2',               'Asset Risk Score 0-100 con clasificación BAJO/MEDIO/ALTO/CRÍTICO. Incluye bonus de movimientos.',             'operational', 'dim_asset + fact_movements',             'Identificar equipos con riesgo operacional. 9 equipos CRÍTICO detectados.',                                      90, '2026-06-17'),
  ('gold_forecast',              'gold_forecast_v2',           'Forecast de renovación 6/12 meses con reglas de negocio. Proyección de crecimiento del parque.',             'operational', 'dim_asset + fact_movements + gold_risk', 'Presupuesto renovación 12m: $97.4K. Parque proyectado Jun 2027: 102 equipos.',                                   90, '2026-06-17'),
  ('gold_movimientos_metricas',  'gold_movimientos_metricas',  'Métricas de rotación, asignación, recuperación y cadenas de eventos por activo.',                            'operational', 'fact_movements',                         'Rotación real: 4.2 ingresos/mes vs 3.2 salidas/mes. Crecimiento neto: +1.0/mes.',                               139, '2026-06-17'),
  ('gold_gobierno_datos',        'gold_gobierno_datos',        'Calidad de movimientos, DG Score, gaps por hoja, registros a corregir, checklist mensual.',                  'operational', 'fact_movements + gold_movimientos_calidad','DG Score: 49.1/100 (Nivel 2). 68 registros con campos incompletos identificados.',                               139, '2026-06-17');

-- ── cfg_checklist_steps ───────────────────────────────────────
insert into cfg_checklist_steps (phase, step_code, task, description, responsible, time_estimate, success_criteria, sort_order) values
  ('PREPARACION',  'P1', 'Completar movimientos del mes',       'Ingresos, salidas, compras y bajas con serial, fecha y gestor.',               'Gestor IT',      '30 min', '0 colaboradores sin registro completo',                  1),
  ('PREPARACION',  'P2', 'Completar riesgo_percibido_it',       'Evaluar BAJO/MEDIO/ALTO/CRÍTICO en cada movimiento del mes.',                  'Gestor IT',      '15 min', '100% de movimientos con riesgo registrado',               2),
  ('PREPARACION',  'P3', 'Verificar seriales faltantes',        'Revisar reporte Registros a Corregir antes de cargar.',                        'Gestor IT',      '20 min', '0 movimientos recientes sin serial',                      3),
  ('PREPARACION',  'P4', 'Verificar fechas faltantes',          'Asegurar fechas reales en todos los ingresos y salidas.',                      'Gestor IT',      '10 min', '0 movimientos del mes sin fecha',                         4),
  ('CARGA',        'C1', 'Subir archivo Excel al pipeline',      'Cargar 2brains_YYYYMM.xlsx. Pipeline genera trazabilidad automáticamente.',    'Gestor Datos',   '5 min',  'Pipeline OK · bronze_batch_id generado',                  5),
  ('CARGA',        'C2', 'Verificar conteo Bronze',              'Filas Bronze >= mes anterior en todas las hojas.',                             'Gestor Datos',   '5 min',  'Sin hojas con conteo menor al mes anterior',              6),
  ('TRANSFORMACION','T1','Ejecutar pipeline Silver',             'Normalización dim_asset y fact_movements. UPSERT sin conflictos.',            'Gestor Datos',   '10 min', '0 errores · movement_ids únicos',                         7),
  ('TRANSFORMACION','T2','Revisar gold_movimientos_calidad',     'Quality Score >= 65. Si baja >5 pts, investigar antes de continuar.',         'IT + Datos',     '10 min', 'Quality Score >= 65/100',                                 8),
  ('GOLD',         'G1', 'Generar snapshot mensual',             'fact_asset_snapshot con snapshot_type=monthly.',                               'Gestor Datos',   '5 min',  'Snapshot insertado · 83+ registros con serial',           9),
  ('GOLD',         'G2', 'Recalcular marts Gold',                'financiero, quality, risk_v2, forecast_v2, movimientos_metricas.',             'Gestor Datos',   '15 min', 'Todos los marts actualizados del día',                    10),
  ('VALIDACION',   'V1', 'Revisar Park Quality Score',           'Score no debe bajar más de 3 puntos vs mes anterior.',                         'Gestor Datos',   '5 min',  'Score >= score_anterior - 3',                             11),
  ('VALIDACION',   'V2', 'Revisar equipos CRÍTICO en risk_v2',  'Cada CRÍTICO debe tener plan de acción activo.',                              'Gestor IT',      '10 min', 'Todos los CRÍTICO con estado != Pendiente',               12),
  ('VALIDACION',   'V3', 'Revisar forecast de renovación',       'Si costo renovación inmediata > $30K, alertar a dirección.',                  'Gestor Datos',   '5 min',  'Forecast revisado · Alerta si > threshold',               13),
  ('PUBLICACION',  'PB1','Publicar Gold a dashboard',            'Invalidar caché API. Verificar snapshot_date correcto.',                      'Gestor Datos',   '5 min',  'Dashboard refleja datos del día',                         14),
  ('PUBLICACION',  'PB2','Enviar resumen ejecutivo mensual',     '5 KPIs: parque total, Quality Score, CRÍTICO count, renovación 12m, dep.',   'Gestor Datos',   '10 min', 'Resumen enviado antes del día 5 del mes',                 15);

-- ── cfg_operation_rules ───────────────────────────────────────
insert into cfg_operation_rules (movement_type, icon, when_to_record, required_fields, deadline, common_error) values
  ('ingreso',     '📥', 'Al confirmar onboarding y entregar equipo físicamente',                  'serial · fecha · empleado · cliente · gestor IT',         '24h tras entrega',         'Registrar ingreso al contrato sin registrar entrega del equipo'),
  ('salida',      '📤', 'Al confirmar salida del colaborador, con o sin equipo devuelto',         'empleado · fecha · serial (si recuperó) · estado',         'El mismo día de la salida','Esperar recuperar el equipo antes de registrar la salida'),
  ('recuperacion','🔄', 'Cuando el equipo debe recuperarse y sigue con el colaborador',           'serial · empleado · fecha inicio · gestor IT',            'Al iniciar gestión',        'Marcar Por Recuperar sin fecha ni responsable'),
  ('baja',        '🗑', 'Al confirmar equipo defectuoso o fuera de uso definitivo',              'serial · fecha · motivo · riesgo_percibido_it · gestor IT','Al momento de decisión',   'Mantener defectuosos en inventario sin fecha de baja'),
  ('compra',      '🛒', 'Al recibir el equipo nuevo del proveedor (no al hacer el pedido)',       'serial · modelo · fecha · precio factura · CPU · RAM',    'El día de recepción',       'Registrar sin precio real de factura o sin serial'),
  ('asignacion',  '👤', 'Al asignar equipo disponible a un colaborador (nuevo o reasignación)',   'serial · empleado · cliente · fecha · gestor IT',          'El mismo día de entrega',   'Confundir ingreso de colaborador con asignación de equipo');

-- ── cfg_template_fields ───────────────────────────────────────
insert into cfg_template_fields (field_name, required, input_type, valid_values, description, is_ml_target, sort_order) values
  ('tipo_movimiento',       true,  'dropdown', 'ingreso | salida | compra | asignacion | recuperacion | baja', 'Tipo de evento a registrar',           false, 1),
  ('fecha_movimiento',      true,  'fecha',    'DD/MM/AAAA — fecha real, no estimada',                         'Fecha exacta del evento',              false, 2),
  ('serial_equipo',         true,  'texto',    'Etiqueta en base del equipo (ej: C02H35S0Q05F)',               'Número de serie del equipo físico',    false, 3),
  ('empleado_nombre',       true,  'texto',    'Nombre y apellido completos',                                  'Tal como aparece en el contrato',      false, 4),
  ('cliente_proyecto',      false, 'texto',    'Bupa / Latam / Banco de Chile / etc.',                         'Cliente o proyecto vinculado',         false, 5),
  ('gestor_it_responsable', true,  'texto',    'Daniel Vargas | Beatriz Herrera',                              'Gestor IT que gestiona el movimiento', false, 6),
  ('riesgo_percibido_it',   true,  'dropdown', 'BAJO | MEDIO | ALTO | CRÍTICO',                               'BASE DEL ML SUPERVISADO DIC 2026',     true,  7),
  ('estado_resultante',     false, 'dropdown', 'Asignado | Disponible | Por Recuperar | Defectuoso | De Baja', 'Estado del equipo tras el evento',     false, 8);

-- ── Gold — initial snapshot Jun 2026 ─────────────────────────
insert into gold_governance_summary (
  snapshot_date, quality_score, quality_score_real, dg_score,
  dg_level, dg_level_label, total_movements, real_movements,
  inferred_movements, records_to_fix, main_gap, secondary_gap
) values (
  '2026-06-17', 61.4, 68.2, 49.1,
  2, 'Controlado', 139, 72,
  67, 68,
  'gestor_it_responsable (15.8% completitud)',
  'riesgo_percibido_it (0% completitud — bloquea ML Dic 2026)'
);

-- ── Gold — completeness KPIs Jun 2026 ────────────────────────
insert into gold_completeness_kpis (snapshot_date, field_name, field_label, pct_complete, count_ok, count_total, semaphore, note, is_strategic) values
  ('2026-06-17', 'serial',               'Serial equipo',        79.1, 110, 139, 'yellow', 'La mayoría de activos son identificables. Completar los 29 faltantes, principalmente en Salidas.',                     false),
  ('2026-06-17', 'fecha',                'Fecha movimiento',     66.9,  93, 139, 'orange', '33% sin fecha invalida el análisis de series de tiempo y el ML de Forecast.',                                           false),
  ('2026-06-17', 'cliente',              'Cliente / Proyecto',   53.2,  74, 139, 'orange', 'Solo la mitad con cliente asignado. Bloquea análisis financiero por cliente.',                                          false),
  ('2026-06-17', 'empleado',             'Empleado',             87.8, 122, 139, 'yellow', 'Alta cobertura. Los 17 faltantes son bajas sin empleado asignado (esperado).',                                          false),
  ('2026-06-17', 'gestor',               'Gestor IT',            15.8,  22, 139, 'red',    'Gap CRÍTICO. Sin gestor no hay auditoría IT posible. Corregir en próxima carga.',                                       false),
  ('2026-06-17', 'riesgo_percibido_it',  'Riesgo percibido IT',   0.0,   0, 139, 'red',    'BLOQUEA el ML supervisado. Cada evaluación completada es un registro de entrenamiento para Dic 2026.',                 true);

-- ── Gold — gaps by source Jun 2026 ───────────────────────────
insert into gold_gaps_by_source (snapshot_date, source_name, source_short, total_records, missing_serial, missing_date, missing_client, missing_manager, is_inferred, pct_serial, pct_date, priority, action_text) values
  ('2026-06-17', 'Salidas',                         'Salidas',        29, 15, 10, 25, 22, false, 48.3, 65.5, 'CRÍTICA', 'Exigir serial y fecha en proceso de offboarding'),
  ('2026-06-17', 'Ingresos',                         'Ingresos',       31, 14,  6,  0, 16, false, 54.8, 80.6, 'ALTA',   'Completar serial en entrega física del equipo'),
  ('2026-06-17', 'Compras 2026',                     'Compras 2026',   12,  0,  0, 12, 12, false,100.0,100.0, 'BAJA',   'Sin gaps de serial/fecha — modelo a replicar'),
  ('2026-06-17', 'Equipos Asignados (inferido)',      'Asignados',      37,  0,  0,  3, 37, true, 100.0,100.0, 'BAJA',   'Mejorar captura de fecha en asignación'),
  ('2026-06-17', 'Por Recuperar (inferido)',           'Por Recuperar',   5,  0,  5,  3,  5, true, 100.0,  0.0, 'BAJA',   'Registrar fecha inicio recuperación'),
  ('2026-06-17', 'Bajas / dim_asset (inferido)',       'Bajas',          25,  0, 25, 22, 25, true, 100.0,  0.0, 'BAJA',   'Registrar fecha de baja definitiva');

-- ── Gold — records to fix Jun 2026 ───────────────────────────
insert into gold_records_to_fix (snapshot_date, movement_id, tipo, employee, serial, fecha, client, manager, source, issue_count, issues) values
  ('2026-06-17', 'd7f55b5e8877', 'salida',  'Pamela González',     null,             null,          null,  null,             'Salidas',  4, '{sin_serial,sin_fecha,sin_cliente,sin_gestor}'),
  ('2026-06-17', '1abc26d0737b', 'salida',  'Victor Antúnez',      null,             null,          null,  null,             'Salidas',  4, '{sin_serial,sin_fecha,sin_cliente,sin_gestor}'),
  ('2026-06-17', '8f733d48c2eb', 'salida',  'David Muñoz',         null,             null,          null,  null,             'Salidas',  4, '{sin_serial,sin_fecha,sin_cliente,sin_gestor}'),
  ('2026-06-17', 'ab23e2cefcc1', 'salida',  'Erick Baeza Roa',     null,             null,          null,  null,             'Salidas',  4, '{sin_serial,sin_fecha,sin_cliente,sin_gestor}'),
  ('2026-06-17', '79653af90c70', 'salida',  'Pablo Jara',          null,             null,          null,  'Beatriz Herrera','Salidas',  3, '{sin_serial,sin_fecha,sin_cliente}'),
  ('2026-06-17', 'ca34f12b8801', 'salida',  'Camila Rojas Vera',   null,             null,          null,  'Beatriz Herrera','Salidas',  3, '{sin_serial,sin_fecha,sin_cliente}'),
  ('2026-06-17', 'fe09a7c33d21', 'salida',  'Rodrigo Méndez',      null,             null,          'Alv', null,             'Salidas',  3, '{sin_serial,sin_fecha,sin_gestor}'),
  ('2026-06-17', 'b81e44d7c990', 'salida',  'Ana Valeria Torres',  null,             null,          null,  'Beatriz Herrera','Salidas',  3, '{sin_serial,sin_fecha,sin_cliente}'),
  ('2026-06-17', '22a76f918b3e', 'salida',  'Fernanda Soto',       null,             null,          'Alv', null,             'Salidas',  3, '{sin_serial,sin_fecha,sin_gestor}'),
  ('2026-06-17', '44c12aa66701', 'salida',  'Luis Sánchez',        null,             '2026-03-31',  null,  null,             'Salidas',  3, '{sin_serial,sin_cliente,sin_gestor}'),
  ('2026-06-17', '99ee12b4cc01', 'salida',  'Valentina Pérez',     null,             '2026-04-30',  'BCI', null,             'Salidas',  2, '{sin_serial,sin_gestor}'),
  ('2026-06-17', 'da44f1200bca', 'salida',  'Constanza Fuentes',   null,             '2026-05-09',  null,  'Daniel Vargas',  'Salidas',  2, '{sin_serial,sin_cliente}'),
  ('2026-06-17', 'f3399c8a1102', 'ingreso', 'Andrés Vera',         null,             '2026-04-01',  'Alv', null,             'Ingresos', 2, '{sin_serial,sin_gestor}'),
  ('2026-06-17', 'e221c7f00d3b', 'ingreso', 'Sofía Contreras',     null,             '2026-04-01',  'Alv', null,             'Ingresos', 2, '{sin_serial,sin_gestor}'),
  ('2026-06-17', 'a10b2f6c99de', 'ingreso', 'Felipe Espinoza',     null,             '2026-04-01',  'Alv', null,             'Ingresos', 2, '{sin_serial,sin_gestor}'),
  ('2026-06-17', 'b99d3e12c401', 'ingreso', 'Carolina Bravo',      null,             '2026-02-03',  'Latam', null,           'Ingresos', 2, '{sin_serial,sin_gestor}'),
  ('2026-06-17', 'c11e4f7d8801', 'ingreso', 'Matías Morales',      null,             '2026-03-10',  'Banco de Chile', null,  'Ingresos', 2, '{sin_serial,sin_gestor}'),
  ('2026-06-17', 'd33a1b9c5501', 'salida',  'Carlos Herrera',      'C02H35S0Q05F',   '2026-04-30',  null,  null,             'Salidas',  2, '{sin_cliente,sin_gestor}'),
  ('2026-06-17', 'e44b2c0d6601', 'salida',  'Daniela Silva',       'WLKQ4CT24L',     '2026-03-25',  null,  null,             'Salidas',  2, '{sin_cliente,sin_gestor}'),
  ('2026-06-17', 'f55c3d1e7701', 'ingreso', 'Roberto Castro',      null,             '2026-04-01',  'Alv', null,             'Ingresos', 2, '{sin_serial,sin_gestor}');

-- ── Gold — quality trend ──────────────────────────────────────
insert into gold_quality_trend (snapshot_date, park_quality, dg_score, total_assets, is_simulated) values
  ('2025-09-01', 85.2, null, 60, true),
  ('2025-12-01', 87.1, null, 70, true),
  ('2026-03-01', 89.0, null, 83, true),
  ('2026-06-17', 88.5, 49.1, 90, false);

-- ── Gold — quality components ─────────────────────────────────
insert into gold_quality_components (snapshot_date, component, weight, score, contribution) values
  ('2026-06-17', 'Calidad de datos',  0.30, 94.4, 28.3),
  ('2026-06-17', 'Integridad serial', 0.25, 92.2, 23.1),
  ('2026-06-17', 'Salud del parque',  0.20, 83.3, 16.7),
  ('2026-06-17', 'Riesgo renovación', 0.15, 100.0, 15.0),
  ('2026-06-17', 'Cobertura cliente', 0.10, 54.4,  5.4);
