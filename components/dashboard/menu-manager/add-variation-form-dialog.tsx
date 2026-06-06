'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Loader2, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiErrorMessage } from '@/lib/api-error-message';
import { filterNameTextInput } from '@/lib/validation/fields';

import type { RestaurantVariationRow } from './types';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTemplatesReload?: () => Promise<void>;
  onCreated?: (variation: RestaurantVariationRow) => void;
};

export function AddVariationFormDialog({
  open,
  onOpenChange,
  onTemplatesReload,
  onCreated,
}: Props) {
  const [name, setName] = useState('');
  const [shortLabel, setShortLabel] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setName('');
      setShortLabel('');
    }
  }, [open]);

  const save = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const res = await axios.post<{ data: RestaurantVariationRow }>(
        '/api/restaurant/variations',
        {
          name: name.trim(),
          shortLabel: shortLabel.trim() || null,
        }
      );
      const created = res.data.data;
      toast.success('Variation created');
      await onTemplatesReload?.();
      onCreated?.(created);
      onOpenChange(false);
    } catch (e: unknown) {
      toast.error(apiErrorMessage(e, 'Could not create variation'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add variation</DialogTitle>
          <DialogDescription>
            Create a variation template (e.g. Small, Medium, Large). Assign it to
            products with individual prices.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="dialog-variation-name">Name</Label>
            <Input
              id="dialog-variation-name"
              placeholder="e.g. Medium"
              value={name}
              onChange={(e) => setName(filterNameTextInput(e.target.value))}
              disabled={saving}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim()) void save();
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dialog-variation-short">Short label (optional)</Label>
            <Input
              id="dialog-variation-short"
              placeholder="e.g. M"
              value={shortLabel}
              onChange={(e) => setShortLabel(e.target.value)}
              disabled={saving}
              maxLength={20}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!name.trim() || saving}
            onClick={() => void save()}
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            {saving ? 'Adding…' : 'Add variation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
