'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';

import {
  DeleteConfirmation,
  SaveConfirmation,
} from '@/components/ui/confirmation-dialogs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { TablePagination } from '@/components/ui/table-pagination';
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
import {
  DEFAULT_SLOT_DURATION_MINUTES,
  SLOT_DURATION_OPTIONS,
  normalizeSlotDurationMinutes,
  type BranchOpeningHours,
  type SlotDurationMinutes,
} from '@/lib/order-time-slots';

type BranchRow = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  openingHours: BranchOpeningHours | null;
  slotDurationMinutes?: number | null;
  createdAt: string;
};

const weekdayLabels = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function createDefaultOpeningHours(): BranchOpeningHours {
  return Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    isOpen: false,
    openTime: '',
    closeTime: '',
  }));
}

function normalizeOpeningHours(
  openingHours: BranchOpeningHours | null | undefined
): BranchOpeningHours {
  const defaults = createDefaultOpeningHours();
  if (!Array.isArray(openingHours) || openingHours.length === 0) {
    return defaults;
  }

  const merged = new Map<number, BranchOpeningHours[number]>();
  openingHours.forEach((entry) => {
    if (typeof entry?.dayOfWeek === 'number') {
      const isOpen = entry.isOpen === true;
      merged.set(entry.dayOfWeek, {
        dayOfWeek: entry.dayOfWeek,
        isOpen,
        openTime: isOpen && typeof entry.openTime === 'string' ? entry.openTime : '',
        closeTime:
          isOpen && typeof entry.closeTime === 'string' ? entry.closeTime : '',
      });
    }
  });

  return defaults.map((entry) => merged.get(entry.dayOfWeek) ?? entry);
}

function formatOpeningHoursSummary(openingHours: BranchOpeningHours | null | undefined) {
  const normalized = normalizeOpeningHours(openingHours);
  const enabledDays = normalized.filter((entry) => entry.isOpen);
  if (enabledDays.length === 0) {
    return 'Closed all week';
  }

  const first = enabledDays[0];
  const label = `${weekdayLabels[first.dayOfWeek]} ${first.openTime}–${first.closeTime}`;
  if (enabledDays.length === 1) {
    return label;
  }
  return `${label} + ${enabledDays.length - 1} more`;
}

