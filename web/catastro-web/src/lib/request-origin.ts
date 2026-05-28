import { headers } from "next/headers";

function firstHeaderValue(value: string | null): string | null {
  if (!value) return null;
  return value.split(",")[0]?.trim() || null;
}

export async function getRequestOrigin() {
  const headerStore = await headers();
  const host =
    firstHeaderValue(headerStore.get("x-forwarded-host")) ||
    firstHeaderValue(headerStore.get("host")) ||
    "localhost:3000";
  const forwardedProto = firstHeaderValue(headerStore.get("x-forwarded-proto"));
  const isLocalHost = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host);
  const proto =
    isLocalHost || process.env.NODE_ENV === "development"
      ? "http"
      : forwardedProto || "https";

  return `${proto}://${host}`;
}
