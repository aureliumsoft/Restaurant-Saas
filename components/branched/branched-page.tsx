'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import {
  DeleteConfirmation,
} from '@/components/ui/confirmation-dialogs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'react-toastify';
import {
  Building2,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import { useStaffPermissions } from '@/hooks/use-staff-permissions';
import { useOwnerRestaurantRegional } from '@/hooks/use-restaurant-regional';
import { useBranchContext } from '@/hooks/use-branch-context';
import { useRestaurantFulfillmentSettings } from '@/hooks/use-restaurant-fulfillment-settings';
import { TablesModule } from '@/components/dashboard/tables/tables-module';
import { timezoneForRestaurantCountry } from '@/lib/restaurant-regional';
import {
  createDefaultOpeningHours,
  normalizeOpeningHours,
  type BranchOpeningHours,
} from '@/lib/order-time-slots';
import { cn } from '@/lib/utils';
import Link from 'next/link';

type BranchRow = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  openingHours: BranchOpeningHours | null;
  createdAt: string;
};

function weekdayLabelsFor(t: TFunction) {
  return [
    t('weekdaySunday'),
    t('weekdayMonday'),
    t('weekdayTuesday'),
    t('weekdayWednesday'),
    t('weekdayThursday'),
    t('weekdayFriday'),
    t('weekdaySaturday'),
  ];
}

function mapBranchApiError(t: TFunction, msg: string): string {
  const trimmed = msg.trim();
  if (trimmed.startsWith('Your plan allows up to')) {
    return t('dashboard.branches.branchLimitReached');
  }
  switch (trimmed) {
    case 'Failed to create branch.':
    case 'Failed to create branch':
      return t('dashboard.branches.createFailed');
    case 'Failed to update branch.':
    case 'Failed to update branch':
      return t('dashboard.branches.updateFailed');
    case 'Failed to delete branch.':
    case 'Failed to delete branch':
      return t('dashboard.branches.deleteFailed');
    case 'You must keep at least one branch.':
      return t('dashboard.branches.atLeastOne');
    default:
      return msg;
  }
}

function formatOpeningHoursSummary(
  openingHours: BranchOpeningHours | null | undefined,
  weekdayLabels: string[],
  t: TFunction
) {
  const normalized = normalizeOpeningHours(openingHours);
  const enabledDays = normalized.filter((entry) => entry.isOpen);
  if (enabledDays.length === 0) {
    return t('dashboard.branches.noWeeklyHours');
  }

  const first = enabledDays[0];
  const label = `${weekdayLabels[first.dayOfWeek]} ${first.openTime}–${first.closeTime}`;
  if (enabledDays.length === 1) {
    return label;
  }
  return `${label} + ${enabledDays.length - 1} more`;
}

