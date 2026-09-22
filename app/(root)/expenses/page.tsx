'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import {
  Boxes,
  Hash,
  Loader2,
  Plus,
  Receipt,
  Search,
  Trash2,
  Wallet,
} from 'lucide-react';

import { MenuPageShell } from '@/components/dashboard/menu-manager/menu-page-shell';
import {
  DashboardCard,
  DashboardCardContent,
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TablePagination } from '@/components/ui/table-pagination';
import { DeleteConfirmation } from '@/components/ui/confirmation-dialogs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useBranchContext, withBranchQuery } from '@/hooks/use-branch-context';
import { useDashboardPermissions } from '@/hooks/use-dashboard-permissions';
import { useOwnerRestaurantRegional } from '@/hooks/use-restaurant-regional';
import { extractApiErrorMessage } from '@/lib/extract-api-error';
import { formatIngredientUnit } from '@/lib/inventory/stock';
import { filterDecimalInput } from '@/lib/validation/fields';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

type ExpenseTypeFilter = 'all' | 'INVENTORY' | 'MANUAL';

type ExpenseRow = {
  id: string;
  type: 'INVENTORY' | 'MANUAL';
  title: string;
  amount: number;
  notes: string | null;
  occurredAt: string;
  quantity: number | null;
  ingredient: { id: string; name: string; unit: string } | null;
  branch: { id: string; name: string } | null;
  createdBy: { id: string; name: string; email: string | null } | null;
};

type ExpenseKpis = {
  totalAmount: number;
  inventoryAmount: number;
  manualAmount: number;
  count: number;
  avgAmount: number;
};

const EMPTY_KPIS: ExpenseKpis = {
  totalAmount: 0,
  inventoryAmount: 0,
  manualAmount: 0,
  count: 0,
  avgAmount: 0,
};

function ExpenseInsightChip({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-3xl bg-white/85 p-4 shadow-[0_12px_40px_-16px_rgba(15,23,42,0.18),0_0_0_1px_rgba(240,90,32,0.06)] backdrop-blur-xl dark:bg-zinc-950/75 dark:shadow-[0_16px_48px_-18px_rgba(0,0,0,0.75),0_0_0_1px_rgba(240,90,32,0.14)]">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-fire-500 text-white shadow-md shadow-fire-500/30">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="truncate text-xl font-bold tracking-tight tabular-nums">
            {value}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">{hint}</p>
        </div>
      </div>
    </div>
  );
}

