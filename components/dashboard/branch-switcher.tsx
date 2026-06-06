'use client';

import { Building2, Loader2 } from 'lucide-react';

import { useBranchContext } from '@/hooks/use-branch-context';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function BranchSwitcher() {
  const {
    loading,
    branches,
    activeBranchId,
    canSwitchBranch,
    isOwnerOrAdmin,
    setActiveBranch,
  } = useBranchContext();

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  if (branches.length === 0) return null;

  if (!isOwnerOrAdmin) {
    const label =
      branches.map((b) => b.name).join(', ') || 'No branch assigned';
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Building2 className="h-4 w-4 shrink-0" />
        <span className="truncate font-medium text-foreground">{label}</span>
      </div>
    );
  }

  if (!canSwitchBranch && activeBranchId) {
    const name = branches.find((b) => b.id === activeBranchId)?.name ?? 'Branch';
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Building2 className="h-4 w-4 shrink-0" />
        <span className="truncate font-medium text-foreground">{name}</span>
      </div>
    );
  }

  if (!canSwitchBranch) return null;

  return (
    <Select
      value={activeBranchId ?? undefined}
      onValueChange={(v) => void setActiveBranch(v)}
    >
      <SelectTrigger className="h-9 w-[min(100%,12rem)] gap-2">
        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
        <SelectValue placeholder="Select branch" />
      </SelectTrigger>
      <SelectContent>
        {branches.map((b) => (
          <SelectItem key={b.id} value={b.id}>
            {b.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
