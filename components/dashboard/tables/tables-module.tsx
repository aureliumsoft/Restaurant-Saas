'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Columns3,
  Loader2,
  Pencil,
  Plus,
  QrCode,
  RefreshCcw,
  Rows3,
  Save,
  Trash2,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  DashboardCard,
  DashboardCardContent,
  DashboardCardDescription,
  DashboardCardHeader,
  DashboardCardTitle,
} from '@/components/dashboard/dashboard-card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useBranchContext, withBranchQuery } from '@/hooks/use-branch-context';
import { TableQrDialog } from '@/components/dashboard/tables/table-qr-card';
import { TableFloorPlan } from '@/components/dashboard/tables/table-floor-plan';
import {
  canPlaceTable,
  compactEmptyFloor,
  DEFAULT_FLOOR_SIZE,
  newDraftTableId,
  spansForShape,
  type DiningTableShape,
  type FloorSize,
  type FloorTable,
} from '@/lib/dining-table-floor';

type ApiTable = {
  id: string;
  name: string;
  sortOrder: number;
  shape?: DiningTableShape;
  status?: 'AVAILABLE' | 'RESERVED';
  gridRow?: number;
  gridCol?: number;
  gridRowSpan?: number;
  gridColSpan?: number;
};

type TablesModuleProps = {
  branchId?: string | null;
  branchUrlId?: string | null;
  branchName?: string | null;
};

function mapApiTables(rows: ApiTable[]): FloorTable[] {
  return rows.map((r, index) => ({
    id: r.id,
    name: r.name,
    shape: r.shape ?? 'SQUARE',
    gridRow: r.gridRow ?? Math.floor(index / 4),
    gridCol: r.gridCol ?? index % 4,
    gridRowSpan: r.gridRowSpan ?? 1,
    gridColSpan: r.gridColSpan ?? 1,
    sortOrder: r.sortOrder ?? index,
    persisted: true,
    occupied: r.status === 'RESERVED',
  }));
}

