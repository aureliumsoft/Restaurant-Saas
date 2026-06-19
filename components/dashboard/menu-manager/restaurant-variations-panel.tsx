'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  AddVariationConfirmation,
  DeleteConfirmation,
  SaveConfirmation,
} from '@/components/ui/confirmation-dialogs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiErrorMessage } from '@/lib/api-error-message';
import { filterNameTextInput } from '@/lib/validation/fields';

import type { RestaurantVariationRow } from './types';

export function RestaurantVariationsPanel() {
  const [rows, setRows] = useState<RestaurantVariationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [shortLabel, setShortLabel] = useState('');
  const [adding, setAdding] = useState(false);
  const [confirmAddOpen, setConfirmAddOpen] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const [pendingSave, setPendingSave] = useState<{
    id: string;
    name: string;
    shortLabel: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get<{ data: RestaurantVariationRow[] }>(
        '/api/restaurant/variations'
      );
      setRows(res.data.data ?? []);
    } catch {
      toast.error('Could not load variations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const canAdd = Boolean(name.trim()) && !adding;

  const add = async () => {
    if (!name.trim() || adding) return;
    setAdding(true);
    try {
      await axios.post('/api/restaurant/variations', {
        name: name.trim(),
        shortLabel: shortLabel.trim() || null,
      });
      toast.success('Variation created');
      setName('');
      setShortLabel('');
      await load();
    } catch (e: unknown) {
      toast.error(apiErrorMessage(e, 'Could not create variation'));
    } finally {
      setAdding(false);
    }
  };

  const save = async () => {
    if (!pendingSave) return;
    setSaving(true);
    try {
      await axios.patch(`/api/restaurant/variations/${pendingSave.id}`, {
        name: pendingSave.name.trim(),
        shortLabel: pendingSave.shortLabel.trim() || null,
      });
      toast.success('Saved');
      await load();
    } catch {
      toast.error('Could not save variation');
    } finally {
      setSaving(false);
      setConfirmSaveOpen(false);
      setPendingSave(null);
    }
  };

  const remove = async () => {
    if (!deletingId) return;
    setDeleting(true);
    try {
      await axios.delete(`/api/restaurant/variations/${deletingId}`);
      toast.success('Deleted');
      await load();
    } catch (e: unknown) {
      toast.error(apiErrorMessage(e, 'Could not delete variation'));
    } finally {
      setDeleting(false);
      setConfirmDeleteOpen(false);
      setDeletingId(null);
    }
  };

  const deletingRow = rows.find((r) => r.id === deletingId);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Create Variation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 items-end">
              <div className="grid gap-1.5">
                <Label htmlFor="new-variation-name">Name</Label>
                <Input
                  id="new-variation-name"
                  placeholder="e.g. Medium"
                  value={name}
                  onChange={(e) =>
                    setName(filterNameTextInput(e.target.value))
                  }
                  className="bg-background"
                  disabled={adding}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && canAdd) setConfirmAddOpen(true);
                  }}
                />
              </div>
              <div className="grid gap-1.5 ">
                <Label htmlFor="new-variation-short">Short label (optional)</Label>
                <Input
                  id="new-variation-short"
                  placeholder="e.g. M"
                  value={shortLabel}
                  onChange={(e) => setShortLabel(e.target.value)}
                  className="bg-background"
                  disabled={adding}
                  maxLength={20}
                />
              </div>
              <Button
              type="button"
              disabled={!canAdd}
              onClick={() => setConfirmAddOpen(true)}
            >
              {adding ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Plus className="mr-2 h-4 w-4" aria-hidden />
              )}
              {adding ? 'Adding…' : 'Add variation'}
            </Button>
            </div>
           
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((row) => (
                <VariationCard
                  key={row.id}
                  variation={row}
                  onRequestSave={(draft) => {
                    setPendingSave(draft);
                    setConfirmSaveOpen(true);
                  }}
                  onDelete={(id) => {
                    setDeletingId(id);
                    setConfirmDeleteOpen(true);
                  }}
                />
              ))}
            </div>
          )}

          {!loading && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No variations yet. Add your first one above.
            </p>
          )}
        </CardContent>
      </Card>

      <AddVariationConfirmation
        open={confirmAddOpen}
        variationName={name}
        shortLabel={shortLabel}
        loading={adding}
        onCancel={() => setConfirmAddOpen(false)}
        onConfirm={async () => {
          await add();
          setConfirmAddOpen(false);
        }}
      />

      <SaveConfirmation
        open={confirmSaveOpen}
        title="Save variation"
        description="Update this variation template. Products and configuration rules that use it will reflect the new name and label."
        itemName={pendingSave?.name}
        loading={saving}
        onCancel={() => {
          if (!saving) {
            setPendingSave(null);
          }
        }}
        onConfirm={() => void save()}
      />

      <DeleteConfirmation
        open={confirmDeleteOpen}
        title="Delete variation"
        description="This removes the template. Products already using it may need to be updated."
        itemName={deletingRow?.name}
        loading={deleting}
        onConfirm={() => {
          setDeleting(true);
          void remove();
        }}
        onCancel={() => {
          setConfirmDeleteOpen(false);
          setDeletingId(null);
        }}
      />
    </>
  );
}