export function BranchedPage({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation();
  const weekdayLabels = useMemo(() => weekdayLabelsFor(t), [t]);
  const { plan } = useStaffPermissions();
  const { regional } = useOwnerRestaurantRegional();
  const { branches: scopedBranches } = useBranchContext();
  const { settings: fulfillmentSettings } = useRestaurantFulfillmentSettings();
  const branchTimeZone = timezoneForRestaurantCountry(regional.countryCode);
  const restaurantZoneLabel =
    regional.countryCode === 'PK'
      ? 'Pakistan (Karachi)'
      : 'Spain (Madrid)';
  const [restaurantClock, setRestaurantClock] = useState('');
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [openingHours, setOpeningHours] = useState<BranchOpeningHours>(
    createDefaultOpeningHours()
  );

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get<{ data: BranchRow[] }>(
        '/api/restaurant/branches'
      );
      setBranches(res.data.data ?? []);
    } catch {
      toast.error(t('dashboard.branches.loadFailed'));
      setBranches([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (loading || branches.length === 0) return;
    if (
      selectedBranchId &&
      branches.some((b) => b.id === selectedBranchId)
    ) {
      return;
    }
    setSelectedBranchId(branches[0]!.id);
  }, [loading, branches, selectedBranchId]);

  useEffect(() => {
    const tick = () => {
      setRestaurantClock(
        new Date().toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: branchTimeZone,
        })
      );
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [branchTimeZone]);

  const selectedBranch =
    branches.find((b) => b.id === selectedBranchId) ?? null;
  const selectedBranchUrlId =
    scopedBranches.find((b) => b.id === selectedBranchId)?.urlId ?? null;
  const cannotDeleteLastBranch = branches.length <= 1;
  const maxBranches = plan?.maxBranches ?? 1;
  const branchCap =
    maxBranches === null ? Number.POSITIVE_INFINITY : maxBranches;
  const atBranchLimit = branches.length >= branchCap;
  const branchLimitLabel =
    maxBranches === null
      ? t('dashboard.branches.unlimited')
      : String(maxBranches);

  function resetForm() {
    setActiveId(null);
    setName('');
    setAddress('');
    setPhone('');
    setOpeningHours(createDefaultOpeningHours());
  }

  function openAddForm() {
    resetForm();
    setFormOpen(true);
  }

  function updateOpeningHour(dayOfWeek: number, patch: Partial<BranchOpeningHours[number]>) {
    setOpeningHours((current) =>
      current.map((entry) =>
        entry.dayOfWeek === dayOfWeek ? { ...entry, ...patch } : entry
      )
    );
  }

  function startEdit(branch: BranchRow) {
    setActiveId(branch.id);
    setName(branch.name);
    setAddress(branch.address ?? '');
    setPhone(branch.phone ?? '');
    setOpeningHours(normalizeOpeningHours(branch.openingHours));
    setSelectedBranchId(branch.id);
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) return;
    setFormOpen(false);
    resetForm();
  }

  async function createBranch() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.warn(t('dashboard.branches.nameRequired'));
      return;
    }
    if (!address.trim() || !phone.trim()) {
      toast.warn(t('dashboard.branches.nameRequired'));
      return;
    }
    if (atBranchLimit) {
      toast.warn(t('dashboard.branches.branchLimitReached'));
      return;
    }
    setSaving(true);
    try {
      await axios.post('/api/restaurant/branches', {
        name: trimmed,
        address: address.trim(),
        phone: phone.trim(),
        openingHours,
      });
      toast.success(t('dashboard.branches.created'));
      setFormOpen(false);
      resetForm();
      await load();
    } catch (e: unknown) {
      const msg =
        axios.isAxiosError(e) && typeof e.response?.data?.error === 'string'
          ? mapBranchApiError(t, e.response.data.error)
          : t('dashboard.branches.createFailed');
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function updateBranch() {
    const branchId = activeId;
    const trimmed = name.trim();
    if (!branchId) return;
    if (!trimmed) {
      toast.warn(t('dashboard.branches.nameRequired'));
      return;
    }
    setSaving(true);
    try {
      await axios.patch(`/api/restaurant/branches/${branchId}`, {
        name: trimmed,
        address: address.trim(),
        phone: phone.trim(),
        openingHours,
      });
      toast.success(t('dashboard.branches.updated'));
      setFormOpen(false);
      resetForm();
      await load();
    } catch (e: unknown) {
      const msg =
        axios.isAxiosError(e) && typeof e.response?.data?.error === 'string'
          ? mapBranchApiError(t, e.response.data.error)
          : t('dashboard.branches.updateFailed');
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function deleteBranch() {
    const branchId = activeId;
    if (!branchId) return;
    if (cannotDeleteLastBranch) {
      toast.warn(t('dashboard.branches.atLeastOne'));
      setConfirmDeleteOpen(false);
      return;
    }
    setDeletingId(branchId);
    try {
      await axios.delete(`/api/restaurant/branches/${branchId}`);
      toast.success(t('dashboard.branches.deleted'));
      resetForm();
      setConfirmDeleteOpen(false);
      setSelectedBranchId((prev) => (prev === branchId ? null : prev));
      await load();
    } catch (e: unknown) {
      const msg =
        axios.isAxiosError(e) && typeof e.response?.data?.error === 'string'
          ? mapBranchApiError(t, e.response.data.error)
          : t('dashboard.branches.deleteFailed');
      toast.error(msg);
    } finally {
      setDeletingId(null);
      setActiveId(null);
    }
  }

  return (
    <>
      {!embedded ? (
        <div className="mb-6 flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t('dashboard.branches.title')}
          </h1>
          <p className="space-y-2 text-sm text-muted-foreground">
            {t('dashboard.branches.intro', { limit: branchLimitLabel })}
        </p>
      </div>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle>{t('dashboard.branches.management')}</CardTitle>
          <Button
            type="button"
            onClick={openAddForm}
            disabled={loading || atBranchLimit}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t('dashboard.branches.addNew')}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {!loading && atBranchLimit ? (
            <p className="rounded-md border border-dashed border-destructive bg-destructive/10 p-3 text-sm text-destructive">
              {t('dashboard.branches.planLimitWarning', {
                limit:
                  maxBranches === null
                    ? t('dashboard.branches.unlimited')
                    : maxBranches === 1
                      ? t('dashboard.branches.locationOne', {
                          count: maxBranches,
                        })
                      : t('dashboard.branches.locationsMany', {
                          count: maxBranches,
                        }),
              })}
            </p>
          ) : null}

          {loading ? (
            <p className="text-sm text-muted-foreground">
              <Loader2 className="mx-auto animate-spin text-center text-primary" />
            </p>
          ) : branches.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('dashboard.branches.noBranchesYet')}
            </p>
          ) : (
            <div className="space-y-3">
              {branches.length <= 1 ? (
                <p className="text-xs text-amber-600">
                  {t('dashboard.branches.keepOneBranch')}
                </p>
              ) : null}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {branches.map((b, index) => {
                  const selected = b.id === selectedBranchId;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setSelectedBranchId(b.id)}
                      className={cn(
                        'relative w-full min-w-0 overflow-hidden rounded-xl border bg-background p-4 text-left transition-colors',
                        selected
                          ? 'border-primary ring-1 ring-primary/30'
                          : 'border-border hover:border-primary/40'
                      )}
                    >
                      <Building2
                        className="pointer-events-none absolute -right-2 bottom-0 h-24 w-24 text-muted-foreground/15 opacity-25"
                        aria-hidden
                      />
                      <div className="relative z-[1] flex items-start justify-between gap-2">
                        <div className="min-w-0 pr-10">
                          <p className="text-sm font-semibold">
                            {index + 1}. {b.name}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {b.address || t('dashboard.branches.noAddress')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {b.phone || t('dashboard.branches.noPhone')}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatOpeningHoursSummary(
                              b.openingHours,
                              weekdayLabels,
                              t
                            )}
                          </p>
                        </div>
                        {selected ? (
                          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                            Selected
                          </span>
                        ) : null}
                      </div>
                      <div className="relative z-[1] mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEdit(b);
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          <span>{t('dashboard.branches.edit')}</span>
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          disabled={cannotDeleteLastBranch}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveId(b.id);
                            setSelectedBranchId(b.id);
                            setConfirmDeleteOpen(true);
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          <span>{t('dashboard.branches.delete')}</span>
                        </Button>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedBranch ? (
        <div className="mt-6 space-y-3">
          {fulfillmentSettings.dineInEnabled ? (
            <TablesModule
              branchId={selectedBranch.id}
              branchUrlId={selectedBranchUrlId}
              branchName={selectedBranch.name}
            />
          ) : (
            <Card>
              <CardContent className="space-y-3 p-6">
                <p className="text-sm text-muted-foreground">
                  Enable dine-in in Basic settings to manage tables for{' '}
                  <span className="font-medium text-foreground">
                    {selectedBranch.name}
                  </span>
                  .
                </p>
                <Button type="button" variant="outline" asChild>
                  <Link href="/settings">Open basic settings</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!open) closeForm();
          else setFormOpen(true);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {activeId
                ? t('dashboard.branches.edit')
                : t('dashboard.branches.addNew')}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-1">
            <div className="grid gap-2">
              <Label htmlFor="branch-name">
                {t('dashboard.branches.branchNamePlaceholder')}
              </Label>
            <Input
                id="branch-name"
                placeholder={t('dashboard.branches.branchNamePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="branch-address">
                {t('dashboard.branches.addressPlaceholder')}
              </Label>
            <Input
                id="branch-address"
                placeholder={t('dashboard.branches.addressPlaceholder')}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="branch-phone">
                {t('dashboard.branches.phonePlaceholder')}
              </Label>
            <Input
                id="branch-phone"
              type="tel"
                placeholder={t('dashboard.branches.phonePlaceholder')}
              value={phone}
                onChange={(e) =>
                  setPhone(e.target.value.replace(/[^0-9]/g, ''))
                }
            />
          </div>
            <div className="space-y-2 rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">
                  {t('dashboard.branches.weeklyHours')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('dashboard.branches.hoursTimezoneHint', {
                    zone: restaurantZoneLabel,
                    time: restaurantClock,
                  })}
                </p>
            </div>
            <div className="space-y-2">
              {openingHours.map((entry) => (
                <div
                  key={entry.dayOfWeek}
                    className="grid items-center gap-2 sm:grid-cols-[110px_70px_1fr_1fr]"
                >
                    <span className="text-sm">
                      {weekdayLabels[entry.dayOfWeek]}
                    </span>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={entry.isOpen}
                      onChange={(event) =>
                        updateOpeningHour(entry.dayOfWeek, {
                          isOpen: event.target.checked,
                        })
                      }
                    />
                      {t('dashboard.branches.open')}
                  </label>
                  <Input
                    type="time"
                    step={60}
                    value={entry.openTime}
                    disabled={!entry.isOpen}
                      className="min-w-0"
                    onChange={(event) =>
                      updateOpeningHour(entry.dayOfWeek, {
                        openTime: event.target.value,
                      })
                    }
                  />
                  <Input
                    type="time"
                    step={60}
                    value={entry.closeTime}
                    disabled={!entry.isOpen}
                      className="min-w-0"
                    onChange={(event) =>
                      updateOpeningHour(entry.dayOfWeek, {
                        closeTime: event.target.value,
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
              disabled={saving}
              onClick={closeForm}
                >
              {t('dashboard.common.cancel')}
                </Button>
              <Button
                type="button"
              disabled={
                saving ||
                !name.trim() ||
                !address.trim() ||
                !phone.trim() ||
                (!activeId && atBranchLimit)
              }
              onClick={() =>
                void (activeId ? updateBranch() : createBranch())
              }
              >
                {saving ? (
                  <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  <span>
                    {activeId
                      ? t('dashboard.branches.updating')
                      : t('dashboard.branches.adding')}
                  </span>
                  </>
                ) : (
                  <>
                  <Save className="mr-2 h-4 w-4" />
                  <span>
                    {activeId
                      ? t('dashboard.branches.update')
                      : t('dashboard.branches.addNew')}
                  </span>
                  </>
                )}
              </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmation
        open={confirmDeleteOpen}
        title={t('dashboard.branches.confirmDeleteTitle')}
        description={t('dashboard.branches.confirmDeleteDesc')}
        itemName={
          branches.find((b) => b.id === activeId)?.name ??
          t('dashboard.branches.title')
        }
        loading={deletingId === activeId}
        onConfirm={() => void deleteBranch()}
        onCancel={() => {
          setConfirmDeleteOpen(false);
          if (!formOpen) setActiveId(null);
        }}
      />
    </>
  );
}
