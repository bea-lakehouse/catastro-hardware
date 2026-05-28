import ActivosTableClient, { type EquipoRow, type ExecutionOverlayRow } from "@/components/activos/ActivosTableClient";
import { apiProxyGet } from "@/lib/api";
import { getRequestOrigin } from "@/lib/request-origin";

type Resp = {
  count?: number;
  items: EquipoRow[];
};

type ExecutionQueueResponse = {
  rows?: ExecutionOverlayRow[];
};

export default async function ActivosLegacyView({
  initialEstado,
  initialJiraBucket,
  initialHasJira = false,
  initialClase,
  jiraBoardCounts = {},
}: {
  initialEstado?: string;
  initialJiraBucket?: string;
  initialHasJira?: boolean;
  initialClase?: string;
  jiraBoardCounts?: Record<string, number>;
}) {
  let data: Resp = { items: [] };
  let executionData: ExecutionQueueResponse = { rows: [] };
  let errorMessage: string | null = null;

  try {
    const origin = await getRequestOrigin();
    const [dataResponse, queue] = await Promise.all([
      apiProxyGet<Resp>("/estadisticas/equipos?limit=400", { origin }),
      apiProxyGet<ExecutionQueueResponse>("/ejecucion/queue?limit=1000", { origin }).catch(() => ({ rows: [] }) as ExecutionQueueResponse),
    ]);
    data = dataResponse;
    executionData = queue;
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "No fue posible cargar la tabla de activos.";
  }

  return (
    <div className="space-y-4">
      {errorMessage ? (
        <div className="rounded-2xl border border-rose-300/60 bg-rose-100/70 p-4 text-sm text-rose-900">
          No se pudo cargar la tabla operativa de activos. Se mantiene la página viva con una vista vacía para no cortar la operación.
          <div className="mt-2 text-rose-800/80">{errorMessage}</div>
        </div>
      ) : null}

      <ActivosTableClient
        items={data.items ?? []}
        initialEstado={initialEstado}
        initialJiraBucket={initialJiraBucket}
        initialHasJira={initialHasJira}
        initialClase={initialClase}
        jiraBoardCounts={jiraBoardCounts}
        executionRows={executionData.rows ?? []}
      />
    </div>
  );
}