function VariationCard({
  variation,
  onRequestSave,
  onDelete,
}: {
  variation: RestaurantVariationRow;
  onRequestSave: (draft: {
    id: string;
    name: string;
    shortLabel: string;
  }) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(variation.name);
  const [editShortLabel, setEditShortLabel] = useState(
    variation.shortLabel ?? ''
  );

  useEffect(() => {
    setEditName(variation.name);
    setEditShortLabel(variation.shortLabel ?? '');
    setEditing(false);
  }, [variation.id, variation.name, variation.shortLabel]);

  const cancelEdit = () => {
    setEditName(variation.name);
    setEditShortLabel(variation.shortLabel ?? '');
    setEditing(false);
  };

  const requestSave = () => {
    const nextName = editName.trim();
    if (!nextName) return;
    const nextShort = editShortLabel.trim();
    if (
      nextName === variation.name &&
      nextShort === (variation.shortLabel ?? '')
    ) {
      cancelEdit();
      return;
    }
    onRequestSave({
      id: variation.id,
      name: nextName,
      shortLabel: nextShort,
    });
  };

  return (
    <Card className="dashboard-grid-card flex flex-col overflow-hidden transition-shadow">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex items-start justify-between gap-2">
          {!editing && variation.shortLabel ? (
            <Badge variant="secondary" className="shrink-0 font-mono">
              {variation.shortLabel}
            </Badge>
          ) : (
            <div className="min-h-6 flex-1" aria-hidden />
          )}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
            onClick={() => onDelete(variation.id)}
            aria-label="Delete variation"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {editing ? (
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label>Name</Label>
              <Input
                value={editName}
                onChange={(e) =>
                  setEditName(filterNameTextInput(e.target.value))
                }
                autoFocus
                aria-label="Variation name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') requestSave();
                  if (e.key === 'Escape') cancelEdit();
                }}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Short label</Label>
              <Input
                value={editShortLabel}
                onChange={(e) => setEditShortLabel(e.target.value)}
                placeholder="M"
                maxLength={20}
                aria-label="Short label"
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                className="flex-1"
                disabled={!editName.trim()}
                onClick={requestSave}
              >
                Save
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={cancelEdit}
                aria-label="Cancel edit"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base leading-snug">
              {variation.name}
            </CardTitle>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0"
              onClick={() => setEditing(true)}
              aria-label="Edit variation"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardHeader>
      {!editing && variation.shortLabel ? (
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground">
            Short label used in configuration headers
          </p>
        </CardContent>
      ) : null}
    </Card>
  );
}
