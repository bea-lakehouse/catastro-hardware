const fs = require("fs");
const path = require("path");

const WORKSPACE_ROOT = path.resolve(__dirname, "..", "..");
const DBT_ROOT = path.resolve(__dirname, "..");
const MANIFEST_PATH = path.join(DBT_ROOT, "target", "manifest.json");
const OUTPUT_PATH = path.join(WORKSPACE_ROOT, "docs", "mapa_dbt_catastro.md");

const SOURCE_ORIGIN_OVERRIDES = {
  "source.dbt_catastro.raw.compras_2025_raw":
    "Tabla `analytics.compras_2025_raw` cargada externamente.",
  "source.dbt_catastro.raw.jira_issues":
    "Tabla `raw.jira_issues` sincronizada desde Jira Cloud.",
  "source.dbt_catastro.raw.raw_jira_webhook_events":
    "Tabla `raw.raw_jira_webhook_events` alimentada por el webhook de Jira.",
  "source.dbt_catastro.raw.sync_runs":
    "Tabla `raw.sync_runs` con trazas de sincronizaciones del backend.",
  "source.dbt_catastro.raw.mtr_equipos_asignados_detalle":
    "Tabla `raw.mtr_equipos_asignados_detalle` cargada externamente.",
  "source.dbt_catastro.raw.mtr_equipos_disponibles":
    "Tabla `raw.mtr_equipos_disponibles` cargada externamente.",
  "source.dbt_catastro.raw.mtr_salidas":
    "Tabla `raw.mtr_salidas` cargada externamente.",
  "source.dbt_catastro.raw.mtr_google_sheet_rows":
    "Google Sheets MTR, sincronizado vía `backend/services/google_sheets_sync.py` con rangos `Equipos Asignados`, `Equipos disponibles`, `Ingresos` y `Salidas`.",
  "source.dbt_catastro.analytics.mtr_1202_equipos_asignados_raw":
    "Tabla `analytics.mtr_1202_equipos_asignados_raw` proveniente de una carga histórica desde Excel.",
  "source.dbt_catastro.analytics.mtr_1202_equ_extranjero_raw":
    "Tabla `analytics.mtr_1202_equ_extranjero_raw` proveniente de una carga histórica desde Excel.",
  "source.dbt_catastro.analytics.equipos_backfill":
    "Tabla `analytics.equipos_backfill`, derivada de extracción Excel histórica.",
  "source.dbt_catastro.analytics.equipos_raw":
    "Tabla `analytics.equipos_raw`, derivada de extracción Excel histórica.",
  "source.dbt_catastro.analytics.equipos_enriched":
    "Tabla `analytics.equipos_enriched` persistida fuera de este proyecto.",
  "source.dbt_catastro.analytics.historia_hw_raw":
    "Tabla `analytics.historia_hw_raw` persistida fuera de este proyecto.",
  "source.dbt_catastro.ml.vw_scores_v2_latest":
    "Vista `ml.vw_scores_v2_latest` del pipeline ML."
};

const IMPLICIT_SCHEMA_WHITELIST = new Set(["analytics", "raw", "ml", "public"]);

function readManifest() {
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
}

function layerFromPath(originalFilePath) {
  const match = originalFilePath.match(/^models\/([^/]+)/);
  return match ? match[1] : "other";
}

function collectRootAncestors(nodeId, parentMap, seen = new Set()) {
  if (seen.has(nodeId)) {
    return [];
  }

  seen.add(nodeId);
  const parents = parentMap[nodeId] || [];
  if (!parents.length) {
    return [];
  }

  const roots = [];
  for (const parentId of parents) {
    if (parentId.startsWith("source.") || parentId.startsWith("seed.")) {
      roots.push(parentId);
      continue;
    }

    if (parentId.startsWith("model.")) {
      roots.push(...collectRootAncestors(parentId, parentMap, seen));
    }
  }

  return [...new Set(roots)].sort();
}

