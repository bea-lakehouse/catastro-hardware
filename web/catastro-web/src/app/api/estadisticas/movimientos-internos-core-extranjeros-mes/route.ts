export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { NextResponse } from "next/server";

type SheetCell = string | number | boolean | Date | null | undefined;
type SheetRow = SheetCell[];

// ===== helpers robustos =====
function normStr(v: unknown): string | null {
  const t = String(v ?? "").trim();
  return t === "" ? null : t;
}
function normLower(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}
function pct(n: number, d: number): number {
  if (!d) return 0;
  return Math.round((n * 1000) / d) / 10; // 1 decimal
}
function normKey(v: unknown): string {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}
function colIndex(headers: unknown[], candidates: string[]): number {
  const H = headers.map((h) => normKey(h));
  const C = candidates.map((c) => normKey(c));
  for (const c of C) {
    const i = H.indexOf(c);
    if (i >= 0) return i;
  }
  for (let i = 0; i < H.length; i++) {
    for (const c of C) {
      if (H[i].includes(c)) return i;
    }
  }
  return -1;
}
function cellAt(row: unknown[], idx: number): unknown {
  return idx >= 0 ? row[idx] : undefined;
}
function parseAnyDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date && !isNaN(v.getTime())) return v;

  // Excel serial (fallback)
  if (typeof v === "number" && isFinite(v)) {
    // XLSX.SSF.parse_date_code puede fallar en algunos bundles; probamos simple
    const d = XLSX.SSF?.parse_date_code?.(v);
    if (d && d.y && d.m && d.d) {
      const dt = new Date(Date.UTC(d.y, d.m - 1, d.d));
      if (!isNaN(dt.getTime())) return dt;
    }
  }

  const s = String(v ?? "").trim();
  if (!s) return null;

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const dt = new Date(s.slice(0, 10) + "T00:00:00Z");
    return isNaN(dt.getTime()) ? null : dt;
  }

  // DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
    const dd = Number(s.slice(0, 2));
    const mm = Number(s.slice(3, 5));
    const yy = Number(s.slice(6, 10));
    const dt = new Date(Date.UTC(yy, mm - 1, dd));
    return isNaN(dt.getTime()) ? null : dt;
  }

  // fallback Date.parse
  const t = Date.parse(s);
  return isNaN(t) ? null : new Date(t);
}
  function osFamilia(osRaw: unknown, marcaRaw: unknown, modeloRaw: unknown): "Mac" | "Win" | null {
    const os = normKey(osRaw);
    const marca = normKey(marcaRaw);
    const modelo = normKey(modeloRaw);

    // Windows directo
    if (os.includes("windows")) return "Win";

    // Hints mac por OS (incluye tus codenames)
    const macHints = [
      "mac", "os x", "macos",
      "sonoma", "sequoia", "tahoe", "ventura", "monterey", "big sur", "catalina", "mojave",
      "high sierra", "sierra", "el capitan", "yosemite", "mavericks"
    ];
    if (macHints.some((h) => os.includes(h))) return "Mac";

    // fallback por marca/modelo
    if (marca === "apple") return "Mac";
    if (modelo.includes("macbook") || modelo.includes("imac") || modelo.includes("mac mini")) return "Mac";

    if (["dell","lenovo","hp","hewlett packard","huawei","acer","asus","msi"].includes(marca)) return "Win";
    return null;
  }

function currentMonthStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

// ============================

export async function GET(request: Request) {
  try {
    const u = new URL(request.url);
    const mes = (u.searchParams.get("mes") ?? currentMonthStart()).slice(0, 10);
    const limit = Math.max(1, Math.min(5000, Number(u.searchParams.get("limit") ?? "500")));
    const debug = (u.searchParams.get("debug") ?? "") === "1";

    const ym = mes.slice(0, 7);

    const xlsxPath = path.join(process.cwd(), "src", "data", "extranjeros1502.xlsx");
    if (!fs.existsSync(xlsxPath)) {
      return NextResponse.json(
        { error: "MISSING_FILE", message: `No existe: ${xlsxPath}` },
        { status: 500 }
      );
    }

    // Lee con fs -> buffer (más estable en Next/Turbopack que XLSX.readFile(path))
fs.accessSync(xlsxPath, fs.constants.R_OK);
const buf = fs.readFileSync(xlsxPath);
const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];

const aoa: SheetRow[] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });

