import { redirect } from "next/navigation";

export default async function AliasCompraEquipos({
  searchParams,
}: {
  searchParams?: Promise<{ mes?: string; limit?: string }>;
}) {
  const resolved = (await searchParams) || {};
  const qs = new URLSearchParams();
  if (resolved?.mes) qs.set("mes", resolved.mes);
  if (resolved?.limit) qs.set("limit", resolved.limit);

  const q = qs.toString();
  redirect(`/ml-v2/estadisticas/compras-equipos${q ? `?${q}` : ""}`);
}
