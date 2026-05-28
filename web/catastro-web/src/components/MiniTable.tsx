import { getStatusClassName, shouldRenderStatusBadge } from "@/lib/statusStyles";

type MiniTableProps = {
  headers: string[];
  rows: Array<Array<string | number>>;
};

export default function MiniTable({ headers, rows }: MiniTableProps) {
  const normalizedRows = rows.map((row) =>
    headers.map((_, index) => {
      const value = row[index];
      if (value === null || value === undefined) return "—";
      return String(value);
    }),
  );

  return (
    <div className="catastro-table-shell overflow-x-auto rounded-2xl">
      <table className="min-w-full text-sm">
        <thead className="catastro-table-head text-left">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-4 py-3 font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {normalizedRows.length > 0 ? (
            normalizedRows.map((row, index) => (
              <tr
                key={`${row.join("::")}-${index}`}
                className="catastro-row"
              >
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-4 py-3 align-top">
                    {shouldRenderStatusBadge(headers[cellIndex], cell) ? (
                      <span className={getStatusClassName(cell)}>{cell}</span>
                    ) : (
                      cell
                    )}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr className="catastro-row">
              <td colSpan={headers.length} className="px-4 py-4 text-sm text-[var(--cat-text-muted)]">
                Sin datos visibles.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
