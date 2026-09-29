'use client';

import { Plus } from 'lucide-react';

import { cn } from '@/lib/utils';
import type {
  DiningTableShape,
  FloorSize,
  FloorTable,
} from '@/lib/dining-table-floor';
import { buildOccupancyMap, cellKey } from '@/lib/dining-table-floor';

type Props = {
  mode: 'editor' | 'picker';
  floor: FloorSize;
  tables: FloorTable[];
  selectedId?: string | null;
  onSelectCell?: (row: number, col: number) => void;
  onSelectTable?: (table: FloorTable) => void;
  /** POS may select occupied tables; kiosk keeps them blocked. */
  allowOccupiedSelect?: boolean;
  className?: string;
};

function shapeClass(shape: DiningTableShape) {
  if (shape === 'CIRCLE') return 'rounded-full';
  if (shape === 'RECTANGLE') return 'rounded-2xl';
  return 'rounded-xl';
}

function statusRing(
  table: FloorTable,
  selected: boolean,
  mode: Props['mode'],
  allowOccupiedSelect: boolean
) {
  if (selected) {
    return 'ring-2 ring-primary border-primary bg-primary/5';
  }
  if (mode === 'picker' && table.occupied && !allowOccupiedSelect) {
    return 'ring-2 ring-red-400 border-red-300 bg-red-50';
  }
  if (table.occupied) {
    return 'border-red-200 bg-red-50/80';
  }
  return 'border-emerald-200 bg-emerald-50/60';
}

export function TableFloorPlan({
  mode,
  floor,
  tables,
  selectedId = null,
  onSelectCell,
  onSelectTable,
  allowOccupiedSelect = false,
  className,
}: Props) {
  const occupancy = buildOccupancyMap(tables);
  const rendered = new Set<string>();

  const cols = Math.max(1, floor.tableFloorCols);
  const rows = Math.max(1, floor.tableFloorRows);

  // Viewport shows ~3.5 cells; extra rows/cols peek half-in and scroll into view.
  const cellRem = 7;
  const gapRem = 0.75;
  const padRem = 1;
  const visibleCells = 4.5;
  const viewportRem =
    padRem * 2 + visibleCells * cellRem + Math.floor(visibleCells) * gapRem;

  return (
    <div className={cn('w-full', className)}>
      <div
        className="overflow-scroll overscroll-contain rounded-2xl border border-border bg-muted/20 [scrollbar-gutter:stable] [&::-webkit-scrollbar]:h-2.5 [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent"
        style={{
          width: '100%',
          maxWidth: `${viewportRem}rem`,
          height: `${viewportRem}rem`,
          scrollbarWidth: 'thin',
          // Force classic always-visible scrollbars where the browser supports it.
          scrollbarGutter: 'stable',
        }}
      >
        <div
          className="grid p-4"
          style={{
            gap: `${gapRem}rem`,
            gridTemplateColumns: `repeat(${cols}, ${cellRem}rem)`,
            gridTemplateRows: `repeat(${rows}, ${cellRem}rem)`,
            width: `${padRem * 2 + cols * cellRem + Math.max(0, cols - 1) * gapRem}rem`,
            height: `${padRem * 2 + rows * cellRem + Math.max(0, rows - 1) * gapRem}rem`,
          }}
        >
          {Array.from({ length: rows * cols }, (_, index) => {
            const row = Math.floor(index / cols);
            const col = index % cols;
            const key = cellKey(row, col);
            const table = occupancy.get(key);

            if (table) {
              // Spanned cells are covered by the origin button — don't insert
              // auto-flow placeholders or the grid leaves holes.
              if (table.gridRow !== row || table.gridCol !== col) {
                return null;
              }
              if (rendered.has(table.id)) {
                return null;
              }
              rendered.add(table.id);
              const selected = selectedId === table.id;
              const blocked =
                mode === 'picker' &&
                Boolean(table.occupied) &&
                !allowOccupiedSelect;
              return (
                <button
                  key={table.id}
                  type="button"
                  disabled={blocked}
                  onClick={() => onSelectTable?.(table)}
                  className={cn(
                    'relative flex h-full w-full flex-col items-center justify-center border bg-card p-2 shadow-sm transition',
                    shapeClass(table.shape),
                    statusRing(table, selected, mode, allowOccupiedSelect),
                    blocked
                      ? 'cursor-not-allowed opacity-80'
                      : 'hover:brightness-[0.98]'
                  )}
                  style={{
                    gridRow: `${table.gridRow + 1} / span ${table.gridRowSpan}`,
                    gridColumn: `${table.gridCol + 1} / span ${table.gridColSpan}`,
                  }}
                  title={
                    table.occupied
                      ? `${table.name} · Occupied`
                      : `${table.name} · Available`
                  }
                >
                  <span
                    className={cn(
                      'flex h-11 w-11 items-center justify-center text-xs font-bold text-white shadow',
                      shapeClass(table.shape),
                      table.occupied ? 'bg-red-500' : 'bg-emerald-500',
                      selected ? 'bg-primary' : null
                    )}
                  >
                    {table.sortOrder + 1}
                  </span>
                  <span className="mt-1.5 line-clamp-1 max-w-full px-1 text-center text-xs font-medium text-foreground">
                    {table.name}
                  </span>
                  {table.occupied ? (
                    <span className="mt-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-600">
                      Occupied
                    </span>
                  ) : null}
                </button>
              );
            }

            return (
              <button
                key={key}
                type="button"
                disabled={mode === 'picker'}
                onClick={() => onSelectCell?.(row, col)}
                className={cn(
                  'flex h-full w-full items-center justify-center rounded-xl border border-dashed border-border/80 bg-background/60 transition',
                  mode === 'editor'
                    ? 'text-muted-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-primary'
                    : 'cursor-default opacity-60'
                )}
                style={{
                  gridRow: row + 1,
                  gridColumn: col + 1,
                }}
                aria-label={
                  mode === 'editor'
                    ? `Add table at row ${row + 1} column ${col + 1}`
                    : `Empty cell row ${row + 1} column ${col + 1}`
                }
              >
                {mode === 'editor' ? (
                  <Plus className="h-6 w-6" strokeWidth={2} />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          Available
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
          Occupied
        </span>
      </div>
    </div>
  );
}
