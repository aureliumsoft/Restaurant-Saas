export type DiningTableShape = 'CIRCLE' | 'SQUARE' | 'RECTANGLE';

export type FloorTable = {
  id: string;
  name: string;
  shape: DiningTableShape;
  gridRow: number;
  gridCol: number;
  gridRowSpan: number;
  gridColSpan: number;
  sortOrder: number;
  /** True when the table exists in DB (not a local draft id). */
  persisted: boolean;
  occupied?: boolean;
};

export type FloorSize = {
  tableFloorRows: number;
  tableFloorCols: number;
};

export const DEFAULT_FLOOR_SIZE: FloorSize = {
  tableFloorRows: 4,
  tableFloorCols: 4,
};

export function newDraftTableId() {
  return `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function spansForShape(shape: DiningTableShape): {
  gridRowSpan: number;
  gridColSpan: number;
} {
  if (shape === 'RECTANGLE') return { gridRowSpan: 1, gridColSpan: 2 };
  return { gridRowSpan: 1, gridColSpan: 1 };
}

export function cellKey(row: number, col: number) {
  return `${row}:${col}`;
}

/** Map of every grid cell covered by a table (for collision / rendering). */
export function buildOccupancyMap(tables: FloorTable[]) {
  const map = new Map<string, FloorTable>();
  for (const table of tables) {
    for (let r = 0; r < table.gridRowSpan; r++) {
      for (let c = 0; c < table.gridColSpan; c++) {
        map.set(cellKey(table.gridRow + r, table.gridCol + c), table);
      }
    }
  }
  return map;
}

export function canPlaceTable(
  tables: FloorTable[],
  candidate: Pick<
    FloorTable,
    'id' | 'gridRow' | 'gridCol' | 'gridRowSpan' | 'gridColSpan'
  >,
  floor: FloorSize
): boolean {
  if (
    candidate.gridRow < 0 ||
    candidate.gridCol < 0 ||
    candidate.gridRow + candidate.gridRowSpan > floor.tableFloorRows ||
    candidate.gridCol + candidate.gridColSpan > floor.tableFloorCols
  ) {
    return false;
  }
  const others = tables.filter((t) => t.id !== candidate.id);
  const map = buildOccupancyMap(others);
  for (let r = 0; r < candidate.gridRowSpan; r++) {
    for (let c = 0; c < candidate.gridColSpan; c++) {
      if (map.has(cellKey(candidate.gridRow + r, candidate.gridCol + c))) {
        return false;
      }
    }
  }
  return true;
}

export function findEmptyCell(
  tables: FloorTable[],
  floor: FloorSize,
  shape: DiningTableShape
): { gridRow: number; gridCol: number } | null {
  const spans = spansForShape(shape);
  for (let row = 0; row < floor.tableFloorRows; row++) {
    for (let col = 0; col < floor.tableFloorCols; col++) {
      if (
        canPlaceTable(
          tables,
          {
            id: '__probe__',
            gridRow: row,
            gridCol: col,
            ...spans,
          },
          floor
        )
      ) {
        return { gridRow: row, gridCol: col };
      }
    }
  }
  return null;
}

/** Drop fully empty rows/cols and compact remaining tables into a tight grid. */
export function compactEmptyFloor(
  tables: FloorTable[],
  _floor?: FloorSize
): { tables: FloorTable[]; floor: FloorSize } {
  if (tables.length === 0) {
    return {
      tables: [],
      floor: { tableFloorRows: 1, tableFloorCols: 1 },
    };
  }

  const usedRows = new Set<number>();
  const usedCols = new Set<number>();
  for (const table of tables) {
    for (let r = 0; r < table.gridRowSpan; r++) {
      usedRows.add(table.gridRow + r);
    }
    for (let c = 0; c < table.gridColSpan; c++) {
      usedCols.add(table.gridCol + c);
    }
  }

  const sortedRows = [...usedRows].sort((a, b) => a - b);
  const sortedCols = [...usedCols].sort((a, b) => a - b);
  const rowMap = new Map(sortedRows.map((row, index) => [row, index]));
  const colMap = new Map(sortedCols.map((col, index) => [col, index]));

  const nextTables = tables.map((table) => ({
    ...table,
    gridRow: rowMap.get(table.gridRow) ?? table.gridRow,
    gridCol: colMap.get(table.gridCol) ?? table.gridCol,
  }));

  return {
    tables: nextTables,
    floor: {
      tableFloorRows: Math.max(sortedRows.length, 1),
      tableFloorCols: Math.max(sortedCols.length, 1),
    },
  };
}
