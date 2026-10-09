'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import {
  parseBilingualInput,
  serializeBilingualInput,
} from '@/lib/menu/bilingual-text';
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
  const { t } = useTranslation();
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
    if (!parseBilingualInput(name).en) {
      toast.error(t('dashboard.menuManager.variation.nameRequired'));
      return;
    }
    setSaving(true);
    try {
      const storedName = serializeBilingualInput(name);
      const res = await axios.post<{ data: RestaurantVariationRow }>(
        '/api/restaurant/variations',
        {
          name: storedName,
          shortLabel: shortLabel.trim() || null,
        }
      );
      const created = res.data.data;
      toast.success(t('dashboard.menuManager.variation.created'));
      await onTemplatesReload?.();
      onCreated?.(created);
      onOpenChange(false);
    } catch (e: unknown) {
      toast.error(
        apiErrorMessage(e, t('dashboard.menuManager.variation.createFailed'))
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('dashboard.menuManager.variation.add')}</DialogTitle>
          <DialogDescription>
            {t('dashboard.menuManager.variation.addDescription')}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="dialog-variation-name">
              {t('dashboard.common.name')}
            </Label>
            <Input
              id="dialog-variation-name"
              placeholder={t('dashboard.menuManager.bilingual.namePlaceholder')}
              value={name}
              onChange={(e) => setName(filterNameTextInput(e.target.value))}
              disabled={saving}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim()) void save();
              }}
            />
            <p className="text-xs text-muted-foreground">
              {t('dashboard.menuManager.bilingual.hint')}
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dialog-variation-short">
              {t('dashboard.menuManager.variation.shortLabelOptional')}
            </Label>
            <Input
              id="dialog-variation-short"
              placeholder={t(
                'dashboard.menuManager.variation.shortLabelPlaceholder'
              )}
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
            {t('dashboard.common.cancel')}
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
            {saving
              ? t('dashboard.menuManager.adding')
              : t('dashboard.menuManager.variation.add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