export default function ExpensesPage() {
  const { t } = useTranslation();
  const { formatMoney } = useOwnerRestaurantRegional();
  const { canEdit, canDelete } = useDashboardPermissions();
  const canEditExp = canEdit('expenses');
  const canDeleteExp = canDelete('expenses');
  const {
    loading: branchLoading,
    activeBranchId,
    activeBranchUrlId,
    branches,
  } = useBranchContext();
  const activeBranchName =
    branches.find((b) => b.id === activeBranchId)?.name ?? null;

  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [kpis, setKpis] = useState<ExpenseKpis>(EMPTY_KPIS);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [searchDraft, setSearchDraft] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<ExpenseTypeFilter>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [occurredAt, setOccurredAt] = useState(() =>
    format(new Date(), 'yyyy-MM-dd')
  );

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadExpenses = useCallback(
    async (p: number, opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      try {
        const res = await axios.get<{
          data: ExpenseRow[];
          meta: { total: number; totalPages: number; page: number };
          kpis: ExpenseKpis;
        }>(
          withBranchQuery(
            '/api/restaurant/expenses',
            activeBranchId,
            activeBranchUrlId
          ),
          {
            params: {
              page: p,
              limit: 20,
              q: appliedSearch || undefined,
              type: typeFilter === 'all' ? undefined : typeFilter,
              from: fromDate || undefined,
              to: toDate || undefined,
              _: Date.now(),
            },
            headers: { 'Cache-Control': 'no-store' },
          }
        );
        setRows(res.data.data ?? []);
        setKpis(res.data.kpis ?? EMPTY_KPIS);
        setTotal(res.data.meta?.total ?? 0);
        setTotalPages(res.data.meta?.totalPages ?? 1);
        setPage(res.data.meta?.page ?? p);
      } catch (e) {
        toast.error(extractApiErrorMessage(e, 'Could not load expenses.'));
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [
      activeBranchId,
      activeBranchUrlId,
      appliedSearch,
      typeFilter,
      fromDate,
      toDate,
      t,
    ]
  );

  useEffect(() => {
    if (branchLoading) return;
    void loadExpenses(1);
  }, [branchLoading, loadExpenses]);

  const applySearch = () => {
    setAppliedSearch(searchDraft.trim());
    setPage(1);
  };

  const resetAddForm = () => {
    setTitle('');
    setAmount('');
    setNotes('');
    setOccurredAt(format(new Date(), 'yyyy-MM-dd'));
  };

  const saveManual = async () => {
    const trimmedTitle = title.trim();
    const amt = Number(amount);
    if (!trimmedTitle) {
      toast.error('Title is required.');
      return;
    }
    if (!Number.isFinite(amt) || amt < 0) {
      toast.error('Enter a valid amount.');
      return;
    }
    setSaving(true);
    try {
      await axios.post(
        withBranchQuery(
          '/api/restaurant/expenses',
          activeBranchId,
          activeBranchUrlId
        ),
        {
          title: trimmedTitle,
          amount: amt,
          notes: notes.trim() || null,
          occurredAt: occurredAt
            ? new Date(`${occurredAt}T12:00:00`)
            : undefined,
        }
      );
      toast.success('Expense added.');
      setAddOpen(false);
      resetAddForm();
      void loadExpenses(1, { silent: true });
    } catch (e) {
      toast.error(extractApiErrorMessage(e, 'Could not add expense.'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await axios.delete(`/api/restaurant/expenses/${deleteId}`);
      toast.success('Expense deleted.');
      setDeleteId(null);
      void loadExpenses(page, { silent: true });
    } catch (e) {
      toast.error(extractApiErrorMessage(e, 'Could not delete expense.'));
    } finally {
      setDeleting(false);
    }
  };

  const filterHint = useMemo(() => {
    const parts: string[] = [];
    if (typeFilter !== 'all')
      parts.push(typeFilter === 'INVENTORY' ? 'Inventory' : 'Manual');
    if (fromDate || toDate) parts.push('date range');
    if (appliedSearch) parts.push(`“${appliedSearch}”`);
    if (activeBranchName) parts.push(activeBranchName);
    return parts.length > 0 ? parts.join(' · ') : 'All expenses';
  }, [typeFilter, fromDate, toDate, appliedSearch, activeBranchName]);

  return (
    <MenuPageShell
      title="Expenses"
      description={
        activeBranchName
          ? `Track spending for ${activeBranchName}. Inventory restocks and manual costs.`
          : 'Track inventory restock costs and manual expenses.'
      }
      loading={branchLoading}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {loading && kpis.count === 0 && rows.length === 0 ? (
          <>
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-[88px] animate-pulse rounded-3xl bg-muted/50"
              />
            ))}
          </>
        ) : (
          <>
            <ExpenseInsightChip
              icon={Wallet}
              label={t('dashboard.expenses.totalSpent')}
              value={formatMoney(kpis.totalAmount)}
              hint={filterHint}
            />
            <ExpenseInsightChip
              icon={Boxes}
              label={t('dashboard.expenses.inventory')}
              value={formatMoney(kpis.inventoryAmount)}
              hint={t('dashboard.expenses.restockHint')}
            />
            <ExpenseInsightChip
              icon={Receipt}
              label={t('dashboard.expenses.manual')}
              value={formatMoney(kpis.manualAmount)}
              hint={t('dashboard.expenses.manualHint')}
            />
            <ExpenseInsightChip
              icon={Hash}
              label={t('dashboard.expenses.entriesLabel')}
              value={String(kpis.count)}
              hint={
                kpis.count > 0
                  ? t('dashboard.expenses.avg', {
                      amount: formatMoney(kpis.avgAmount),
                    })
                  : t('dashboard.expenses.noMatching')
              }
            />
          </>
        )}
      </div>

      <DashboardCard>
        <DashboardCardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-end justify-between">
          <p className="text-sm text-muted-foreground">
            {t('dashboard.expenses.matchingCount', {
              count: total,
              entries:
                total === 1
                  ? t('dashboard.common.entry')
                  : t('dashboard.common.entries'),
            })}
          </p>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end justify-between">
            {canEditExp ? (
              <Button
                type="button"
                className="sm:order-last"
                onClick={() => {
                  resetAddForm();
                  setAddOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                {t('dashboard.expenses.addExpense')}
              </Button>
            ) : null}
            <div className="relative w-full flex-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder={t('dashboard.expenses.searchPlaceholder')}
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applySearch();
                  }
                }}
              />
            </div>
            <Button type="button" variant="secondary" onClick={applySearch}>
              {t('dashboard.common.search')}
            </Button>
            <Select
              value={typeFilter}
              onValueChange={(v) => {
                setTypeFilter(v as ExpenseTypeFilter);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder={t('dashboard.common.type')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('dashboard.expenses.allTypes')}</SelectItem>
                <SelectItem value="INVENTORY">
                  {t('dashboard.expenses.inventory')}
                </SelectItem>
                <SelectItem value="MANUAL">
                  {t('dashboard.expenses.manual')}
                </SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              className="w-full sm:w-[150px]"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
              aria-label={t('dashboard.common.fromDate')}
            />
            <Input
              type="date"
              className="w-full sm:w-[150px]"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
              aria-label={t('dashboard.common.toDate')}
            />
          </div>
        </DashboardCardHeader>
        <DashboardCardContent>
          <DashboardTableWrapper>
            <DashboardTable>
              <DashboardTableHeader>
                <DashboardTableRow>
                  <DashboardTableHead>{t('dashboard.common.date')}</DashboardTableHead>
                  <DashboardTableHead>{t('dashboard.common.type')}</DashboardTableHead>
                  <DashboardTableHead>{t('dashboard.common.title')}</DashboardTableHead>
                  <DashboardTableHead>{t('dashboard.common.details')}</DashboardTableHead>
                  <DashboardTableHead className="text-right">
                    {t('dashboard.common.amount')}
                  </DashboardTableHead>
                  {canDeleteExp ? (
                    <DashboardTableHead className="w-12" />
                  ) : null}
                </DashboardTableRow>
              </DashboardTableHeader>
              <DashboardTableBody>
                {loading ? (
                  <DashboardTableRow>
                    <DashboardTableCell
                      colSpan={canDeleteExp ? 6 : 5}
                      className="py-10 text-center text-muted-foreground"
                    >
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    </DashboardTableCell>
                  </DashboardTableRow>
                ) : rows.length === 0 ? (
                  <DashboardTableRow>
                    <DashboardTableCell
                      colSpan={canDeleteExp ? 6 : 5}
                      className="py-10 text-center text-muted-foreground"
                    >
                      {t('dashboard.expenses.emptyFiltered')}
                    </DashboardTableCell>
                  </DashboardTableRow>
                ) : (
                  rows.map((row) => (
                    <DashboardTableRow key={row.id}>
                      <DashboardTableCell className="whitespace-nowrap tabular-nums">
                        {format(new Date(row.occurredAt), 'dd MMM yyyy')}
                      </DashboardTableCell>
                      <DashboardTableCell>
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium',
                            row.type === 'INVENTORY'
                              ? 'bg-amber-500/15 text-amber-800 dark:text-amber-200'
                              : 'bg-sky-500/15 text-sky-800 dark:text-sky-200'
                          )}
                        >
                          {row.type === 'INVENTORY'
                            ? t('dashboard.expenses.inventory')
                            : t('dashboard.expenses.manual')}
                        </span>
                      </DashboardTableCell>
                      <DashboardTableCell>
                        <div className="min-w-0">
                          <p className="font-medium">{row.title}</p>
                          {row.notes ? (
                            <p className="truncate text-xs text-muted-foreground">
                              {row.notes}
                            </p>
                          ) : null}
                        </div>
                      </DashboardTableCell>
                      <DashboardTableCell className="text-sm text-muted-foreground">
                        {row.type === 'INVENTORY' && row.ingredient ? (
                          <span>
                            {row.ingredient.name}
                            {row.quantity != null
                              ? ` · +${row.quantity} ${formatIngredientUnit(row.ingredient.unit)}`
                              : ''}
                          </span>
                        ) : row.branch ? (
                          row.branch.name
                        ) : (
                          '—'
                        )}
                      </DashboardTableCell>
                      <DashboardTableCell className="text-right font-medium tabular-nums">
                        {formatMoney(row.amount)}
                      </DashboardTableCell>
                      {canDeleteExp ? (
                        <DashboardTableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            aria-label={t('dashboard.expenses.deleteAria')}
                            onClick={() => setDeleteId(row.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </DashboardTableCell>
                      ) : null}
                    </DashboardTableRow>
                  ))
                )}
              </DashboardTableBody>
            </DashboardTable>
          </DashboardTableWrapper>
          <TablePagination
            pagination={{
              page,
              pageSize: 20,
              total,
              totalPages,
            }}
            page={page}
            onPageChange={(p) => void loadExpenses(p)}
            loading={loading}
            hideWhenSinglePage={false}
          />
        </DashboardCardContent>
      </DashboardCard>

      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          if (!open && !saving) {
            setAddOpen(false);
            resetAddForm();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dashboard.expenses.addManualTitle')}</DialogTitle>
            <DialogDescription>
              {t('dashboard.expenses.addManualDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label htmlFor="expense-title">{t('dashboard.common.title')}</Label>
              <Input
                id="expense-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('dashboard.expenses.titlePlaceholder')}
                inputMode="decimal"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="expense-amount">{t('dashboard.common.amount')}</Label>
              <Input
                id="expense-amount"
                value={amount}
                onChange={(e) => setAmount(filterDecimalInput(e.target.value))}
                inputMode="decimal"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="expense-date">{t('dashboard.common.date')}</Label>
              <Input
                id="expense-date"
                type="date"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="expense-notes">
                {t('dashboard.expenses.notesOptional')}
              </Label>
              <Textarea
                id="expense-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => {
                setAddOpen(false);
                resetAddForm();
              }}
            >
              {t('dashboard.common.cancel')}
            </Button>
            <Button
              type="button"
              disabled={saving || !title.trim() || amount.trim() === ''}
              onClick={() => void saveManual()}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              {t('dashboard.expenses.saveExpense')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmation
        open={!!deleteId}
        onCancel={() => {
          if (!deleting) setDeleteId(null);
        }}
        onConfirm={() => void confirmDelete()}
        title={t('dashboard.expenses.deleteTitle')}
        description={t('dashboard.expenses.deleteDescription')}
        itemName={rows.find((r) => r.id === deleteId)?.title}
        loading={deleting}
      />
    </MenuPageShell>
  );
}
