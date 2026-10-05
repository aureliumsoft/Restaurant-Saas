'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';

import { cn } from '@/lib/utils';
import type {
  DiningTableShape,
  FloorSize,
  FloorTable,
} from '@/lib/dining-table-floor';
import {
  buildOccupancyMap,
  canPlaceTable,
  cellKey,
} from '@/lib/dining-table-floor';

type Props = {
  mode: 'editor' | 'picker';
  floor: FloorSize;
  tables: FloorTable[];
  selectedId?: string | null;
  onSelectCell?: (row: number, col: number) => void;
  onSelectTable?: (table: FloorTable) => void;
  /** Move a table to a new grid origin (editor only). */
  onMoveTable?: (tableId: string, row: number, col: number) => void;
  /** POS may select occupied tables; kiosk keeps them blocked. */
  allowOccupiedSelect?: boolean;
  className?: string;
};

const DND_MIME = 'application/x-foodluk-table-id';

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
  onMoveTable,
  allowOccupiedSelect = false,
  className,
}: Props) {
  const occupancy = buildOccupancyMap(tables);
  const rendered = new Set<string>();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const cols = Math.max(1, floor.tableFloorCols);
  const rows = Math.max(1, floor.tableFloorRows);
  const editorDnd = mode === 'editor' && Boolean(onMoveTable);

  // Viewport shows ~3.5 cells; extra rows/cols peek half-in and scroll into view.
  const cellRem = 7;
  const gapRem = 0.75;
  const padRem = 1;
  const visibleCells = 4.5;
  const viewportRem =
    padRem * 2 + visibleCells * cellRem + Math.floor(visibleCells) * gapRem;

  function draggingTable() {
    if (!draggingId) return null;
    return tables.find((t) => t.id === draggingId) ?? null;
  }

  function canDropAt(row: number, col: number) {
    const table = draggingTable();
    if (!table) return false;
    if (table.gridRow === row && table.gridCol === col) return false;
    return canPlaceTable(
      tables,
      {
        id: table.id,
        gridRow: row,
        gridCol: col,
        gridRowSpan: table.gridRowSpan,
        gridColSpan: table.gridColSpan,
      },
      floor
    );
  }

  return (
    <div className={cn('w-full flex flex-col', className)}>
      <div
        className={cn(
          "flex-1 min-h-0 overflow-auto overscroll-contain rounded-2xl [scrollbar-gutter:stable] [&::-webkit-scrollbar]:h-2.5 [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent",
          mode === 'editor' && "border border-border bg-muted/20"
        )}
        style={{
          width: '100%',
          maxWidth: mode === 'picker' ? '100%' : `${viewportRem}rem`,
          height: mode === 'picker' ? undefined : `${viewportRem}rem`,
          scrollbarWidth: 'thin',
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
              const isDragging = draggingId === table.id;
              return (
                <button
                  key={table.id}
                  type="button"
                  disabled={blocked}
                  draggable={editorDnd && !blocked}
                  onDragStart={(e) => {
                    if (!editorDnd) return;
                    e.dataTransfer.setData(DND_MIME, table.id);
                    e.dataTransfer.setData('text/plain', table.id);
                    e.dataTransfer.effectAllowed = 'move';
                    setDraggingId(table.id);
                    onSelectTable?.(table);
                  }}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setDropTarget(null);
                  }}
                  onClick={() => onSelectTable?.(table)}
                  className={cn(
                    'relative flex h-full w-full flex-col items-center justify-center p-2 shadow-sm transition',
                    shapeClass(table.shape),
                    statusRing(table, selected, mode, allowOccupiedSelect),
                    table.occupied ? 'bg-red-500' : 'bg-emerald-500',
                    selected ? 'bg-primary' : null,
                    blocked
                      ? 'cursor-not-allowed opacity-80'
                      : editorDnd
                        ? 'cursor-grab active:cursor-grabbing hover:brightness-[0.98]'
                        : 'hover:brightness-[0.98]',
                    isDragging && 'opacity-50',



                  )}
                  style={{
                    gridRow: `${table.gridRow + 1} / span ${table.gridRowSpan}`,
                    gridColumn: `${table.gridCol + 1} / span ${table.gridColSpan}`,
                  }}
                  title={
                    table.occupied
                      ? `${table.name} · Occupied`
                      : editorDnd
                        ? `${table.name} · Drag to move`
                        : `${table.name} · Available`
                  }
                >
                  <span className="mt-1.5 line-clamp-1 max-w-full px-1 text-center text-xl font-bold text-white">
                    {table.name}
                  </span>
                  {table.occupied ? (
                    <span className="mt-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase text-red-600">
                      Occupied
                    </span>
                  ) : null}
                </button>
              );
            }

            const isDropHover = dropTarget === key;
            const dropOk = draggingId ? canDropAt(row, col) : false;

            if (mode === 'picker') {
              return null; // The CSS grid handles empty space automatically, no need to render empty cells.
            }

            return (
              <button
                key={key}
                type="button"
                disabled={true}
                onClick={undefined}
                onDragOver={(e) => {
                  if (!editorDnd || !draggingId) return;
                  if (!canDropAt(row, col)) {
                    e.dataTransfer.dropEffect = 'none';
                    setDropTarget(null);
                    return;
                  }
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  setDropTarget(key);
                }}
                onDragLeave={() => {
                  setDropTarget((prev) => (prev === key ? null : prev));
                }}
                onDrop={(e) => {
                  if (!editorDnd) return;
                  e.preventDefault();
                  const id =
                    e.dataTransfer.getData(DND_MIME) ||
                    e.dataTransfer.getData('text/plain');
                  setDraggingId(null);
                  setDropTarget(null);
                  if (!id || !canDropAt(row, col)) return;
                  onMoveTable?.(id, row, col);
                }}
                className={cn(
                  'flex h-full w-full items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/20 bg-background/60 transition cursor-default',
                  mode === 'editor'
                    ? 'hover:border-primary/50'
                    : '',
                  isDropHover &&
                  dropOk &&
                  'border-primary bg-primary/15 text-primary ring-2 ring-primary/40'
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
                {/* Plus icon removed as requested */}
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
        {editorDnd ? (
          <span className="text-muted-foreground/80">
            Drag a table onto an empty cell to move it
          </span>
        ) : null}
      </div>
    </div>
  );
}
