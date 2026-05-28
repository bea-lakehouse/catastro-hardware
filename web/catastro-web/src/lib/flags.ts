export async function isMLv2Enabled(): Promise<boolean> {
  try {
    const res = await fetch("/api/proxy/ml/v2/scores?limit=1", {
      cache: "no-store",
    });
    if (!res.ok) return false;
    const data = await res.json();
    return Array.isArray(data?.rows) && data.rows.length > 0;
  } catch {
    return false;
  }
}
