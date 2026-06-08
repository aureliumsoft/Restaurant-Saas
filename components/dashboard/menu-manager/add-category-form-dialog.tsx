'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Loader2, Plus } from 'lucide-react';

import { Base64ImageUploadField } from '@/components/ui/base64-image-upload';
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

type CreatedCategory = {
  id: string;
  name: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMenuRefresh?: () => Promise<void>;
  onCreated?: (category: CreatedCategory) => void;
};

export function AddCategoryFormDialog({
  open,
  onOpenChange,
  onMenuRefresh,
  onCreated,
}: Props) {
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [showInFront, setShowInFront] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setName('');
      setImageUrl('');
      setShowInFront(true);
    }
  }, [open]);

  const save = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const res = await axios.post<{ data: CreatedCategory }>(
        '/api/restaurant/menu/categories',
        {
          name: name.trim(),
          showInFront,
          ...(imageUrl.trim() ? { imageUrl: imageUrl.trim() } : {}),
        }
      );
      const created = res.data.data;
      toast.success('Category created');
      await onMenuRefresh?.();
      onCreated?.(created);
      onOpenChange(false);
    } catch (e: unknown) {
      toast.error(apiErrorMessage(e, 'Could not create category'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add category</DialogTitle>
          <DialogDescription>
            Create a menu section. It appears on the website, kiosk, and POS when
            &quot;Show in front&quot; is enabled.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="dialog-category-name">Name</Label>
            <Input
              id="dialog-category-name"
              placeholder="e.g. Burgers"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim()) void save();
              }}
            />
          </div>
          <Base64ImageUploadField
            label="Category image"
            value={imageUrl}
            onChange={setImageUrl}
            helperText="Shown on website, kiosk, and POS category strips."
          />
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border accent-primary"
              checked={showInFront}
              onChange={(e) => setShowInFront(e.target.checked)}
              disabled={saving}
            />
            <span>Show in front (website, kiosk, POS)</span>
          </label>
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
            {saving ? 'Adding…' : 'Add category'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
