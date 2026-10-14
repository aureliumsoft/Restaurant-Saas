'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  ChevronDown,
  Loader2,
  Plus,
  RefreshCcw,
  Save,
  Trash2,
} from 'lucide-react';
import { roleApiPath } from '@/lib/dashboard-paths';
import { DASHBOARD_MODULES } from '@/constant/dashboardModules';
import { PremiumDisabledControl } from '@/components/premium/premium-disabled-control';
import { useEntitlements } from '@/hooks/use-entitlements';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
import { dashboardCardClass } from '@/components/dashboard/dashboard-surface';
import {
  DashboardTable as Table,
  DashboardTableBody as TableBody,
  DashboardTableCell as TableCell,
  DashboardTableHead as TableHead,
  DashboardTableHeader as TableHeader,
  DashboardTableRow as TableRow,
  DashboardTableWrapper as TableWrapper,
} from '@/components/dashboard/dashboard-table';
import {
  rowsFromPermissions,
  toggleModuleAction,
} from '@/lib/dashboard-permissions';
import { RESTAURANT_ROLE_SLUG } from '@/lib/restaurant-roles';
import {
  DeleteConfirmation,
  SaveConfirmation,
} from '@/components/ui/confirmation-dialogs';
import type { PermissionAction } from '@/constant/dashboardModules';

const settingsCardClass = `${dashboardCardClass} my-5 min-w-0 w-full max-w-full overflow-hidden`;

type RoleRow = {
  id: string;
  urlId?: string;
  name: string;
  /** Preset roles: `owner` | `admin`; custom roles omit */
  slug?: string | null;
  permissions: string[];
};

type RolesCardProps = {
  roleBasedSettingsAllowed?: boolean;
};

