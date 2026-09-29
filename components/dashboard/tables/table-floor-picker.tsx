'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TableFloorPlan } from '@/components/dashboard/tables/table-floor-plan';
import {
  DEFAULT_FLOOR_SIZE,
  type FloorSize,
  type FloorTable,
  type DiningTableShape,
} from '@/lib/dining-table-floor';
import { withBranchQuery } from '@/hooks/use-branch-context';

export type FloorPickerTable = {
  id: string;
  name: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Restaurant staff API (POS) vs public customer API (kiosk). */
  source: 'restaurant' | 'customer';
  branchId: string | null;
  branchUrlId?: string | null;
  restaurantSlug?: string | null;
  selectedTableId?: string | null;
  onConfirm: (table: FloorPickerTable) => void;
  title?: string;
  confirmLabel?: string;
};

type ApiRow = {
  id: string;
  name: string;
  sortOrder?: number;
  shape?: DiningTableShape;
  status?: 'AVAILABLE' | 'RESERVED';
  gridRow?: number;
  gridCol?: number;
  gridRowSpan?: number;
  gridColSpan?: number;
  occupied?: boolean;
};

export function TableFloorPickerDialog({
  open,
  onOpenChange,
  source,
  branchId,
  branchUrlId = null,
  restaurantSlug = null,
  selectedTableId = null,
  onConfirm,
  title = 'Select a table',
  confirmLabel = 'Confirm table',
}: Props) {
  const [loading, setLoading] = useState(false);
  const [floor, setFloor] = useState<FloorSize>({ ...DEFAULT_FLOOR_SIZE });
  const [tables, setTables] = useState<FloorTable[]>([]);
  const [pickedId, setPickedId] = useState<string | null>(selectedTableId);
  const allowOccupiedSelect = source === 'restaurant';

  const load = useCallback(async () => {
    if (!branchId) {
      setTables([]);
      return;
    }
    setLoading(true);
    try {
      if (source === 'customer') {
        if (!restaurantSlug) {
          setTables([]);
          return;
        }
        const params = new URLSearchParams({
          slug: restaurantSlug,
          branchId,
        });
        const res = await axios.get<{
          data: ApiRow[];
          floor?: FloorSize | null;
        }>(`/api/customer/tables?${params}`);
        setFloor(res.data.floor ?? { ...DEFAULT_FLOOR_SIZE });
        setTables(
          (res.data.data ?? []).map((r, index) => ({
            id: r.id,
            name: r.name,
            shape: r.shape ?? 'SQUARE',
            gridRow: r.gridRow ?? Math.floor(index / 4),
            gridCol: r.gridCol ?? index % 4,
            gridRowSpan: r.gridRowSpan ?? 1,
            gridColSpan: r.gridColSpan ?? 1,
            sortOrder: r.sortOrder ?? index,
            persisted: true,
            occupied:
              r.status === 'RESERVED' || Boolean(r.occupied),
          }))
        );
      } else {
        const tablesRes = await axios.get<{
          data: ApiRow[];
          floor?: FloorSize;
        }>(withBranchQuery('/api/restaurant/tables', branchId, branchUrlId));
        setFloor(tablesRes.data.floor ?? { ...DEFAULT_FLOOR_SIZE });
        setTables(
          (tablesRes.data.data ?? []).map((r, index) => ({
            id: r.id,
            name: r.name,
            shape: r.shape ?? 'SQUARE',
            gridRow: r.gridRow ?? Math.floor(index / 4),
            gridCol: r.gridCol ?? index % 4,
            gridRowSpan: r.gridRowSpan ?? 1,
            gridColSpan: r.gridColSpan ?? 1,
            sortOrder: r.sortOrder ?? index,
            persisted: true,
            occupied:
              r.status === 'RESERVED' || Boolean(r.occupied),
          }))
        );
      }
    } catch {
      setTables([]);
    } finally {
      setLoading(false);
    }
  }, [branchId, branchUrlId, restaurantSlug, source]);

  useEffect(() => {
    if (!open) return;
    setPickedId(selectedTableId);
    void load();
  }, [open, load, selectedTableId]);

  const picked = useMemo(
    () => tables.find((t) => t.id === pickedId) ?? null,
    [tables, pickedId]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex min-h-[12rem] items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        ) : tables.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No tables available for this branch.
          </p>
        ) : (
          <TableFloorPlan
            mode="picker"
            floor={floor}
            tables={tables}
            selectedId={pickedId}
            allowOccupiedSelect={allowOccupiedSelect}
            onSelectTable={(table) => {
              if (table.occupied && !allowOccupiedSelect) return;
              setPickedId(table.id);
            }}
          />
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={
              !picked ||
              (Boolean(picked.occupied) && !allowOccupiedSelect)
            }
            onClick={() => {
              if (!picked) return;
              if (picked.occupied && !allowOccupiedSelect) return;
              onConfirm({ id: picked.id, name: picked.name });
              onOpenChange(false);
            }}
          >
            {confirmLabel}
            {picked ? ` · ${picked.name}` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