function formatSeedOrigin(seedNode) {
  const seedPath = path.join("dbt_catastro", seedNode.original_file_path);

  if (seedNode.name === "reparaciones_raw") {
    return `${seedPath} (generado desde \`dbt_catastro/seeds/Reparados.xlsx\`).`;
  }

  return `${seedPath}.`;
}

function formatSourceOrigin(sourceId, sourceNode) {
  const override = SOURCE_ORIGIN_OVERRIDES[sourceId];
  if (override) {
    return override;
  }

  return `Tabla \`${sourceNode.schema}.${sourceNode.identifier}\` declarada como source dbt.`;
}

function displayDependency(nodeId, manifest) {
  if (nodeId.startsWith("model.")) {
    return `ref:${manifest.nodes[nodeId].name}`;
  }

  if (nodeId.startsWith("seed.")) {
    const seedNode = manifest.nodes[nodeId];
    return `seed:${path.basename(seedNode.original_file_path)}`;
  }

  if (nodeId.startsWith("source.")) {
    const sourceNode = manifest.sources[nodeId];
    return `source:${sourceNode.schema}.${sourceNode.identifier}`;
  }

  return nodeId;
}

function displayRoot(rootId, manifest) {
  if (rootId.startsWith("seed.")) {
    return formatSeedOrigin(manifest.nodes[rootId]);
  }

  if (rootId.startsWith("source.")) {
    return formatSourceOrigin(rootId, manifest.sources[rootId]);
  }

  return rootId;
}