// Detecta fila de headers (a veces no es la 0)
const headerNeedles = ["sku", "pais", "cliente", "empleado asignado", "marca", "modelo"];
let headerRow = -1;

for (let i = 0; i < Math.min(10, aoa.length); i++) {
  const r = aoa[i];
  if (!Array.isArray(r)) continue;
  const keys = r.map((x) => normKey(x));
  let hits = 0;
  for (const n of headerNeedles) {
    if (keys.some((k) => k === n || k.includes(n))) hits++;
  }
  if (hits >= 2) { // con 2-3 ya es suficiente
    headerRow = i;
    break;
  }
}

const headers: unknown[] = headerRow >= 0 && Array.isArray(aoa[headerRow]) ? aoa[headerRow] : [];
const rows: SheetRow[] =
  headerRow >= 0
    ? aoa.slice(headerRow + 1).filter((r) => Array.isArray(r))
    : Array.isArray(aoa)
      ? aoa.slice(1).filter((r) => Array.isArray(r))
      : [];

    // columnas (robusto)
    const COL_SKU = colIndex(headers, ["SKU"]);
    const COL_MARCA = colIndex(headers, ["Marca"]);
    const COL_MODELO = colIndex(headers, ["Modelo"]);
      const COL_OS = colIndex(headers, ["Sistema Operativo", "Sistema operativo", "SO", "OS"]);
      const COL_CONDICION = colIndex(headers, ["Condición", "Condicion", "Estado"]);
    const COL_PAIS = colIndex(headers, ["Pais", "País"]);
    const COL_CIUDAD = colIndex(headers, ["Ciudad", "Ciudad/Comuna", "Ciudad / Comuna"]);
    const COL_TIPO_COLAB = colIndex(headers, ["Tipo de colaborador", "Tipo colaborador", "Colaborador"]);
    const COL_CLIENTE = colIndex(headers, ["Cliente"]);
    const COL_PERSONA = colIndex(headers, ["Empleado Asignado", "Empleado asignado", "Asignado", "Empleado"]);
    const COL_PERFIL = colIndex(headers, ["Perfil"]);
    const COL_COMENTARIO = colIndex(headers, ["Comentario", "Comentarios"]);
    const COL_FECHA_ASIG = colIndex(headers, ["Fecha Asignación", "Fecha de Asignación", "Fecha asignacion"]);
    const COL_FECHA_MANT = colIndex(headers, ["Fecha Mantenimiento", "Fecha de Mantenimiento"]);
    const COL_FECHA_COMPRA = colIndex(headers, ["Fecha Compra", "Fecha de Compra"]);

    
if (debug) {
  const cols = {
    headerRow,
    COL_SKU, COL_MARCA, COL_MODELO, COL_PAIS, COL_CIUDAD, COL_TIPO_COLAB, COL_CLIENTE, COL_PERSONA, COL_PERFIL, COL_COMENTARIO,
    COL_FECHA_ASIG, COL_FECHA_MANT, COL_FECHA_COMPRA,
  };
  return NextResponse.json({
    ok: true,
    cwd: process.cwd(),
    xlsxPath,
    sheetName,
    headerRow,
    headers,
    cols,
    sampleRow0: rows?.[0] ?? null,
  });
}