export function BranchedPage() {
  const { plan } = useStaffPermissions();
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 12,
    total: 0,
    totalPages: 1,
  });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [openingHours, setOpeningHours] = useState<BranchOpeningHours>(
    createDefaultOpeningHours()
  );
  const [slotDurationMinutes, setSlotDurationMinutes] =
    useState<SlotDurationMinutes>(DEFAULT_SLOT_DURATION_MINUTES);

  const [confirmAddOpen, setConfirmAddOpen] = useState(false);
  const [confirmEditOpen, setConfirmEditOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get<{
        data: BranchRow[];
        pagination?: {
          page: number;
          pageSize: number;
          total: number;
          totalPages: number;
        };
      }>('/api/restaurant/branches', {
        params: { page, limit: 12 },
      });
      setBranches(res.data.data ?? []);
      if (res.data.pagination) setPagination(res.data.pagination);
    } catch {
      toast.error('Could not load branches');
      setBranches([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const activeBranch = branches.find((b) => b.id === activeId) ?? null;
  const cannotDeleteLastBranch = pagination.total <= 1;
  const maxBranches = plan?.maxBranches ?? 1;
  const branchCap =
    maxBranches === null ? Number.POSITIVE_INFINITY : maxBranches;
  const atBranchLimit = pagination.total >= branchCap;

  function resetForm() {
    setActiveId(null);
    setName('');
    setAddress('');
    setPhone('');
    setOpeningHours(createDefaultOpeningHours());
    setSlotDurationMinutes(DEFAULT_SLOT_DURATION_MINUTES);
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
    setSlotDurationMinutes(
      normalizeSlotDurationMinutes(branch.slotDurationMinutes)
    );
  }

  async function createBranch() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.warn('Branch name is required.');
      return;
    }
    if (atBranchLimit) {
      toast.warn(
        'You have reached the branch limit for your subscription plan.'
      );
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
        slotDurationMinutes,
      });
      toast.success('Branch created');
      resetForm();
      setConfirmAddOpen(false);
      await load();
    } catch (e: unknown) {
      const msg =
        axios.isAxiosError(e) && typeof e.response?.data?.error === 'string'
          ? e.response.data.error
          : 'Failed to create branch';
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
      toast.warn('Branch name is required.');
      return;
    }
    setSaving(true);
    try {
      await axios.patch(`/api/restaurant/branches/${branchId}`, {
        name: trimmed,
        address: address.trim(),
        phone: phone.trim(),
        openingHours,
        slotDurationMinutes,
      });
      toast.success('Branch updated');
      resetForm();
      setConfirmEditOpen(false);
      await load();
    } catch (e: unknown) {
      const msg =
        axios.isAxiosError(e) && typeof e.response?.data?.error === 'string'
          ? e.response.data.error
          : 'Failed to update branch';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function deleteBranch() {
    const branchId = activeId;
    if (!branchId) return;
    if (cannotDeleteLastBranch) {
      toast.warn('At least one branch is required.');
      setConfirmDeleteOpen(false);
      return;
    }
    setDeletingId(branchId);
    try {
      await axios.delete(`/api/restaurant/branches/${branchId}`);
      toast.success('Branch deleted');
      resetForm();
      setConfirmDeleteOpen(false);
      await load();
    } catch (e: unknown) {
      const msg =
        axios.isAxiosError(e) && typeof e.response?.data?.error === 'string'
          ? e.response.data.error
          : 'Failed to delete branch';
      toast.error(msg);
    } finally {
      setDeletingId(null);
      setActiveId(null);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-2 mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Branches</h1>
        <p className="text-sm text-muted-foreground space-y-2">
          Add, edit, and delete your branches here. You can add up to{' '}
          {maxBranches === null ? 'unlimited' : maxBranches} branches.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Branch Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!loading && atBranchLimit && !activeId ? (
            <p className="rounded-md border border-dashed border-destructive p-3 text-sm text-destructive bg-destructive/10">
              Your plan allows{' '}
              {maxBranches === null
                ? 'unlimited'
                : `${maxBranches} location${maxBranches === 1 ? '' : 's'}`}
              . Upgrade to Growth or Scale on Pricing to add more branches.
            </p>
          ) : null}
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              placeholder="Branch name *"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              placeholder="Address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            <Input
              type="tel"
              placeholder="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
            />
          </div>
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-medium">Weekly opening hours</p>
                <p className="text-xs text-muted-foreground">
                  Set the hours that customers can choose for later orders.
                </p>
              </div>
              <label className="flex flex-col gap-1 text-sm sm:min-w-[180px]">
                <span className="font-medium">Slot duration</span>
                <select
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={slotDurationMinutes}
                  onChange={(event) =>
                    setSlotDurationMinutes(
                      normalizeSlotDurationMinutes(Number(event.target.value))
                    )
                  }
                >
                  {SLOT_DURATION_OPTIONS.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes} minutes
                    </option>
                  ))}
                </select>
                <span className="text-xs text-muted-foreground">
                  Order page time slots use this length.
                </span>
              </label>
            </div>
            <div className="space-y-2">
              {openingHours.map((entry) => {
                const isClosed = !entry.isOpen;
                return (
                  <div
                    key={entry.dayOfWeek}
                    className="grid gap-2 sm:grid-cols-[140px_90px_120px_120px] items-center"
                  >
                    <span className="text-sm">{weekdayLabels[entry.dayOfWeek]}</span>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={isClosed}
                        onChange={(event) => {
                          const closed = event.target.checked;
                          updateOpeningHour(entry.dayOfWeek, {
                            isOpen: !closed,
                            openTime: closed ? '' : entry.openTime || '09:00',
                            closeTime: closed ? '' : entry.closeTime || '17:00',
                          });
                        }}
                      />
                      Close
                    </label>
                    {isClosed ? (
                      <>
                        <Input type="time" value="" disabled placeholder="—" />
                        <Input type="time" value="" disabled placeholder="—" />
                      </>
                    ) : (
                      <>
                        <Input
                          type="time"
                          value={entry.openTime}
                          onChange={(event) =>
                            updateOpeningHour(entry.dayOfWeek, {
                              openTime: event.target.value,
                            })
                          }
                        />
                        <Input
                          type="time"
                          value={entry.closeTime}
                          onChange={(event) =>
                            updateOpeningHour(entry.dayOfWeek, {
                              closeTime: event.target.value,
                            })
                          }
                        />
                      </>
                    )}
                  </div>
                );
              })}
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
                      <span>Updating...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      <span>Update Branch</span>
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
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      <span>Delete Branch</span>
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
                    <span>Cancel</span>
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
                    <span>Adding...</span>
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />{' '}
                    <span>Add New Branch</span>
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
              No branches found yet. Add your first branch now.
            </p>
          ) : (
            <div className="space-y-2">
              {pagination.total <= 1 ? (
                <p className="text-xs text-amber-600">
                  You must keep at least one branch.
                </p>
              ) : null}
              {branches.map((b, index) => {
                const editing = b.id === activeId;
                const displayIndex =
                  (pagination.page - 1) * pagination.pageSize + index + 1;
                return (
                  <div
                    key={b.id}
                    className={`rounded-lg border p-3 ${editing ? 'border-primary' : ''}`}
                  >
                    <p className="text-sm font-semibold">
                      {displayIndex}. {b.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {b.address || 'No address'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {b.phone || 'No phone'}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatOpeningHoursSummary(b.openingHours)}
                      {' · '}
                      {normalizeSlotDurationMinutes(b.slotDurationMinutes)} min slots
                    </p>
                    <div className="mt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => startEdit(b)}
                      >
                        <>
                          <Pencil className="h-4 w-4 mr-2" />
                          <span>Edit</span>
                        </>
                      </Button>
                    </div>
                  </div>
                );
              })}
              <TablePagination
                pagination={pagination}
                page={page}
                onPageChange={setPage}
                loading={loading}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <SaveConfirmation
        open={confirmAddOpen}
        title="Add Branch"
        description="Create this branch now?"
        itemName={name.trim() || 'New branch'}
        loading={saving}
        onConfirm={() => void createBranch()}
        onCancel={() => setConfirmAddOpen(false)}
      />
      <SaveConfirmation
        open={confirmEditOpen}
        title="Update Branch"
        description="Save these branch changes?"
        itemName={(activeBranch?.name ?? name.trim()) || 'Branch'}
        loading={saving}
        onConfirm={() => void updateBranch()}
        onCancel={() => setConfirmEditOpen(false)}
      />
      <DeleteConfirmation
        open={confirmDeleteOpen}
        title="Delete Branch"
        description="This branch will be removed permanently."
        itemName={activeBranch?.name ?? 'Branch'}
        loading={deletingId === activeId}
        onConfirm={() => void deleteBranch()}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </>
  );
}