export default function RolesCard({
  roleBasedSettingsAllowed = true,
}: RolesCardProps) {
  const { t } = useTranslation();
  const { canCreateMore } = useEntitlements();
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, RoleRow>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmSaveId, setConfirmSaveId] = useState<string | null>(null);

  const fetchRoles = useCallback(async () => {
    if (!navigator.onLine) {
      toast.error(t('settings.cards.roles.offline'));
      return;
    }
    setLoading(true);
    try {
      const res = await axios.get<{ roles: RoleRow[] }>(
        '/api/restaurant/roles'
      );
      const list = res.data.roles ?? [];
      setRoles(list);
      const nextDrafts: Record<string, RoleRow> = {};
      for (const r of list) {
        nextDrafts[r.id] = { ...r, permissions: [...r.permissions] };
      }
      setDrafts(nextDrafts);
    } catch (e: any) {
      toast.error(
        e.response?.data?.error ?? e.message ?? t('settings.cards.roles.loadFailed')
      );
      setRoles([]);
      setDrafts({});
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchRoles();
  }, [fetchRoles]);

  const updateDraft = (id: string, patch: Partial<RoleRow>) => {
    setDrafts((d) => ({
      ...d,
      [id]: { ...d[id], ...patch },
    }));
  };

  const isDirty = (id: string) => {
    const orig = roles.find((r) => r.id === id);
    const cur = drafts[id];
    if (!orig || !cur) return false;
    if (orig.name !== cur.name) return true;
    if (orig.permissions.length !== cur.permissions.length) return true;
    const a = [...orig.permissions].sort().join('|');
    const b = [...cur.permissions].sort().join('|');
    return a !== b;
  };

  const handleSave = async (id: string) => {
    if (!roleBasedSettingsAllowed) return;
    const cur = drafts[id];
    if (!cur) return;
    if (!navigator.onLine) {
      toast.error(t('settings.cards.roles.offline'));
      return;
    }
    setSavingId(id);
    try {
      await axios.patch(roleApiPath(id, '', drafts[id]?.urlId), {
        name: cur.name.trim(),
        permissions: cur.permissions,
      });
      toast.success(t('settings.cards.roles.saved'));
      setConfirmSaveId(null);
      await fetchRoles();
    } catch (e: any) {
      toast.error(
        typeof e.response?.data?.error === 'string'
          ? e.response.data.error
          : e.response?.data?.error?.message ??
              e.message ??
              t('settings.cards.roles.saveFailed')
      );
    } finally {
      setSavingId(null);
    }
  };

  const handleCreate = async () => {
    if (!roleBasedSettingsAllowed) return;
    const name = newName.trim();
    if (!name) {
      toast.error(t('settings.cards.roles.nameRequired'));
      return;
    }
    if (!navigator.onLine) {
      toast.error(t('settings.cards.roles.offline'));
      return;
    }
    setCreating(true);
    try {
      await axios.post('/api/restaurant/roles', {
        name,
        permissions: [],
      });
      toast.success(t('settings.cards.roles.created'));
      setNewName('');
      await fetchRoles();
    } catch (e: any) {
      toast.error(
        typeof e.response?.data?.error === 'string'
          ? e.response.data.error
          : e.message ?? t('settings.cards.roles.createFailed')
      );
    } finally {
      setCreating(false);
    }
  };

  const confirmDelete = async () => {
    if (!roleBasedSettingsAllowed) return;
    if (!deleteId) return;
    if (!navigator.onLine) {
      toast.error(t('settings.cards.roles.offline'));
      return;
    }
    setDeleting(true);
    try {
      const role = roles.find((r) => r.id === deleteId);
      await axios.delete(roleApiPath(deleteId, '', role?.urlId));
      toast.success(t('settings.cards.roles.deleted'));
      setDeleteId(null);
      await fetchRoles();
    } catch (e: any) {
      toast.error(
        typeof e.response?.data?.error === 'string'
          ? e.response.data.error
          : e.message ?? t('settings.cards.roles.deleteFailed')
      );
    } finally {
      setDeleting(false);
    }
  };

  const togglePermission = (
    roleId: string,
    moduleKey: string,
    action: PermissionAction,
    enabled: boolean
  ) => {
    if (!roleBasedSettingsAllowed) return;
    const cur = drafts[roleId];
    if (!cur) return;
    const next = toggleModuleAction(
      cur.permissions,
      moduleKey,
      action,
      enabled
    );
    updateDraft(roleId, { permissions: next });
  };

  /** Preset Owner/Admin are fixed; only list custom + other presets (e.g. Employee). */
  const editableRoles = roles.filter(
    (r) =>
      r.slug !== RESTAURANT_ROLE_SLUG.OWNER &&
      r.slug !== RESTAURANT_ROLE_SLUG.ADMIN
  );

  return (
    <>
      <Card className={settingsCardClass}>
        <CardHeader className="min-w-0">
          <CardTitle>{t('settings.cards.roles.title')}</CardTitle>
          <CardDescription>
            {t('settings.cards.roles.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="min-w-0 space-y-6">
          {!roleBasedSettingsAllowed ? (
            <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              {t('settings.cards.roles.premiumNote')}
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-2">
                  <label
                    htmlFor="new-role-name"
                    className="text-sm font-medium"
                  >
                    {t('settings.cards.roles.newRoleNameLabel')}
                  </label>
                  <Input
                    id="new-role-name"
                    placeholder={t('settings.cards.roles.newRoleNamePlaceholder')}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
                <PremiumDisabledControl
                  locked={!canCreateMore('roles', editableRoles.length)}
                  label={t('settings.cards.roles.createRole')}
                  className="sm:mb-0"
                >
                  <Button
                    type="button"
                    className="text-white sm:mb-0"
                    onClick={() => void handleCreate()}
                    disabled={creating}
                  >
                    {creating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        <span>{t('settings.cards.roles.creating')}</span>
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        {t('settings.cards.roles.createRole')}
                      </>
                    )}
                  </Button>
                </PremiumDisabledControl>
              </div>

              {loading ? (
                <p className="text-sm text-muted-foreground">
                  <Loader2 className=" animate-spin text-primary text-center mx-auto" />{' '}
                </p>
              ) : roles.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('settings.cards.roles.emptyRoles')}
                </p>
              ) : editableRoles.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('settings.cards.roles.emptyEditableRoles')}
                </p>
              ) : (
                <div className="min-w-0 space-y-3">
                  {editableRoles.map((r) => {
                    const draft = drafts[r.id];
                    if (!draft) return null;
                    const dirty = isDirty(r.id);
                    return (
                      <Collapsible key={r.id} defaultOpen={false}>
                        <div className="min-w-0 overflow-hidden rounded-lg border bg-card">
                          <div className="flex min-w-0 flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 text-left font-medium hover:underline [&[data-state=open]_svg]:rotate-180">
                              <ChevronDown className="h-4 w-4 shrink-0 transition-transform" />
                              <span className="min-w-0 truncate">
                                {draft.name || t('settings.cards.roles.untitledRole')}
                              </span>
                              {r.slug ? (
                                <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
                                  {t('settings.cards.roles.preset')}
                                </span>
                              ) : null}
                              {dirty ? (
                                <span className="text-xs font-normal text-amber-600 dark:text-amber-400">
                                  {t('settings.cards.roles.unsavedChanges')}
                                </span>
                              ) : null}
                            </CollapsibleTrigger>
                            <div className="flex shrink-0 flex-wrap gap-2">
                              {!r.slug ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="text-destructive hover:bg-destructive/10"
                                  onClick={() => setDeleteId(r.id)}
                                >
                                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                                  {t('settings.cards.roles.delete')}
                                </Button>
                              ) : null}
                              <Button
                                type="button"
                                className="text-white"
                                disabled={!dirty || savingId === r.id}
                                onClick={() => setConfirmSaveId(r.id)}
                              >
                                {savingId === r.id ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />{' '}
                                    <span>{t('settings.cards.roles.saving')}</span>
                                  </>
                                ) : (
                                  <>
                                    <Save className="h-4 w-4 mr-2" />
                                    <span>{t('settings.cards.roles.save')}</span>
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                          <CollapsibleContent>
                            <div className="min-w-0 border-t px-4 pb-4 pt-2">
                              <div className="mb-4 min-w-0 space-y-2 sm:max-w-md">
                                <label className="text-sm font-medium">
                                  {t('settings.cards.roles.roleNameLabel')}
                                </label>
                                <Input
                                  value={draft.name}
                                  onChange={(e) =>
                                    updateDraft(r.id, { name: e.target.value })
                                  }
                                />
                              </div>
                              <TableWrapper>
                                <Table minWidth={420}>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="min-w-[8rem]">
                                        {t('settings.cards.roles.colModule')}
                                      </TableHead>
                                      <TableHead className="text-center">
                                        {t('settings.cards.roles.colAccess')}
                                      </TableHead>
                                      <TableHead className="text-center">
                                        {t('settings.cards.roles.colEdit')}
                                      </TableHead>
                                      <TableHead className="text-center">
                                        {t('settings.cards.roles.delete')}
                                      </TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {(() => {
                                      const permRows = rowsFromPermissions(
                                        draft.permissions
                                      );
                                      return DASHBOARD_MODULES.map((m) => {
                                        const row = permRows.get(m.moduleKey)!;
                                        return (
                                          <TableRow key={m.moduleKey}>
                                            <TableCell className="whitespace-normal font-medium">
                                              {m.title}
                                            </TableCell>
                                            {(
                                              [
                                                'access',
                                                'edit',
                                                'delete',
                                              ] as const
                                            ).map((action) => (
                                              <TableCell
                                                key={action}
                                                className="text-center"
                                              >
                                                <input
                                                  type="checkbox"
                                                  className="h-4 w-4 accent-primary"
                                                  checked={
                                                    action === 'access'
                                                      ? row.access
                                                      : action === 'edit'
                                                        ? row.edit
                                                        : row.delete
                                                  }
                                                  onChange={(e) =>
                                                    togglePermission(
                                                      r.id,
                                                      m.moduleKey,
                                                      action,
                                                      e.target.checked
                                                    )
                                                  }
                                                />
                                              </TableCell>
                                            ))}
                                          </TableRow>
                                        );
                                      });
                                    })()}
                                  </TableBody>
                                </Table>
                              </TableWrapper>
                              <p className="mt-2 text-xs text-muted-foreground">
                                {t('settings.cards.roles.permissionsHint')}
                              </p>
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </CardContent>
        <CardFooter className="border-t px-6 py-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => void fetchRoles()}
            disabled={loading}
          >
            {loading ? (
              <RefreshCcw className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
          </Button>
        </CardFooter>
      </Card>

      <SaveConfirmation
        open={confirmSaveId !== null}
        title={t('settings.cards.roles.saveDialogTitle')}
        description={t('settings.cards.roles.saveDialogDescription')}
        itemName={confirmSaveId ? drafts[confirmSaveId]?.name : undefined}
        loading={savingId !== null}
        onConfirm={async () => {
          if (confirmSaveId) {
            await handleSave(confirmSaveId);
          }
        }}
        onCancel={() => setConfirmSaveId(null)}
      />

      <DeleteConfirmation
        open={deleteId !== null}
        title={t('settings.cards.roles.deleteDialogTitle')}
        description={t('settings.cards.roles.deleteDialogDescription')}
        itemName={
          deleteId ? roles.find((r) => r.id === deleteId)?.name : undefined
        }
        loading={deleting}
        onConfirm={async () => {
          await confirmDelete();
        }}
        onCancel={() => setDeleteId(null)}
      />
    </>
  );
}