export function TablesModule({
  branchId: branchIdProp,
  branchUrlId: branchUrlIdProp,
  branchName: branchNameProp,
}: TablesModuleProps = {}) {
  const { t } = useTranslation();
  const {
    activeBranchId,
    activeBranchUrlId,
    loading: branchLoading,
    branches,
  } = useBranchContext();
  const scopedBranchId =
    branchIdProp !== undefined ? branchIdProp : activeBranchId;
  const scopedBranchUrlId =
    branchUrlIdProp !== undefined
      ? branchUrlIdProp
      : activeBranchUrlId ??
        branches.find((b) => b.id === scopedBranchId)?.urlId ??
        null;
  const activeBranchName =
    branchNameProp ??
    branches.find((b) => b.id === scopedBranchId)?.name ??
    null;

  const [floor, setFloor] = useState<FloorSize>({ ...DEFAULT_FLOOR_SIZE });
  const [tables, setTables] = useState<FloorTable[]>([]);
  const [baseline, setBaseline] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [placeRow, setPlaceRow] = useState(0);
  const [placeCol, setPlaceCol] = useState(0);
  const [name, setName] = useState('');
  const [shape, setShape] = useState<DiningTableShape>('SQUARE');
  const [deleteTarget, setDeleteTarget] = useState<FloorTable | null>(null);
  const [restaurantSlug, setRestaurantSlug] = useState<string | null>(null);
  const [qrTarget, setQrTarget] = useState<FloorTable | null>(null);

  const dirty = useMemo(() => {
    const snapshot = JSON.stringify({
      floor,
      tables: tables.map(serializeDraft),
    });
    return snapshot !== baseline;
  }, [baseline, floor, tables]);

  const selected = tables.find((t) => t.id === selectedId) ?? null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get<{ data: { slug?: string } | null }>(
          '/api/restaurant'
        );
        const slug = res.data?.data?.slug?.trim();
        if (!cancelled) {
          setRestaurantSlug(slug && slug.length > 0 ? slug : null);
        }
      } catch {
        if (!cancelled) setRestaurantSlug(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    if (!scopedBranchId) {
      setTables([]);
      setFloor({ ...DEFAULT_FLOOR_SIZE });
      setBaseline(JSON.stringify({ floor: DEFAULT_FLOOR_SIZE, tables: [] }));
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const tablesRes = await axios.get<{
        data: ApiTable[];
        floor?: FloorSize;
      }>(
        withBranchQuery(
          `/api/restaurant/tables`,
          scopedBranchId,
          scopedBranchUrlId
        )
      );
      const nextFloor = tablesRes.data.floor ?? { ...DEFAULT_FLOOR_SIZE };
      const nextTables = mapApiTables(tablesRes.data.data ?? []);
      setFloor(nextFloor);
      setTables(nextTables);
      setBaseline(
        JSON.stringify({
          floor: nextFloor,
          tables: nextTables.map(serializeDraft),
        })
      );
      setSelectedId(null);
    } catch {
      toast.error('Could not load tables');
      setTables([]);
    } finally {
      setLoading(false);
    }
  }, [scopedBranchId, scopedBranchUrlId]);

  useEffect(() => {
    if (branchLoading && branchIdProp === undefined) return;
    void load();
  }, [load, branchLoading, branchIdProp]);

  function openAddAt(row: number, col: number) {
    setFormMode('add');
    setPlaceRow(row);
    setPlaceCol(col);
    setName('');
    setShape('SQUARE');
    setFormOpen(true);
  }

  function openAddAnywhere() {
    let foundRow = -1;
    let foundCol = -1;
    for (let r = 0; r < floor.tableFloorRows; r++) {
      for (let c = 0; c < floor.tableFloorCols; c++) {
        if (canPlaceTable(tables, { id: '__new__', gridRow: r, gridCol: c, gridRowSpan: 1, gridColSpan: 1 }, floor)) {
          foundRow = r;
          foundCol = c;
          break;
        }
      }
      if (foundRow !== -1) break;
    }
    if (foundRow === -1) {
      toast.error('No empty space left on the floor. Please add rows or columns.');
      return;
    }
    openAddAt(foundRow, foundCol);
  }

  function openEditSelected() {
    if (!selected) return;
    setFormMode('edit');
    setPlaceRow(selected.gridRow);
    setPlaceCol(selected.gridCol);
    setName(selected.name);
    setShape(selected.shape);
    setFormOpen(true);
  }

  function applyForm() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error(t('dashboard.tables.nameRequired'));
      return;
    }
    const spans = spansForShape(shape);
    if (formMode === 'add') {
      const probe = {
        id: '__new__',
        gridRow: placeRow,
        gridCol: placeCol,
        ...spans,
      };
      if (!canPlaceTable(tables, probe, floor)) {
        toast.error('That cell is not free for this shape.');
        return;
      }
      const draft: FloorTable = {
        id: newDraftTableId(),
        name: trimmed,
        shape,
        gridRow: placeRow,
        gridCol: placeCol,
        ...spans,
        sortOrder: tables.length,
        persisted: false,
      };
      setTables((prev) => [...prev, draft]);
      setSelectedId(draft.id);
    } else if (selected) {
      const next = {
        ...selected,
        name: trimmed,
        shape,
        ...spans,
      };
      if (!canPlaceTable(tables, next, floor)) {
        toast.error('Shape does not fit in the current cell.');
        return;
      }
      setTables((prev) => prev.map((t) => (t.id === selected.id ? next : t)));
    }
    setFormOpen(false);
  }

  function addRow() {
    setFloor((f) => ({ ...f, tableFloorRows: f.tableFloorRows + 1 }));
  }

  function addColumn() {
    setFloor((f) => ({ ...f, tableFloorCols: f.tableFloorCols + 1 }));
  }

  function removeSelectedDraft() {
    if (!selected) return;
    const remaining = tables.filter((t) => t.id !== selected.id);
    const compacted = compactEmptyFloor(remaining, floor);
    setTables(compacted.tables);
    setFloor(compacted.floor);
    setSelectedId(null);
    setDeleteTarget(null);
  }

  async function handleSave() {
    if (!scopedBranchId) {
      toast.error(t('dashboard.tables.selectBranchFirst'));
      return;
    }
    setSaving(true);
    try {
      const compacted = compactEmptyFloor(tables, floor);
      const originalIds = new Set(
        (JSON.parse(baseline) as { tables: FloorTable[] }).tables
          ?.filter((t) => t.persisted)
          .map((t) => t.id) ?? []
      );
      const currentPersisted = new Set(
        compacted.tables.filter((t) => t.persisted).map((t) => t.id)
      );
      const deletedIds = [...originalIds].filter(
        (id) => !currentPersisted.has(id)
      );

      const res = await axios.post<{
        data: ApiTable[];
        floor?: FloorSize;
      }>('/api/restaurant/tables/floor', {
        branchId: scopedBranchId,
        tableFloorRows: compacted.floor.tableFloorRows,
        tableFloorCols: compacted.floor.tableFloorCols,
        deletedIds,
        tables: compacted.tables.map((table, index) => ({
          id: table.persisted ? table.id : null,
          name: table.name,
          shape: table.shape,
          gridRow: table.gridRow,
          gridCol: table.gridCol,
          gridRowSpan: table.gridRowSpan,
          gridColSpan: table.gridColSpan,
          sortOrder: index,
        })),
      });
      const nextFloor = res.data.floor ?? compacted.floor;
      const nextTables = mapApiTables(res.data.data ?? []);
      setFloor(nextFloor);
      setTables(nextTables);
      setBaseline(
        JSON.stringify({
          floor: nextFloor,
          tables: nextTables.map(serializeDraft),
        })
      );
      setSelectedId(null);
      toast.success('Floor plan saved');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: unknown } } };
      const msg =
        typeof err.response?.data?.error === 'string'
          ? err.response.data.error
          : 'Failed to save floor plan';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardCard>
      <DashboardCardHeader>
        <DashboardCardTitle>
          {t('dashboard.tables.diningTables')}
        </DashboardCardTitle>
        <DashboardCardDescription>
          {activeBranchName
            ? t('dashboard.tables.diningTablesDescBranch', {
                branch: activeBranchName,
              })
            : t('dashboard.tables.diningTablesDescSelectBranch')}
        </DashboardCardDescription>
      </DashboardCardHeader>
      <DashboardCardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={addRow}
            disabled={!scopedBranchId}
          >
            <Rows3 className="mr-2 h-4 w-4" />Add Row
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={addColumn}
            disabled={!scopedBranchId}
          >
            <Columns3 className="mr-2 h-4 w-4" />Add Column
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={openAddAnywhere}
            disabled={!scopedBranchId}
          >
            <Plus className="mr-2 h-4 w-4" />Add table
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={!scopedBranchId || !dirty || saving}
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? (
              <RefreshCcw className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">
            <Loader2 className="mx-auto animate-spin text-center text-primary" />
          </p>
        ) : !scopedBranchId ? (
          <p className="text-sm text-muted-foreground">
            {t('dashboard.tables.selectBranchFirst')}
          </p>
        ) : (
          <>
            {selected ? (
              <div className="flex max-w-xl items-center gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2">
                <p className="mr-auto text-sm font-medium">{selected.name}</p>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!restaurantSlug || !selected.persisted}
                  onClick={() => setQrTarget(selected)}
                >
                  <QrCode className="mr-2 h-3.5 w-3.5" />
                  QR
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={openEditSelected}
                >
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  Edit
                </Button>
               
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setDeleteTarget(selected)}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Remove
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Click <strong>Add table</strong> to place a table, drag to move, or select a table to
                edit. Changes stay local until you press Save.
              </p>
            )}

            <TableFloorPlan
              mode="editor"
              floor={floor}
              tables={tables}
              selectedId={selectedId}
              onSelectCell={(row, col) => openAddAt(row, col)}
              onSelectTable={(table) => setSelectedId(table.id)}
              onMoveTable={(tableId, row, col) => {
                const current = tables.find((t) => t.id === tableId);
                if (!current) return;
                const next = {
                  ...current,
                  gridRow: row,
                  gridCol: col,
                };
                if (!canPlaceTable(tables, next, floor)) {
                  toast.error('That cell is not free for this table.');
                  return;
                }
                setTables((prev) =>
                  prev.map((t) => (t.id === tableId ? next : t))
                );
                setSelectedId(tableId);
              }}
            />
          </>
        )}

        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {formMode === 'edit' ? 'Edit table' : 'Add table'}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="floor-table-name">Name</Label>
                <Input
                  id="floor-table-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('dashboard.tables.namePlaceholder')}
                  maxLength={120}
                />
              </div>
              <div className="grid gap-2">
                <Label>Shape</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ['CIRCLE', 'Circle'],
                      ['SQUARE', 'Square'],
                      ['RECTANGLE', 'Rectangle'],
                    ] as const
                  ).map(([value, label]) => (
                    <Button
                      key={value}
                      type="button"
                      variant={shape === value ? 'default' : 'outline'}
                      onClick={() => setShape(value)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormOpen(false)}
              >
                {t('dashboard.common.cancel')}
              </Button>
              <Button type="button" onClick={applyForm}>
                {formMode === 'edit' ? 'Update' : 'Place'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {restaurantSlug && scopedBranchId && qrTarget?.persisted ? (
          <TableQrDialog
            open={!!qrTarget}
            onOpenChange={(open) => !open && setQrTarget(null)}
            table={qrTarget}
            slug={restaurantSlug}
            branchId={scopedBranchId}
          />
        ) : null}

        <AlertDialog
          open={!!deleteTarget}
          onOpenChange={(o) => !o && setDeleteTarget(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t('dashboard.tables.deleteTitle')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {deleteTarget
                  ? `${deleteTarget.name} will be removed from the draft. Save to apply.`
                  : ''}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>
                {t('dashboard.common.cancel')}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  removeSelectedDraft();
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DashboardCardContent>
    </DashboardCard>
  );
}

function serializeDraft(table: FloorTable) {
  return {
    id: table.id,
    name: table.name,
    shape: table.shape,
    gridRow: table.gridRow,
    gridCol: table.gridCol,
    gridRowSpan: table.gridRowSpan,
    gridColSpan: table.gridColSpan,
    sortOrder: table.sortOrder,
    persisted: table.persisted,
  };
}
