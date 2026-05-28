import PlaneacionCompraView from "../PlaneacionCompraView";

export default async function PlaneacionCompraOperativaPage({
  searchParams,
}: {
  searchParams?: Promise<{ mes?: string; empresa?: string }>;
}) {
  return <PlaneacionCompraView searchParams={searchParams} mode="operativa" />;
}
