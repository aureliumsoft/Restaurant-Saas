'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import {
  Loader2,
  Pencil,
  Plus,
  QrCode,
  RefreshCcw,
  RefreshCw,
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
  DashboardTable,
  DashboardTableBody,
  DashboardTableCell,
  DashboardTableHead,
  DashboardTableHeader,
  DashboardTableRow,
  DashboardTableWrapper,
} from '@/components/dashboard/dashboard-table';
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
import { tableApiPath } from '@/lib/dashboard-paths';
import { TablePagination } from '@/components/ui/table-pagination';
import {
  TableQrCard,
  TableQrDialog,
} from '@/components/dashboard/tables/table-qr-card';

export type DiningTableRow = {
  id: string;
  urlId?: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

const PAGE_SIZE = 20;

export function TablesModule() {
  const { t } = useTranslation();
  const {
    activeBranchId,
    activeBranchUrlId,
    loading: branchLoading,
    branches,
  } = useBranchContext();
  const activeBranchName =
    branches.find((b) => b.id === activeBranchId)?.name ?? null;
  const [rows, setRows] = useState<DiningTableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DiningTableRow | null>(null);
  const [name, setName] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DiningTableRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [restaurantSlug, setRestaurantSlug] = useState<string | null>(null);
  const [qrTarget, setQrTarget] = useState<DiningTableRow | null>(null);

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
    setLoading(true);
    try {
      const res = await axios.get<{
        data: DiningTableRow[];
        pagination?: {
          page: number;
          pageSize: number;
          total: number;
          totalPages: number;
        };
      }>(
        withBranchQuery(
          `/api/restaurant/tables?page=${page}&limit=${PAGE_SIZE}`,
          activeBranchId,
          activeBranchUrlId
        )
      );
      setRows(Array.isArray(res.data?.data) ? res.data.data : []);
      if (res.data.pagination) setPagination(res.data.pagination);
    } catch {
      toast.error('Could not load tables');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [activeBranchId, page]);

  useEffect(() => {
    setPage(1);
  }, [activeBranchId]);

  useEffect(() => {
    if (branchLoading) return;
    void load();
  }, [load, branchLoading]);

  function openCreate() {
    setEditing(null);
    setName('');
    setSortOrder(String(pagination.total));
    setDialogOpen(true);
  }

  function openEdit(row: DiningTableRow) {
    setEditing(row);
    setName(row.name);
    setSortOrder(String(row.sortOrder));
    setDialogOpen(true);
  }

  async function handleSave() {
    const nameTrim = name.trim();
    if (!nameTrim) {
      toast.error(t('dashboard.tables.nameRequired'));
      return;
    }
    const sort = Math.min(
      9999,
      Math.max(0, Math.floor(Number(sortOrder) || 0))
    );

    if (!editing && !activeBranchId) {
      toast.error(t('dashboard.tables.selectBranchFirst'));
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await axios.patch(tableApiPath(editing.id, '', editing.urlId), {
          name: nameTrim,
          sortOrder: sort,
        });
        toast.success(t('dashboard.tables.tableUpdated'));
      } else {
        await axios.post('/api/restaurant/tables', {
          name: nameTrim,
          sortOrder: sort,
          branchId: activeBranchId,
        });
        toast.success(t('dashboard.tables.tableAdded'));
      }
      setDialogOpen(false);
      await load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: unknown } } };
      const msg =
        typeof err.response?.data?.error === 'string'
          ? err.response.data.error
          : t('dashboard.tables.saveFailed');
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await axios.delete(tableApiPath(deleteTarget.id, '', deleteTarget.urlId));
      toast.success(t('dashboard.tables.tableRemoved'));
      setDeleteTarget(null);
      await load();
    } catch {
      toast.error(t('dashboard.tables.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <DashboardCard>
      <DashboardCardHeader>
        <DashboardCardTitle>{t('dashboard.tables.diningTables')}</DashboardCardTitle>
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
          <Button type="button" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            {t('dashboard.tables.addTable')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">
            <Loader2 className="animate-spin text-primary text-center mx-auto" />
          </p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('dashboard.tables.noTablesYet')}
          </p>
        ) : (
          <>
            <DashboardTableWrapper>
              <DashboardTable>
                <DashboardTableHeader>
                  <DashboardTableRow>
                    <DashboardTableHead>
                      {t('dashboard.tables.colName')}
                    </DashboardTableHead>
                    <DashboardTableHead className="text-right">
                      {t('dashboard.tables.colSort')}
                    </DashboardTableHead>
                    <DashboardTableHead className="text-right">
                      {t('dashboard.tables.colActions')}
                    </DashboardTableHead>
                  </DashboardTableRow>
                </DashboardTableHeader>
                <DashboardTableBody>
                  {rows.map((row) => (
                    <DashboardTableRow key={row.id}>
                      <DashboardTableCell className="font-medium">
                        {row.name}
                      </DashboardTableCell>
                      <DashboardTableCell className="text-right tabular-nums">
                        {row.sortOrder}
                      </DashboardTableCell>
                      <DashboardTableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="rounded-lg"
                            aria-label={`QR code for ${row.name}`}
                            disabled={!restaurantSlug || !activeBranchId}
                            title={
                              restaurantSlug && activeBranchId
                                ? t('dashboard.tables.qrViewDownload')
                                : t('dashboard.tables.qrMissingSlug')
                            }
                            onClick={() => setQrTarget(row)}
                          >
                            <QrCode className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="rounded-lg"
                            aria-label={`Edit ${row.name}`}
                            onClick={() => openEdit(row)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="rounded-lg text-destructive"
                            aria-label={`Delete ${row.name}`}
                            onClick={() => setDeleteTarget(row)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </DashboardTableCell>
                    </DashboardTableRow>
                  ))}
                </DashboardTableBody>
              </DashboardTable>
            </DashboardTableWrapper>
            <TablePagination
              pagination={pagination}
              page={page}
              onPageChange={setPage}
              loading={loading}
            />

            {restaurantSlug && activeBranchId ? (
              <div className="space-y-3 pt-2">
                <div>
                  <h3 className="text-sm font-semibold">
                    {t('dashboard.tables.qrCodesTitle')}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {t('dashboard.tables.qrCodesHint')}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {rows.map((row) => (
                    <button
                      key={`qr-${row.id}`}
                      type="button"
                      className="text-left transition hover:opacity-90"
                      onClick={() => setQrTarget(row)}
                    >
                      <TableQrCard
                        tableName={row.name}
                        tableId={row.id}
                        slug={restaurantSlug}
                        branchId={activeBranchId}
                      />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editing
                  ? t('dashboard.tables.editTable')
                  : t('dashboard.tables.addTable')}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="table-name">
                  {t('dashboard.tables.colName')}
                </Label>
                <Input
                  id="table-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('dashboard.tables.namePlaceholder')}
                  maxLength={120}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="table-sort">
                  {t('dashboard.tables.sortOrder')}
                </Label>
                <Input
                  id="table-sort"
                  type="number"
                  min={0}
                  max={9999}
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {t('dashboard.tables.sortOrderHint')}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                {t('dashboard.common.cancel')}
              </Button>
              <Button
                type="button"
                disabled={saving}
                onClick={() => void handleSave()}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />{' '}
                    <span>{t('dashboard.tables.creating')}</span>
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />{' '}
                    <span>{t('dashboard.tables.createTable')}</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {restaurantSlug && activeBranchId ? (
          <TableQrDialog
            open={!!qrTarget}
            onOpenChange={(open) => !open && setQrTarget(null)}
            table={qrTarget}
            slug={restaurantSlug}
            branchId={activeBranchId}
          />
        ) : null}

        <AlertDialog
          open={!!deleteTarget}
          onOpenChange={(o) => !o && setDeleteTarget(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('dashboard.tables.deleteTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteTarget
                  ? t('dashboard.tables.deleteDescription', {
                      name: deleteTarget.name,
                    })
                  : ''}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>
                {t('dashboard.common.cancel')}
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={deleting}
                onClick={(e) => {
                  e.preventDefault();
                  void handleDelete();
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting
                  ? t('dashboard.common.loading')
                  : t('dashboard.common.delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DashboardCardContent>
    </DashboardCard>
  );
}
