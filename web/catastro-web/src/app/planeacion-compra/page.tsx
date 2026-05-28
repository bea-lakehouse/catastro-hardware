import PlaneacionCompraView from "./PlaneacionCompraView";

export default async function PlaneacionCompraPage({
  searchParams,
}: {
  searchParams?: Promise<{ mes?: string; empresa?: string }>;
}) {
  return <PlaneacionCompraView searchParams={searchParams} mode="executive" />;
}
