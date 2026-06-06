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

type BranchRow = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  createdAt: string;
};

export function BranchedPage() {
  const [branches, setBranches] = useState<BranchRow[]>([]);
  /** `null` from API means unlimited (Scale). */
  const [maxBranches, setMaxBranches] = useState<number | null>(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');

  const [confirmAddOpen, setConfirmAddOpen] = useState(false);
  const [confirmEditOpen, setConfirmEditOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    (async () => {
      try {
        const [res, subRes] = await Promise.all([
          axios.get<{ data: BranchRow[] }>('/api/restaurant/branches'),
          axios.get<{
            data?: { limits?: { maxBranches?: number | null } };
          }>('/api/me/subscription-access'),
        ]);
        setBranches(res.data.data ?? []);
        const cap = subRes.data?.data?.limits?.maxBranches;
        setMaxBranches(typeof cap === 'number' ? cap : cap === null ? null : 1);
      } catch {
        toast.error('Could not load branches');
        setBranches([]);
      } finally {
        setLoading(false);
      }
    })();
  };

  useEffect(() => {
    void load();
  }, []);

  const activeBranch = branches.find((b) => b.id === activeId) ?? null;
  const cannotDeleteLastBranch = branches.length <= 1;
  const branchCap =
    maxBranches === null ? Number.POSITIVE_INFINITY : maxBranches;
  const atBranchLimit = branches.length >= branchCap;

  function resetForm() {
    setActiveId(null);
    setName('');
    setAddress('');
    setPhone('');
  }

  function startEdit(branch: BranchRow) {
    setActiveId(branch.id);
    setName(branch.name);
    setAddress(branch.address ?? '');
    setPhone(branch.phone ?? '');
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
            <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
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
              {branches.length <= 1 ? (
                <p className="text-xs text-amber-600">
                  You must keep at least one branch.
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
                      {b.address || 'No address'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {b.phone || 'No phone'}
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
