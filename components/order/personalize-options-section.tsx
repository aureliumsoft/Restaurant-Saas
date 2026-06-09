'use client';

import { Check } from 'lucide-react';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export type PersonalizeGroup = {
  id: string;
  parentName: string;
  maxItems: number;
  options: Array<{
    id: string;
    name: string;
    imageUrl?: string | null;
  }>;
};

type Props = {
  groups: PersonalizeGroup[];
  selectedByGroup: Record<string, string[]>;
  onToggle: (groupId: string, optionId: string) => void;
};

export function PersonalizeOptionsSection({
  groups,
  selectedByGroup,
  onToggle,
}: Props) {
  if (groups.length === 0) return null;

  return (
    <>
      {groups.map((group) => {
        const selected = selectedByGroup[group.id] ?? [];
        const count = selected.length;
        return (
          <section
            key={group.id}
            className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
          >
            <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/40 px-4 py-3">
              <Label className="text-sm font-semibold text-foreground">
                {group.parentName}
              </Label>
              <span className="text-xs font-medium text-muted-foreground">
                {count}/{group.maxItems} max.
              </span>
            </div>
            <ul className="divide-y divide-border">
              {group.options.map((option) => {
                const checked = selected.includes(option.id);
                const atMax = count >= group.maxItems && !checked;
                return (
                  <li key={option.id}>
                    <button
                      type="button"
                      disabled={atMax}
                      onClick={() => onToggle(group.id, option.id)}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-3 text-left transition',
                        atMax
                          ? 'cursor-not-allowed opacity-50'
                          : 'hover:bg-muted/30 active:bg-muted/50'
                      )}
                    >
                      <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                        {option.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={option.imageUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                            —
                          </span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1 text-sm font-semibold uppercase tracking-wide text-foreground">
                        {option.name}
                      </span>
                      <span
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded border',
                          checked
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-background'
                        )}
                        aria-hidden
                      >
                        {checked ? <Check className="h-3 w-3" /> : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </>
  );
}