const cleaned = rows
      .map((r) => {
        const f_asig = cellAt(r, COL_FECHA_ASIG);
        const f_mant = cellAt(r, COL_FECHA_MANT);
        const f_comp = cellAt(r, COL_FECHA_COMPRA);

        const mov_date = parseAnyDate(f_asig) ?? parseAnyDate(f_mant) ?? parseAnyDate(f_comp);
        const _mov_date = mov_date ? mov_date.toISOString().slice(0, 10) : null;
        const _ym = _mov_date ? _mov_date.slice(0, 7) : null;

        return {
          _mov_date,
          _ym,
          sku: normStr(cellAt(r, COL_SKU)),
          marca: normStr(cellAt(r, COL_MARCA)),
          modelo: normStr(cellAt(r, COL_MODELO)),
            os_raw: normStr(cellAt(r, COL_OS)),
            condicion: normStr(cellAt(r, COL_CONDICION)),
          os_familia: osFamilia(normStr(cellAt(r, COL_OS)), normStr(cellAt(r, COL_MARCA)), normStr(cellAt(r, COL_MODELO))),
            pais: normStr(cellAt(r, COL_PAIS)),
          ciudad: normStr(cellAt(r, COL_CIUDAD)),
          tipo_colaborador: normStr(cellAt(r, COL_TIPO_COLAB)),
          cliente: normStr(cellAt(r, COL_CLIENTE)),
          persona: normStr(cellAt(r, COL_PERSONA)),
          perfil: normStr(cellAt(r, COL_PERFIL)),
          comentario: normStr(cellAt(r, COL_COMENTARIO)),
        };
      })
      .filter((x) => x._ym === ym)
      .filter((x) => (x.pais ?? "").toString().trim().toLowerCase() !== "chile");

    const total = cleaned.length;

      const core = cleaned.filter((x) => normLower(x.tipo_colaborador) === "core").length;
      const staffing = cleaned.filter((x) => normLower(x.tipo_colaborador) === "staffing").length;

      const nuevo = cleaned.filter((x) => normLower(x.condicion) === "nuevo").length;
      const usado = cleaned.filter((x) => normLower(x.condicion) === "usado").length;
      const sin_condicion = total - nuevo - usado;

      // breakdown país (conteos + %)
      const pais_counts: Record<string, number> = {};
      for (const x of cleaned) {
        const k = String(x.pais ?? "—").trim() || "—";
        pais_counts[k] = (pais_counts[k] ?? 0) + 1;
      }
      const pais_breakdown = Object.entries(pais_counts)
        .map(([pais, n]) => ({ pais, n, pct: pct(n, total) }))
        .sort((a, b) => b.n - a.n || String(a.pais).localeCompare(String(b.pais)));

      const kpis = {
        total,
        core,
        staffing,
        // condición
        nuevo,
        usado,
        sin_condicion,
        pct_nuevo: pct(nuevo, total),
        pct_usado: pct(usado, total),
        pct_sin_condicion: pct(sin_condicion, total),
        // país
        pais_breakdown,
      };

    const out = cleaned
      .slice(0, limit)
      .sort((a, b) => String(a._mov_date ?? "").localeCompare(String(b._mov_date ?? "")))
      .map((x) => ({
        fecha: x._mov_date,
        id_equipo: x.sku ? `SKU-${String(x.sku).replace(/^SKU-?/i, "")}` : null,
        tipo: "mov_interno_extranjero",
        persona: x.persona,
        cliente_destino: x.cliente,
        ubicacion_destino: x.ciudad,
        pais: x.pais,
        tipo_colaborador: x.tipo_colaborador,
        marca: x.marca,
        modelo: x.modelo,
          os_raw: x.os_raw ?? null,
          os_familia: x.os_familia ?? osFamilia(x.os_raw, x.marca, x.modelo),
          condicion: x.condicion ?? null,
        comentario: x.comentario,
      }));

    return NextResponse.json({
      mes,
      source: "excel:src/data/extranjeros1502.xlsx",
      ...(debug
        ? {
            headers,
            cols: {
              COL_SKU,
              COL_MARCA,
              COL_MODELO,
              COL_PAIS,
              COL_CIUDAD,
              COL_TIPO_COLAB,
              COL_CLIENTE,
              COL_PERSONA,
              COL_PERFIL,
              COL_COMENTARIO,
              COL_FECHA_ASIG,
              COL_FECHA_MANT,
              COL_FECHA_COMPRA,
            },
          }
        : {}),
      kpis,
      rows: out,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        error: "EXCEPTION",
        message: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? String(e.stack ?? "") : "",
      },
      { status: 500 }
    );
  }
}
