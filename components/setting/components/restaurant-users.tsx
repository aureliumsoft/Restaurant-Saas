'use client';

import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Loader2, Pencil, RefreshCcw, Trash2, UserPlus, X } from 'lucide-react';

import { RESTAURANT_ROLE_SLUG } from '@/lib/restaurant-roles';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type RoleOption = { id: string; name: string; slug?: string | null };
type BranchOption = { id: string; name: string };

type EmployeeRow = {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  role: { id: string; name: string; slug?: string | null };
  isOwner: boolean;
  branchIds: string[];
};

type PendingInvite = {
  id: string;
  email: string;
  role: { id: string; name: string };
  branchIds: string[];
  expiresAt: string;
};

type RestaurantUsersCardProps = {
  roleBasedSettingsAllowed?: boolean;
};

type ConfirmAction =
  | { kind: 'remove'; employee: EmployeeRow }
  | { kind: 'cancel_invite'; invite: PendingInvite };

export default function RestaurantUsersCard({
  roleBasedSettingsAllowed = true,
}: RestaurantUsersCardProps) {
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [branchOptions, setBranchOptions] = useState<BranchOption[]>([]);
  const [inviteBranchId, setInviteBranchId] = useState('');
  const [isOwnerOrAdmin, setIsOwnerOrAdmin] = useState(false);
  const [branchEditEmployee, setBranchEditEmployee] =
    useState<EmployeeRow | null>(null);
  const [editBranchId, setEditBranchId] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [roleId, setRoleId] = useState('');
  const [savingEmployeeId, setSavingEmployeeId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [removingEmployeeId, setRemovingEmployeeId] = useState<string | null>(
    null
  );
  const [cancellingInviteId, setCancellingInviteId] = useState<string | null>(
    null
  );

  const loadAssignableRoles = useCallback(async () => {
    const res = await axios.get<{ roles: RoleOption[] }>(
      '/api/restaurant/roles'
    );
    const all = res.data.roles ?? [];
    const list = !roleBasedSettingsAllowed
      ? all.filter((r) => r.slug === RESTAURANT_ROLE_SLUG.ADMIN)
      : all.filter(
          (r) =>
            r.slug !== RESTAURANT_ROLE_SLUG.ADMIN &&
            r.slug !== RESTAURANT_ROLE_SLUG.OWNER
        );
    setRoles(list);
    setRoleId((prev) => {
      if (prev && list.some((r) => r.id === prev)) return prev;
      return list[0]?.id ?? '';
    });
  }, [roleBasedSettingsAllowed]);

  const fetchAll = useCallback(async () => {
    if (!navigator.onLine) {
      toast.error('You are offline.');
      return;
    }
    setLoading(true);
    try {
      const [empRes, branchRes, branchCtxRes] = await Promise.all([
        axios.get<{
          employees: EmployeeRow[];
          pendingInvites: PendingInvite[];
        }>('/api/restaurant/employees'),
        axios.get<{ data?: BranchOption[] }>('/api/restaurant/branches'),
        axios.get<{ data?: { isOwnerOrAdmin?: boolean } }>(
          '/api/me/branch-context'
        ),
        loadAssignableRoles(),
      ]);
      setEmployees(empRes.data.employees ?? []);
      setPendingInvites(empRes.data.pendingInvites ?? []);
      setBranchOptions(branchRes.data.data ?? []);
      setIsOwnerOrAdmin(Boolean(branchCtxRes.data.data?.isOwnerOrAdmin));
    } catch (e: any) {
      toast.error(
        e.response?.data?.error ?? e.message ?? 'Failed to load team members.'
      );
      setEmployees([]);
      setPendingInvites([]);
    } finally {
      setLoading(false);
    }
  }, [loadAssignableRoles]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const selectedInviteRole = roles.find((r) => r.id === roleId);
  const inviteRequiresBranch =
    selectedInviteRole?.slug !== RESTAURANT_ROLE_SLUG.ADMIN;

  useEffect(() => {
    if (!inviteRequiresBranch) {
      setInviteBranchId('');
    }
  }, [inviteRequiresBranch]);

  function employeeBranchLabel(emp: EmployeeRow) {
    if (
      emp.isOwner ||
      emp.role.slug === RESTAURANT_ROLE_SLUG.ADMIN ||
      emp.role.slug === RESTAURANT_ROLE_SLUG.OWNER
    ) {
      return 'All branches';
    }
    const ids = emp.branchIds ?? [];
    if (ids.length === 0) return 'No branch assigned';
    const names = ids
      .map((id) => branchOptions.find((b) => b.id === id)?.name)
      .filter((name): name is string => Boolean(name));
    return names.length > 0 ? names.join(', ') : '—';
  }

  function pendingInviteBranchLabel(invite: PendingInvite) {
    if (invite.branchIds.length === 0) return 'All branches';
    const names = invite.branchIds
      .map((id) => branchOptions.find((b) => b.id === id)?.name)
      .filter((name): name is string => Boolean(name));
    return names.length > 0 ? names.join(', ') : '—';
  }

  function canEditEmployeeBranches(emp: EmployeeRow) {
    return (
      isOwnerOrAdmin &&
      !emp.isOwner &&
      emp.role.slug !== RESTAURANT_ROLE_SLUG.ADMIN &&
      emp.role.slug !== RESTAURANT_ROLE_SLUG.OWNER
    );
  }

  function openBranchEdit(emp: EmployeeRow) {
    setBranchEditEmployee(emp);
    setEditBranchId(emp.branchIds[0] ?? '');
  }

  async function handleAdd() {
    const e = email.trim().toLowerCase();
    if (!e) {
      toast.error('Enter an email address.');
      return;
    }
    if (!roleId) {
      toast.error('Select a role.');
      return;
    }
    if (password.length < 8) {
      toast.error(
        'Password must be at least 8 characters (used for new accounts).'
      );
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Password and confirmation do not match.');
      return;
    }
    if (inviteRequiresBranch && !inviteBranchId) {
      toast.error('Select a branch for this team member.');
      return;
    }
    if (!navigator.onLine) {
      toast.error('You are offline.');
      return;
    }
    setSubmitting(true);
    try {
      const payload: {
        email: string;
        roleId: string;
        password: string;
        name?: string;
        branchIds?: string[];
      } = {
        email: e,
        roleId,
        password,
        branchIds: inviteBranchId ? [inviteBranchId] : [],
      };
      const nm = name.trim();
      if (nm.length >= 2) {
        payload.name = nm;
      }
      const res = await axios.post('/api/restaurant/employees', payload);
      const msg =
        typeof res.data?.message === 'string'
          ? res.data.message
          : res.data?.flow === 'invite_sent'
            ? 'Invitation email sent.'
            : 'Team member added.';
      if (res.data?.emailDelivered === false) {
        toast.warning(msg);
        if (
          typeof res.data?.manualInviteUrl === 'string' &&
          res.data.manualInviteUrl.length > 0
        ) {
          toast.info(
            `Invite link (copy to user): ${res.data.manualInviteUrl}`,
            { autoClose: 20000 }
          );
        }
        if (typeof res.data?.emailError === 'string') {
          toast.error(res.data.emailError, { autoClose: 12000 });
        }
      } else {
        toast.success(msg);
      }
      setEmail('');
      setName('');
      setPassword('');
      setConfirmPassword('');
      setInviteBranchId('');
      await fetchAll();
    } catch (err: any) {
      const d = err.response?.data;
      toast.error(
        typeof d?.error === 'string'
          ? d.error
          : d?.error?.formErrors?.[0] ?? err.message ?? 'Request failed.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function saveEmployeeBranchEdit() {
    if (!branchEditEmployee) return;
    if (!editBranchId) {
      toast.error('Select a branch.');
      return;
    }
    if (!navigator.onLine) {
      toast.error('You are offline.');
      return;
    }
    setSavingEmployeeId(branchEditEmployee.id);
    try {
      await axios.patch(`/api/restaurant/employees/${branchEditEmployee.id}`, {
        branchIds: [editBranchId],
      });
      toast.success('Branch assignment updated.');
      setBranchEditEmployee(null);
      setEditBranchId('');
      await fetchAll();
    } catch (err: any) {
      toast.error(
        typeof err.response?.data?.error === 'string'
          ? err.response.data.error
          : err.message ?? 'Could not update branch.'
      );
    } finally {
      setSavingEmployeeId(null);
    }
  }

  async function updateEmployeeRole(employeeId: string, newRoleId: string) {
    if (!navigator.onLine) {
      toast.error('You are offline.');
      return;
    }
    setSavingEmployeeId(employeeId);
    try {
      await axios.patch(`/api/restaurant/employees/${employeeId}`, {
        roleId: newRoleId,
      });
      toast.success('Role updated.');
      await fetchAll();
    } catch (err: any) {
      toast.error(
        typeof err.response?.data?.error === 'string'
          ? err.response.data.error
          : err.message ?? 'Could not update role.'
      );
    } finally {
      setSavingEmployeeId(null);
    }
  }

  async function removeEmployee(employeeId: string) {
    if (!navigator.onLine) {
      toast.error('You are offline.');
      return;
    }
    setRemovingEmployeeId(employeeId);
    try {
      await axios.delete(`/api/restaurant/employees/${employeeId}`);
      toast.success('Removed from team.');
      setConfirmAction(null);
      await fetchAll();
    } catch (err: any) {
      toast.error(
        typeof err.response?.data?.error === 'string'
          ? err.response.data.error
          : err.message ?? 'Could not remove.'
      );
    } finally {
      setRemovingEmployeeId(null);
      setConfirmLoading(false);
    }
  }

  async function cancelInvite(inviteId: string) {
    if (!navigator.onLine) {
      toast.error('You are offline.');
      return;
    }
    setCancellingInviteId(inviteId);
    try {
      await axios.delete(`/api/restaurant/invites/${inviteId}`);
      toast.success('Invitation cancelled.');
      setConfirmAction(null);
      await fetchAll();
    } catch (err: any) {
      toast.error(
        typeof err.response?.data?.error === 'string'
          ? err.response.data.error
          : err.message ?? 'Could not cancel invite.'
      );
    } finally {
      setCancellingInviteId(null);
      setConfirmLoading(false);
    }
  }

  async function handleConfirmAction() {
    if (!confirmAction || confirmLoading) return;
    if (!navigator.onLine) {
      toast.error('You are offline.');
      return;
    }
    setConfirmLoading(true);
    if (confirmAction.kind === 'remove') {
      await removeEmployee(confirmAction.employee.id);
    } else {
      await cancelInvite(confirmAction.invite.id);
    }
  }

  return (
    <Card className="my-5">
      <CardHeader>
        <CardTitle>Team members</CardTitle>
        <CardDescription>
          Add people by email and set a password they can use to sign in. If the
          email already has an account, only the invite is sent—password is
          ignored and they accept in email.
        </CardDescription>
        {!roleBasedSettingsAllowed ? (
          <p className="text-sm text-muted-foreground">
            On Starter, new invites use the <strong>Admin</strong> role only.
            Custom roles and permission presets are available on Growth and
            Scale.
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-medium" htmlFor="member-email">
              Email
            </label>
            <Input
              id="member-email"
              type="email"
              autoComplete="off"
              placeholder="colleague@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-medium" htmlFor="member-name">
              Name (required only for new accounts)
            </label>
            <Input
              id="member-name"
              placeholder="e.g. Sam Lee"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-medium" htmlFor="member-password">
              Password (for new accounts)
            </label>
            <Input
              id="member-password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-medium" htmlFor="member-password2">
              Confirm password
            </label>
            <Input
              id="member-password2"
              type="password"
              autoComplete="new-password"
              placeholder="Repeat password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="member-role">
              Role
            </label>
            <select
              id="member-role"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              disabled={roles.length === 0}
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.slug === RESTAURANT_ROLE_SLUG.ADMIN ? ' (preset)' : ''}
                </option>
              ))}
            </select>
          </div>
          {branchOptions.length > 0 && inviteRequiresBranch ? (
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium" htmlFor="member-branch">
                Branch
              </label>
              <select
                id="member-branch"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={inviteBranchId}
                onChange={(e) => setInviteBranchId(e.target.value)}
              >
                <option value="">Select branch…</option>
                {branchOptions.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          
            <Button
              type="button"
              className="text-white"
              disabled={submitting || roles.length === 0}
              onClick={() => void handleAdd()}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add / invite
                </>
              )}
            </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">
            <Loader2 className=" animate-spin text-primary text-center mx-auto" />{' '}
          </p>
        ) : (
          <>
            {pendingInvites.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Pending invitations</h3>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Branches</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingInvites.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>{p.email}</TableCell>
                          <TableCell>{p.role.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {pendingInviteBranchLabel(p)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              className="text-destructive"
                              disabled={
                                cancellingInviteId === p.id || confirmLoading
                              }
                              onClick={() =>
                                setConfirmAction({
                                  kind: 'cancel_invite',
                                  invite: p,
                                })
                              }
                            >
                              {cancellingInviteId === p.id ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  <span>Cancelling…</span>
                                </>
                              ) : (
                                <>
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  <span>Cancel</span>
                                </>
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <h3 className="text-sm font-medium">People</h3>
              {employees.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No employees loaded.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Branches</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employees.map((emp) => (
                        <TableRow key={emp.id}>
                          <TableCell className="font-medium">
                            {emp.name}
                            {emp.isOwner ? (
                              <span className="ml-2 text-xs text-muted-foreground">
                                (owner)
                              </span>
                            ) : null}
                          </TableCell>
                          <TableCell>{emp.email ?? '—'}</TableCell>
                          <TableCell>
                            {emp.isOwner ? (
                              <span className="text-sm text-muted-foreground">
                                {emp.role.name}
                              </span>
                            ) : (
                              <select
                                className="h-9 max-w-[220px] rounded-md border border-input bg-background px-2 text-sm"
                                value={emp.role.id}
                                disabled={
                                  savingEmployeeId === emp.id ||
                                  roles.length === 0
                                }
                                onChange={(e) =>
                                  void updateEmployeeRole(
                                    emp.id,
                                    e.target.value
                                  )
                                }
                              >
                                {(roles.some((r) => r.id === emp.role.id)
                                  ? roles
                                  : [
                                      ...roles,
                                      {
                                        id: emp.role.id,
                                        name: emp.role.name,
                                        slug: emp.role.slug,
                                      },
                                    ]
                                ).map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.name}
                                  </option>
                                ))}
                              </select>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">
                                {employeeBranchLabel(emp)}
                              </span>
                              {canEditEmployeeBranches(emp) ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 shrink-0"
                                  title="Change branch"
                                  disabled={savingEmployeeId === emp.id}
                                  onClick={() => openBranchEdit(emp)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {emp.isOwner ? (
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
                            ) : (
                              <Button
                                type="button"
                                variant="ghost"
                                className="text-destructive"
                                disabled={
                                  removingEmployeeId === emp.id ||
                                  confirmLoading
                                }
                                onClick={() =>
                                  setConfirmAction({
                                    kind: 'remove',
                                    employee: emp,
                                  })
                                }
                              >
                                {removingEmployeeId === emp.id ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    <span>Removing…</span>
                                  </>
                                ) : (
                                  <>
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    <span>Remove</span>
                                  </>
                                )}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
      <CardFooter className="border-t px-6 py-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => void fetchAll()}
          disabled={loading}
        >
          {loading ? (
            <>
              <RefreshCcw className="h-4 w-4 mr-2 animate-spin" />{' '}
              <span>Refreshing...</span>
            </>
          ) : (
            <>
              <RefreshCcw className="h-4 w-4 mr-2" /> <span>Refresh</span>
            </>
          )}
        </Button>
      </CardFooter>

      <Dialog
        open={!!branchEditEmployee}
        onOpenChange={(open) => {
          if (!open && !savingEmployeeId) {
            setBranchEditEmployee(null);
            setEditBranchId('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change branch assignment</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {branchEditEmployee ? (
              <>
                Assign <strong>{branchEditEmployee.name}</strong> to a branch.
                They will only see data for that branch.
              </>
            ) : null}
          </p>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={editBranchId}
            onChange={(e) => setEditBranchId(e.target.value)}
            disabled={Boolean(savingEmployeeId)}
          >
            <option value="">Select branch…</option>
            {branchOptions.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={Boolean(savingEmployeeId)}
              onClick={() => {
                setBranchEditEmployee(null);
                setEditBranchId('');
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={Boolean(savingEmployeeId)}
              onClick={() => void saveEmployeeBranchEdit()}
            >
              {savingEmployeeId ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Save'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!confirmAction}
        onOpenChange={(open) => {
          if (!open && !confirmLoading) setConfirmAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.kind === 'remove'
                ? 'Remove team member?'
                : 'Cancel invitation?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.kind === 'remove' ? (
                <>
                  Remove <strong>{confirmAction.employee.name}</strong>
                  {confirmAction.employee.email ? (
                    <> ({confirmAction.employee.email})</>
                  ) : null}{' '}
                  from this restaurant? They will lose access immediately.
                </>
              ) : confirmAction?.kind === 'cancel_invite' ? (
                <>
                  Cancel the pending invitation for{' '}
                  <strong>{confirmAction.invite.email}</strong>? They will not
                  be able to join using the current invite link.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmLoading}>
              <X className="h-4 w-4 mr-2" />
              Keep
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmAction();
              }}
            >
              {confirmLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {confirmAction?.kind === 'remove'
                    ? 'Removing…'
                    : 'Cancelling…'}
                </>
              ) : confirmAction?.kind === 'remove' ? (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  <span>Remove</span>
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  <span>Cancel invitation</span>
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
