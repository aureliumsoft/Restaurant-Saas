'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import {
  DeleteConfirmation,
  SaveConfirmation,
} from '@/components/ui/confirmation-dialogs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'react-toastify';
import {
  Cross,
  Loader2,
  Loader2Icon,
  Pencil,
  Plus,
  Save,
  Trash,
  Trash2,
  X,
} from 'lucide-react';
import { useStaffPermissions } from '@/hooks/use-staff-permissions';
import { useOwnerRestaurantRegional } from '@/hooks/use-restaurant-regional';
import { timezoneForRestaurantCountry } from '@/lib/restaurant-regional';
import {
  createDefaultOpeningHours,
  normalizeOpeningHours,
  type BranchOpeningHours,
} from '@/lib/order-time-slots';

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

export function BranchedPage() {
  const { t } = useTranslation();
  const weekdayLabels = useMemo(() => weekdayLabelsFor(t), [t]);
  const { plan } = useStaffPermissions();
  const { regional } = useOwnerRestaurantRegional();
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

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [openingHours, setOpeningHours] = useState<BranchOpeningHours>(
    createDefaultOpeningHours()
  );

  const [confirmAddOpen, setConfirmAddOpen] = useState(false);
  const [confirmEditOpen, setConfirmEditOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

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

  const activeBranch = branches.find((b) => b.id === activeId) ?? null;
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
  }

  async function createBranch() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.warn(t('dashboard.branches.nameRequired'));
      return;
    }
    if (atBranchLimit) {
      toast.warn(t('dashboard.branches.branchLimitReached'));
      setConfirmAddOpen(false);
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
      resetForm();
      setConfirmAddOpen(false);
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
      resetForm();
      setConfirmEditOpen(false);
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
      <div className="flex flex-col gap-2 mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('dashboard.branches.title')}
        </h1>
        <p className="text-sm text-muted-foreground space-y-2">
          {t('dashboard.branches.intro', { limit: branchLimitLabel })}
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.branches.management')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!loading && atBranchLimit && !activeId ? (
            <p className="rounded-md border border-dashed border-destructive p-3 text-sm text-destructive bg-destructive/10">
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
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              placeholder={t('dashboard.branches.branchNamePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              placeholder={t('dashboard.branches.addressPlaceholder')}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            <Input
              type="tel"
              placeholder={t('dashboard.branches.phonePlaceholder')}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
            />
          </div>
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
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
            </div>
            <div className="space-y-2">
              {openingHours.map((entry) => (
                <div
                  key={entry.dayOfWeek}
                  className="grid gap-2 sm:grid-cols-[140px_80px_120px_120px] items-center"
                >
                  <span className="text-sm">{weekdayLabels[entry.dayOfWeek]}</span>
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

          <div className="flex flex-wrap gap-2">
            {activeId ? (
              <>
                <Button
                  type="button"
                  disabled={saving || deletingId === activeId}
                  onClick={() => setConfirmEditOpen(true)}
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />{' '}
                      <span>{t('dashboard.branches.updating')}</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      <span>{t('dashboard.branches.update')}</span>
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="destructive"
                  disabled={
                    saving || deletingId === activeId || cannotDeleteLastBranch
                  }
                  onClick={() => setConfirmDeleteOpen(true)}
                >
                  {deletingId === activeId ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />{' '}
                      <span>{t('dashboard.branches.deleting')}</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      <span>{t('dashboard.branches.delete')}</span>
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving || deletingId === activeId}
                  onClick={resetForm}
                >
                  <>
                    <X className="h-4 w-4 mr-2" />
                    <span>{t('dashboard.common.cancel')}</span>
                  </>
                </Button>
              </>
            ) : (
              <Button
                type="button"
                onClick={() => setConfirmAddOpen(true)}
                disabled={saving || atBranchLimit || !name.trim() || !address.trim() || !phone.trim()}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />{' '}
                    <span>{t('dashboard.branches.adding')}</span>
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />{' '}
                    <span>{t('dashboard.branches.addNew')}</span>
                  </>
                )}
              </Button>
            )}
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">
              <Loader2 className="animate-spin text-primary text-center mx-auto" />
            </p>
          ) : branches.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('dashboard.branches.noBranchesYet')}
            </p>
          ) : (
            <div className="space-y-2">
              {branches.length <= 1 ? (
                <p className="text-xs text-amber-600">
                  {t('dashboard.branches.keepOneBranch')}
                </p>
              ) : null}
              {branches.map((b, index) => {
                const editing = b.id === activeId;
                return (
                  <div
                    key={b.id}
                    className={`rounded-lg border p-3 ${editing ? 'border-primary' : ''}`}
                  >
                    <p className="text-sm font-semibold">
                      {index + 1}. {b.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
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
                    <div className="mt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => startEdit(b)}
                      >
                        <>
                          <Pencil className="h-4 w-4 mr-2" />
                          <span>{t('dashboard.branches.edit')}</span>
                        </>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <SaveConfirmation
        open={confirmAddOpen}
        title={t('dashboard.branches.confirmAddTitle')}
        description={t('dashboard.branches.confirmAddDesc')}
        itemName={name.trim() || t('dashboard.branches.newBranch')}
        loading={saving}
        onConfirm={() => void createBranch()}
        onCancel={() => setConfirmAddOpen(false)}
      />
      <SaveConfirmation
        open={confirmEditOpen}
        title={t('dashboard.branches.confirmUpdateTitle')}
        description={t('dashboard.branches.confirmUpdateDesc')}
        itemName={(activeBranch?.name ?? name.trim()) || t('dashboard.branches.title')}
        loading={saving}
        onConfirm={() => void updateBranch()}
        onCancel={() => setConfirmEditOpen(false)}
      />
      <DeleteConfirmation
        open={confirmDeleteOpen}
        title={t('dashboard.branches.confirmDeleteTitle')}
        description={t('dashboard.branches.confirmDeleteDesc')}
        itemName={activeBranch?.name ?? t('dashboard.branches.title')}
        loading={deletingId === activeId}
        onConfirm={() => void deleteBranch()}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </>
  );
}
