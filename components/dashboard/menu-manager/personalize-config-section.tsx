'use client';

import { Loader2, Plus, Trash2 } from 'lucide-react';

import { Base64ImageUploadField } from '@/components/ui/base64-image-upload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import type { PersonalizeGroupRow } from './types';

export type PersonalizeGroupDraft = {
  id?: string;
  parentName: string;
  maxItems: number;
  sortOrder: number;
  options: Array<{
    id?: string;
    name: string;
    imageUrl: string;
    sortOrder: number;
  }>;
};

export function personalizeGroupsToDraft(
  groups: PersonalizeGroupRow[] | undefined
): PersonalizeGroupDraft[] {
  return (groups ?? []).map((g, gi) => ({
    id: g.id,
    parentName: g.parentName,
    maxItems: g.maxItems,
    sortOrder: g.sortOrder ?? gi,
    options: g.options.map((o, oi) => ({
      id: o.id,
      name: o.name,
      imageUrl: o.imageUrl ?? '',
      sortOrder: o.sortOrder ?? oi,
    })),
  }));
}

export function personalizeDraftToPreviewGroups(
  draft: PersonalizeGroupDraft[]
): Array<{
  id: string;
  parentName: string;
  maxItems: number;
  options: Array<{ id: string; name: string; imageUrl?: string | null }>;
}> {
  return draft
    .filter(
      (g) =>
        g.parentName.trim().length > 0 &&
        g.options.some((o) => o.name.trim().length > 0)
    )
    .map((g, gi) => ({
      id: g.id ?? `preview-personalize-${gi}`,
      parentName: g.parentName.trim(),
      maxItems: g.maxItems,
      options: g.options
        .filter((o) => o.name.trim().length > 0)
        .map((o, oi) => ({
          id: o.id ?? `preview-personalize-${gi}-opt-${oi}`,
          name: o.name.trim(),
          imageUrl: o.imageUrl?.trim() || null,
        })),
    }))
    .filter((g) => g.options.length > 0);
}

export function emptyPersonalizeGroup(sortOrder = 0): PersonalizeGroupDraft {
  return {
    parentName: 'Personalize',
    maxItems: 2,
    sortOrder,
    options: [{ name: '', imageUrl: '', sortOrder: 0 }],
  };
}

type Props = {
  groups: PersonalizeGroupDraft[];
  onChange: (groups: PersonalizeGroupDraft[]) => void;
  saving?: boolean;
  loading?: boolean;
  onSave: () => void;
};

export function PersonalizeConfigSection({
  groups,
  onChange,
  saving,
  loading = false,
  onSave,
}: Props) {
  const updateGroup = (
    index: number,
    patch: Partial<PersonalizeGroupDraft>
  ) => {
    onChange(
      groups.map((g, i) => (i === index ? { ...g, ...patch } : g))
    );
  };

  const updateOption = (
    groupIndex: number,
    optionIndex: number,
    patch: Partial<PersonalizeGroupDraft['options'][number]>
  ) => {
    onChange(
      groups.map((g, gi) =>
        gi !== groupIndex
          ? g
          : {
              ...g,
              options: g.options.map((o, oi) =>
                oi === optionIndex ? { ...o, ...patch } : o
              ),
            }
      )
    );
  };

  const addGroup = () => {
    onChange([...groups, emptyPersonalizeGroup(groups.length)]);
  };

  const removeGroup = (index: number) => {
    onChange(groups.filter((_, i) => i !== index));
  };

  const addOption = (groupIndex: number) => {
    const g = groups[groupIndex];
    if (!g) return;
    updateGroup(groupIndex, {
      options: [
        ...g.options,
        { name: '', imageUrl: '', sortOrder: g.options.length },
      ],
    });
  };

  const removeOption = (groupIndex: number, optionIndex: number) => {
    const g = groups[groupIndex];
    if (!g || g.options.length <= 1) return;
    updateGroup(groupIndex, {
      options: g.options.filter((_, i) => i !== optionIndex),
    });
  };

  const canSave =
    groups.length > 0 &&
    groups.every(
      (g) =>
        g.parentName.trim().length > 0 &&
        g.maxItems >= 1 &&
        g.options.some((o) => o.name.trim().length > 0)
    );

  if (loading) {
    return (
      <div className="flex min-h-[120px] items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading personalize items…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No personalize groups yet. Add one for guest preferences (no price
          change).
        </p>
      ) : (
        groups.map((group, groupIndex) => (
          <div
            key={group.id ?? `draft-group-${groupIndex}`}
            className="space-y-4 rounded-xl border border-border bg-background p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">
                Group {groupIndex + 1}
              </p>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="text-destructive"
                onClick={() => removeGroup(groupIndex)}
                aria-label="Remove group"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Parent name (group title)</Label>
                <Input
                  value={group.parentName}
                  onChange={(e) =>
                    updateGroup(groupIndex, { parentName: e.target.value })
                  }
                  placeholder="e.g. Personalize"
                />
              </div>
              <div className="grid gap-2">
                <Label>Maximum selections</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={group.maxItems}
                  onChange={(e) =>
                    updateGroup(groupIndex, {
                      maxItems: Math.max(
                        1,
                        Math.min(20, Number(e.target.value) || 1)
                      ),
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Items</Label>
              {group.options.map((option, optionIndex) => (
                <div
                  key={option.id ?? `opt-${groupIndex}-${optionIndex}`}
                  className="grid gap-3 rounded-lg border border-border/70 bg-muted/20 p-3 sm:grid-cols-[1fr_auto]"
                >
                  <div className="space-y-3">
                    <Input
                      value={option.name}
                      onChange={(e) =>
                        updateOption(groupIndex, optionIndex, {
                          name: e.target.value,
                        })
                      }
                      placeholder="Item name (e.g. No fries)"
                    />
                    <Base64ImageUploadField
                      label="Photo"
                      value={option.imageUrl}
                      onChange={(imageUrl) =>
                        updateOption(groupIndex, optionIndex, { imageUrl })
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="self-start text-destructive"
                    disabled={group.options.length <= 1}
                    onClick={() => removeOption(groupIndex, optionIndex)}
                    aria-label="Remove item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addOption(groupIndex)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add item
              </Button>
            </div>
          </div>
        ))
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={addGroup}>
          <Plus className="mr-2 h-4 w-4" />
          Add personalize group
        </Button>
        <Button
          type="button"
          disabled={!canSave || saving}
          onClick={onSave}
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            'Save personalize'
          )}
        </Button>
      </div>
    </div>
  );
}
