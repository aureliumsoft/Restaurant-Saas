'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Loader2, Pencil, RefreshCcw, Trash2, UserPlus, X } from 'lucide-react';

import { RESTAURANT_ROLE_SLUG } from '@/lib/restaurant-roles';
import { PremiumDisabledControl } from '@/components/premium/premium-disabled-control';
import { useEntitlements } from '@/hooks/use-entitlements';
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
import { dashboardCardClass } from '@/components/dashboard/dashboard-surface';
import { TablePagination } from '@/components/ui/table-pagination';
import { useBranchContext } from '@/hooks/use-branch-context';
import {
  DashboardTable as Table,
  DashboardTableBody as TableBody,
  DashboardTableCell as TableCell,
  DashboardTableHead as TableHead,
  DashboardTableHeader as TableHeader,
  DashboardTableRow as TableRow,
  DashboardTableWrapper as TableWrapper,
} from '@/components/dashboard/dashboard-table';

const settingsCardClass = `${dashboardCardClass} my-5 min-w-0 w-full max-w-full overflow-hidden`;

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
  const { t } = useTranslation();
  const { isOwnerOrAdmin } = useBranchContext();
  const { canCreateMore, canCreateMorePerBranch } = useEntitlements();
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [branchOptions, setBranchOptions] = useState<BranchOption[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [inviteBranchId, setInviteBranchId] = useState('');
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
      toast.error(t('settings.cards.users.offline'));
      return;
    }
    setLoading(true);
    try {
      const [empRes, branchRes] = await Promise.all([
        axios.get<{
          employees: EmployeeRow[];
          pendingInvites: PendingInvite[];
          pagination?: {
            page: number;
            pageSize: number;
            total: number;
            totalPages: number;
          };
        }>('/api/restaurant/employees', {
          params: { page, limit: 20 },
        }),
        axios.get<{ data?: BranchOption[] }>('/api/restaurant/branches'),
        loadAssignableRoles(),
      ]);
      setEmployees(empRes.data.employees ?? []);
      setPendingInvites(empRes.data.pendingInvites ?? []);
      if (empRes.data.pagination) setPagination(empRes.data.pagination);
      setBranchOptions(branchRes.data.data ?? []);
    } catch (e: any) {
      toast.error(
        e.response?.data?.error ??
          e.message ??
          t('settings.cards.users.loadFailed')
      );
      setEmployees([]);
      setPendingInvites([]);
    } finally {
      setLoading(false);
    }
  }, [loadAssignableRoles, page, t]);

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
      return t('settings.cards.users.allBranches');
    }
    const ids = emp.branchIds ?? [];
    if (ids.length === 0) return t('settings.cards.users.noBranchAssigned');
    const names = ids
      .map((id) => branchOptions.find((b) => b.id === id)?.name)
      .filter((name): name is string => Boolean(name));
    return names.length > 0 ? names.join(', ') : '—';
  }

  function pendingInviteBranchLabel(invite: PendingInvite) {
    if (invite.branchIds.length === 0) {
      return t('settings.cards.users.allBranches');
    }
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
      toast.error(t('settings.cards.users.enterEmail'));
      return;
    }
    if (!roleId) {
      toast.error(t('settings.cards.users.selectRole'));
      return;
    }
    if (password.length < 8) {
      toast.error(t('settings.cards.users.passwordTooShort'));
      return;
    }
    if (password !== confirmPassword) {
      toast.error(t('settings.cards.users.passwordMismatch'));
      return;
    }
    if (inviteRequiresBranch && !inviteBranchId) {
      toast.error(t('settings.cards.users.selectBranchForMember'));
      return;
    }
    if (!navigator.onLine) {
      toast.error(t('settings.cards.users.offline'));
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
            ? t('settings.cards.users.invitationEmailSent')
            : t('settings.cards.users.teamMemberAdded');
      if (res.data?.emailDelivered === false) {
        toast.warning(msg);
        if (
          typeof res.data?.manualInviteUrl === 'string' &&
          res.data.manualInviteUrl.length > 0
        ) {
          toast.info(
            t('settings.cards.users.inviteLinkCopy', {
              url: res.data.manualInviteUrl,
            }),
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
          : d?.error?.formErrors?.[0] ??
            err.message ??
            t('settings.cards.users.requestFailed')
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function saveEmployeeBranchEdit() {
    if (!branchEditEmployee) return;
    if (!editBranchId) {
      toast.error(t('settings.cards.users.selectBranch'));
      return;
    }
    if (!navigator.onLine) {
      toast.error(t('settings.cards.users.offline'));
      return;
    }
    setSavingEmployeeId(branchEditEmployee.id);
    try {
      await axios.patch(`/api/restaurant/employees/${branchEditEmployee.id}`, {
        branchIds: [editBranchId],
      });
      toast.success(t('settings.cards.users.branchAssignmentUpdated'));
      setBranchEditEmployee(null);
      setEditBranchId('');
      await fetchAll();
    } catch (err: any) {
      toast.error(
        typeof err.response?.data?.error === 'string'
          ? err.response.data.error
          : err.message ?? t('settings.cards.users.couldNotUpdateBranch')
      );
    } finally {
      setSavingEmployeeId(null);
    }
  }

  async function updateEmployeeRole(employeeId: string, newRoleId: string) {
    if (!navigator.onLine) {
      toast.error(t('settings.cards.users.offline'));
      return;
    }
    setSavingEmployeeId(employeeId);
    try {
      await axios.patch(`/api/restaurant/employees/${employeeId}`, {
        roleId: newRoleId,
      });
      toast.success(t('settings.cards.users.roleUpdated'));
      await fetchAll();
    } catch (err: any) {
      toast.error(
        typeof err.response?.data?.error === 'string'
          ? err.response.data.error
          : err.message ?? t('settings.cards.users.couldNotUpdateRole')
      );
    } finally {
      setSavingEmployeeId(null);
    }
  }

  async function removeEmployee(employeeId: string) {
    if (!navigator.onLine) {
      toast.error(t('settings.cards.users.offline'));
      return;
    }
    setRemovingEmployeeId(employeeId);
    try {
      await axios.delete(`/api/restaurant/employees/${employeeId}`);
      toast.success(t('settings.cards.users.removedFromTeam'));
      setConfirmAction(null);
      await fetchAll();
    } catch (err: any) {
      toast.error(
        typeof err.response?.data?.error === 'string'
          ? err.response.data.error
          : err.message ?? t('settings.cards.users.couldNotRemove')
      );
    } finally {
      setRemovingEmployeeId(null);
      setConfirmLoading(false);
    }
  }

  async function cancelInvite(inviteId: string) {
    if (!navigator.onLine) {
      toast.error(t('settings.cards.users.offline'));
      return;
    }
    setCancellingInviteId(inviteId);
    try {
      await axios.delete(`/api/restaurant/invites/${inviteId}`);
      toast.success(t('settings.cards.users.invitationCancelled'));
      setConfirmAction(null);
      await fetchAll();
    } catch (err: any) {
      toast.error(
        typeof err.response?.data?.error === 'string'
          ? err.response.data.error
          : err.message ?? t('settings.cards.users.couldNotCancelInvite')
      );
    } finally {
      setCancellingInviteId(null);
      setConfirmLoading(false);
    }
  }

  async function handleConfirmAction() {
    if (!confirmAction || confirmLoading) return;
    if (!navigator.onLine) {
      toast.error(t('settings.cards.users.offline'));
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
    <Card className={settingsCardClass}>
      <CardHeader className="min-w-0">
        <CardTitle>{t('settings.cards.users.title')}</CardTitle>
        <CardDescription>{t('settings.cards.users.description')}</CardDescription>
        {!roleBasedSettingsAllowed ? (
          <p className="text-sm text-muted-foreground">
            {t('settings.cards.users.starterHint')}
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="min-w-0 space-y-6">
        <div className="grid min-w-0 gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-medium" htmlFor="member-email">
              {t('settings.cards.users.emailLabel')}
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
              {t('settings.cards.users.nameLabel')}
            </label>
            <Input
              id="member-name"
              placeholder={t('settings.cards.users.namePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-medium" htmlFor="member-password">
              {t('settings.cards.users.passwordLabel')}
            </label>
            <Input
              id="member-password"
              type="password"
              autoComplete="new-password"
              placeholder={t('settings.cards.users.passwordPlaceholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-medium" htmlFor="member-password2">
              {t('settings.cards.users.confirmPasswordLabel')}
            </label>
            <Input
              id="member-password2"
              type="password"
              autoComplete="new-password"
              placeholder={t('settings.cards.users.confirmPasswordPlaceholder')}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="member-role">
              {t('settings.cards.users.roleLabel')}
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
                  {r.slug === RESTAURANT_ROLE_SLUG.ADMIN
                    ? ` ${t('settings.cards.users.presetSuffix')}`
                    : ''}
                </option>
              ))}
            </select>
          </div>
          {branchOptions.length > 0 && inviteRequiresBranch ? (
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium" htmlFor="member-branch">
                {t('settings.cards.users.branchLabel')}
              </label>
              <select
                id="member-branch"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={inviteBranchId}
                onChange={(e) => setInviteBranchId(e.target.value)}
              >
                <option value="">
                  {t('settings.cards.users.selectBranchPlaceholder')}
                </option>
                {branchOptions.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="sm:col-span-2 lg:col-span-1">
            <PremiumDisabledControl
              locked={(() => {
                const branchCount = Math.max(1, branchOptions.length);
                if (inviteBranchId) {
                  const onBranch =
                    employees.filter(
                      (e) =>
                        !e.isOwner && e.branchIds.includes(inviteBranchId)
                    ).length +
                    pendingInvites.filter((p) =>
                      p.branchIds.includes(inviteBranchId)
                    ).length;
                  return !canCreateMore('users', onBranch);
                }
                const totalSeats =
                  employees.filter((e) => !e.isOwner).length +
                  pendingInvites.length;
                return !canCreateMorePerBranch(
                  'users',
                  totalSeats,
                  branchCount
                );
              })()}
              label={t('settings.cards.users.addInvite')}
              className="w-full"
            >
              <Button
                type="button"
                className="w-full text-white"
                disabled={submitting || roles.length === 0}
                onClick={() => void handleAdd()}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    {t('settings.cards.users.addInvite')}
                  </>
                )}
              </Button>
            </PremiumDisabledControl>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">
            <Loader2 className=" animate-spin text-primary text-center mx-auto" />{' '}
          </p>
        ) : (
          <>
            {pendingInvites.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">
                  {t('settings.cards.users.pendingInvitations')}
                </h3>
                <TableWrapper>
                  <Table minWidth={640}>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('settings.cards.users.colEmail')}</TableHead>
                        <TableHead>{t('settings.cards.users.colRole')}</TableHead>
                        <TableHead className="hidden sm:table-cell">
                          {t('settings.cards.users.colBranches')}
                        </TableHead>
                        <TableHead className="text-right">
                          {t('settings.cards.users.colActions')}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingInvites.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="max-w-[10rem] whitespace-normal break-all sm:max-w-none">
                            {p.email}
                          </TableCell>
                          <TableCell>{p.role.name}</TableCell>
                          <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                            {pendingInviteBranchLabel(p)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
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
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                              <span className="sr-only">
                                {t('settings.cards.users.cancelInvitationButton')}
                              </span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableWrapper>
              </div>
            ) : null}

            <div className="space-y-2">
              <h3 className="text-sm font-medium">
                {t('settings.cards.users.peopleTitle')}
              </h3>
              {employees.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('settings.cards.users.noEmployeesLoaded')}
                </p>
              ) : (
                <div className="space-y-4">
                <TableWrapper>
                  <Table minWidth={720}>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('settings.cards.users.colName')}</TableHead>
                        <TableHead className="hidden md:table-cell">
                          {t('settings.cards.users.colEmail')}
                        </TableHead>
                        <TableHead>{t('settings.cards.users.colRole')}</TableHead>
                        <TableHead className="hidden sm:table-cell">
                          {t('settings.cards.users.colBranches')}
                        </TableHead>
                        <TableHead className="text-right">
                          {t('settings.cards.users.colActions')}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employees.map((emp) => (
                        <TableRow key={emp.id}>
                          <TableCell className="whitespace-normal font-medium">
                            <div className="min-w-0">
                              <div>{emp.name}</div>
                              <div className="mt-0.5 text-xs text-muted-foreground md:hidden">
                                {emp.email ?? '—'}
                              </div>
                              {emp.isOwner ? (
                                <span className="text-xs text-muted-foreground">
                                  {t('settings.cards.users.ownerTag')}
                                </span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {emp.email ?? '—'}
                          </TableCell>
                          <TableCell>
                            {emp.isOwner ? (
                              <span className="text-sm text-muted-foreground">
                                {emp.role.name}
                              </span>
                            ) : (
                              <select
                                className="h-9 w-full min-w-0 max-w-full rounded-md border border-input bg-background px-2 text-sm sm:max-w-[11rem]"
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
                          <TableCell className="hidden sm:table-cell">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="min-w-0 text-sm text-muted-foreground">
                                {employeeBranchLabel(emp)}
                              </span>
                              {canEditEmployeeBranches(emp) ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 shrink-0"
                                  title={t('settings.cards.users.changeBranchTitle')}
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
                                size="sm"
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
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                                <span className="sr-only">
                                  {t('settings.cards.users.removeTeamMemberSr')}
                                </span>
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableWrapper>
                <TablePagination
                  pagination={pagination}
                  page={page}
                  onPageChange={setPage}
                  loading={loading}
                />
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
      <CardFooter className="border-t px-6 py-4">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => void fetchAll()}
          disabled={loading}
        >
          {loading ? (
            
              <RefreshCcw className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
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
        <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {t('settings.cards.users.changeBranchAssignment')}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {branchEditEmployee ? (
              <>
                {t('settings.cards.users.assignBranchPrefix')}{' '}
                <strong>{branchEditEmployee.name}</strong>{' '}
                {t('settings.cards.users.assignBranchSuffix')}
              </>
            ) : null}
          </p>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={editBranchId}
            onChange={(e) => setEditBranchId(e.target.value)}
            disabled={Boolean(savingEmployeeId)}
          >
            <option value="">
              {t('settings.cards.users.selectBranchPlaceholder')}
            </option>
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
              {t('dashboard.common.cancel')}
            </Button>
            <Button
              type="button"
              disabled={Boolean(savingEmployeeId)}
              onClick={() => void saveEmployeeBranchEdit()}
            >
              {savingEmployeeId ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t('dashboard.common.save')
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
                ? t('settings.cards.users.removeTeamMemberTitle')
                : t('settings.cards.users.cancelInvitationTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.kind === 'remove' ? (
                <>
                  {t('settings.cards.users.removeConfirmPrefix')}{' '}
                  <strong>{confirmAction.employee.name}</strong>
                  {confirmAction.employee.email ? (
                    <> ({confirmAction.employee.email})</>
                  ) : null}{' '}
                  {t('settings.cards.users.removeConfirmSuffix')}
                </>
              ) : confirmAction?.kind === 'cancel_invite' ? (
                <>
                  {t('settings.cards.users.cancelInviteConfirmPrefix')}{' '}
                  <strong>{confirmAction.invite.email}</strong>
                  {t('settings.cards.users.cancelInviteConfirmSuffix')}
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmLoading}>
              <X className="h-4 w-4 mr-2" />
              {t('settings.cards.users.keepButton')}
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
                    ? t('settings.cards.users.removingEllipsis')
                    : t('settings.cards.users.cancellingEllipsis')}
                </>
              ) : confirmAction?.kind === 'remove' ? (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  <span>{t('settings.cards.users.removeButton')}</span>
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  <span>{t('settings.cards.users.cancelInvitationButton')}</span>
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