function extractImplicitRelations(sql) {
  const relations = new Set();
  const relationRegexes = [
    /\bfrom\s+([a-zA-Z_][\w]*\.[a-zA-Z_][\w]*)/gi,
    /\bjoin\s+([a-zA-Z_][\w]*\.[a-zA-Z_][\w]*)/gi,
    /adapter\.get_relation\([\s\S]*?schema\s*=\s*'([^']+)'[\s\S]*?identifier\s*=\s*'([^']+)'/g,
    /relation_exists\('([^']+)',\s*'([^']+)'\)/g,
    /column_exists\('([^']+)',\s*'([^']+)'/g
  ];

  for (const regex of relationRegexes) {
    let match;
    while ((match = regex.exec(sql))) {
      let relation;
      if (match.length === 3 && !match[0].startsWith("from") && !match[0].startsWith("join")) {
        relation = `${match[1]}.${match[2]}`;
      } else {
        relation = match[1];
      }

      const [schema] = relation.split(".");
      if (IMPLICIT_SCHEMA_WHITELIST.has(schema)) {
        relations.add(relation);
      }
    }
  }

  return [...relations].sort();
}

function buildModels(manifest) {
  const models = [];

  for (const [nodeId, node] of Object.entries(manifest.nodes)) {
    if (node.resource_type !== "model" || node.package_name !== "dbt_catastro") {
      continue;
    }

    const modelPath = path.join(DBT_ROOT, node.original_file_path);
    const sql = fs.existsSync(modelPath) ? fs.readFileSync(modelPath, "utf8") : "";
    const directParents = manifest.parent_map[nodeId] || [];
    const rootAncestors = collectRootAncestors(nodeId, manifest.parent_map);

    models.push({
      name: node.name,
      layer: layerFromPath(node.original_file_path),
      file: path.join("dbt_catastro", node.original_file_path),
      directParents,
      rootAncestors,
      implicitRelations: extractImplicitRelations(sql)
    });
  }

  return models.sort((a, b) => {
    if (a.layer !== b.layer) {
      return a.layer.localeCompare(b.layer);
    }

    return a.name.localeCompare(b.name);
  });
}

function buildRootUsage(models, manifest) {
  const usage = new Map();

  for (const model of models) {
    for (const parentId of model.directParents) {
      if (!parentId.startsWith("seed.") && !parentId.startsWith("source.")) {
        continue;
      }

      if (!usage.has(parentId)) {
        usage.set(parentId, []);
      }

      usage.get(parentId).push(model.name);
    }
  }

  return [...usage.entries()]
    .map(([rootId, consumers]) => ({
      rootId,
      root: displayRoot(rootId, manifest),
      directConsumers: consumers.sort()
    }))
    .sort((a, b) => a.root.localeCompare(b.root));
}

function mermaidBlock() {
  return [
    "```mermaid",
    "flowchart LR",
    '  GS[\"Google Sheets MTR\"] --> STGGS[\"stg_mtr_google_sheet_*\"]',
    '  RAWMTR[\"raw.mtr_salidas / raw.mtr_*\"] --> STGMTR[\"stg_mtr_*\"]',
    '  JIRA[\"raw.jira_issues + webhook\"] --> STGJIRA[\"stg_jira_*\"]',
    '  EXCEL[\"Excel / seeds CSV\"] --> STGSEED[\"stg_* desde seeds\"]',
    '  STGGS --> INT[\"intermediate\"]',
    '  STGMTR --> INT',
    '  STGJIRA --> INT',
    '  STGSEED --> INT',
    '  INT --> CORE[\"core\"]',
    '  CORE --> MARTS[\"marts\"]',
    "```"
  ].join("\n");
}

function renderSection(title, rows, manifest) {
  const lines = [`## ${title}`, "", "| Modelo | Archivo dbt | Inputs directos | Origen raíz | Relaciones implícitas |", "|---|---|---|---|---|"];

  for (const row of rows) {
    const directInputs = row.directParents.length
      ? row.directParents.map((item) => displayDependency(item, manifest)).join("<br>")
      : "-";

    const rootInputs = row.rootAncestors.length
      ? row.rootAncestors.map((item) => displayRoot(item, manifest)).join("<br>")
      : "-";

    const implicit = row.implicitRelations.length
      ? row.implicitRelations.map((item) => `\`${item}\``).join("<br>")
      : "-";

    lines.push(`| \`${row.name}\` | \`${row.file}\` | ${directInputs} | ${rootInputs} | ${implicit} |`);
  }

  lines.push("");
  return lines.join("\n");
}

function renderReport(manifest, models) {
  const today = new Date().toISOString().slice(0, 10);
  const rootUsage = buildRootUsage(models, manifest);
  const byLayer = {
    staging: models.filter((model) => model.layer === "staging"),
    intermediate: models.filter((model) => model.layer === "intermediate"),
    core: models.filter((model) => model.layer === "core"),
    marts: models.filter((model) => model.layer === "marts")
  };

  const lines = [
    "# Mapa dbt Catastro",
    "",
    `Documento generado el ${today} desde \`dbt_catastro/target/manifest.json\`.`,
    "",
    "## Resumen",
    "",
    `- Modelos dbt detectados: **${models.length}**.`,
    `- Seeds detectados: **${Object.values(manifest.nodes).filter((node) => node.resource_type === "seed" && node.package_name === "dbt_catastro").length}**.`,
    `- Sources detectados: **${Object.keys(manifest.sources).length}**.`,
    "- En la columna `Relaciones implícitas` marco tablas o vistas que el SQL consulta sin `source()`/`ref()` y que por eso no aparecen bien reflejadas en el DAG estándar de dbt.",
    "",
    "## Vista rápida",
    "",
    mermaidBlock(),
    "",
    "## Fuentes raíz y quién las consume directo",
    "",
    "| Fuente raíz | Consumidores directos |",
    "|---|---|"
  ];

  for (const item of rootUsage) {
    lines.push(`| ${item.root} | ${item.directConsumers.map((name) => `\`${name}\``).join(", ")} |`);
  }

  lines.push("");
  lines.push(renderSection("Staging", byLayer.staging, manifest));
  lines.push(renderSection("Intermediate", byLayer.intermediate, manifest));
  lines.push(renderSection("Core", byLayer.core, manifest));
  lines.push(renderSection("Marts", byLayer.marts, manifest));

  return lines.join("\n");
}

function main() {
  const manifest = readManifest();
  const models = buildModels(manifest);
  const report = renderReport(manifest, models);

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, report, "utf8");

  process.stdout.write(`${OUTPUT_PATH}\n`);
}

main();
