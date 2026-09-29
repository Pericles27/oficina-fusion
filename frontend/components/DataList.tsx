'use client';

import type { ReactNode } from 'react';

export interface DataColumn<T> {
  /** Encabezado de columna */
  header: string;
  /** Contenido de la celda */
  cell: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  /** En mobile: mostrar en la fila de título de la tarjeta (arriba, destacado) */
  primary?: boolean;
  /** En mobile: mostrar como badge/valor a la derecha del título */
  trailing?: boolean;
  /** Ocultar en la vista de tarjetas mobile */
  hideOnMobile?: boolean;
}

export interface DataListProps<T> {
  columns: DataColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** Mostrado cuando rows está vacío */
  empty?: ReactNode;
}

/**
 * Tabla en >= md, tarjetas apiladas en mobile.
 * Evita el scroll horizontal y los textos cortados en pantallas chicas.
 */
export function DataList<T>({ columns, rows, rowKey, onRowClick, empty }: DataListProps<T>) {
  if (rows.length === 0 && empty) return <>{empty}</>;

  const primary = columns.find((c) => c.primary) ?? columns[0];
  const trailing = columns.find((c) => c.trailing);
  const rest = columns.filter(
    (c) => c !== primary && c !== trailing && !c.hideOnMobile
  );

  const alignClass = (a?: string) =>
    a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left';

  return (
    <>
      {/* ── Desktop: tabla ── */}
      <div className="hidden md:block card overflow-hidden">
        <div className="table-wrap scrollbar">
          <table className="table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col.header} className={alignClass(col.align)}>
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={onRowClick ? 'cursor-pointer' : undefined}
                >
                  {columns.map((col) => (
                    <td key={col.header} className={alignClass(col.align)}>
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Mobile: tarjetas ── */}
      <div className="md:hidden flex flex-col gap-2.5">
        {rows.map((row) => (
          <div
            key={rowKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={`card p-4 ${onRowClick ? 'cursor-pointer active:scale-[0.985] transition-transform' : ''}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 font-semibold text-[15px]"
                   style={{ color: 'var(--warm-gray-1)' }}>
                {primary.cell(row)}
              </div>
              {trailing && <div className="shrink-0">{trailing.cell(row)}</div>}
            </div>

            {rest.length > 0 && (
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 m-0">
                {rest.map((col) => (
                  <div key={col.header} className="min-w-0">
                    <dt className="label m-0 mb-0.5">{col.header}</dt>
                    <dd className="m-0 text-[13.5px] truncate"
                        style={{ color: 'var(--warm-gray-1)' }}>
                      {col.cell(row)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
