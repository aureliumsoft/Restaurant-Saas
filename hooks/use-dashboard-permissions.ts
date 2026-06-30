'use client';

import { useCallback } from 'react';

import type {
  DashboardModuleKey,
  PermissionAction,
} from '@/constant/dashboardModules';
import { hasDashboardPermission } from '@/lib/dashboard-permissions';
import { useStaffPermissions } from '@/hooks/use-staff-permissions';

export function useDashboardPermissions() {
  const { loading, permissions, plan } = useStaffPermissions();

  const can = useCallback(
    (moduleKey: DashboardModuleKey, action: PermissionAction) =>
      hasDashboardPermission(permissions, moduleKey, action),
    [permissions]
  );

  return {
    loading,
    permissions,
    plan,
    canAccess: (moduleKey: DashboardModuleKey) => can(moduleKey, 'access'),
    canEdit: (moduleKey: DashboardModuleKey) => can(moduleKey, 'edit'),
    canDelete: (moduleKey: DashboardModuleKey) => can(moduleKey, 'delete'),
    can,
  };
}
