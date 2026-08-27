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
import { cn } from '@/lib/utils';

const branchChipClass =
  'inline-flex h-9 max-w-[12rem] items-center gap-2 rounded-xl bg-white/70 px-3 text-sm font-medium text-foreground shadow-sm dark:bg-white/10';

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
      <div className={cn(branchChipClass, 'text-muted-foreground')}>
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  if (branches.length === 0) return null;

  if (!isOwnerOrAdmin) {
    const label =
      branches.map((b) => b.name).join(', ') || 'No branch assigned';
    return (
      <div className={branchChipClass} title={label}>
        <Building2 className="h-4 w-4 shrink-0 text-fire-500" />
        <span className="truncate">{label}</span>
      </div>
    );
  }

  if (!canSwitchBranch && activeBranchId) {
    const name = branches.find((b) => b.id === activeBranchId)?.name ?? 'Branch';
    return (
      <div className={branchChipClass} title={name}>
        <Building2 className="h-4 w-4 shrink-0 text-fire-500" />
        <span className="truncate">{name}</span>
      </div>
    );
  }

  if (!canSwitchBranch) return null;

  return (
    <Select
      value={activeBranchId ?? undefined}
      onValueChange={(v) => void setActiveBranch(v)}
    >
      <SelectTrigger className="h-9 w-[min(100%,12rem)] gap-2 rounded-xl border-0 bg-white/70 shadow-sm dark:bg-white/10">
        <Building2 className="h-4 w-4 shrink-0 text-fire-500" />
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
