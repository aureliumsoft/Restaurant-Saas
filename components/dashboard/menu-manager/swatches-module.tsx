'use client';

import { useMemo, useState } from 'react';
import axios from 'axios';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';

import type { MenuCategoryRow } from './types';
import { Base64ImageUploadField } from '@/components/ui/base64-image-upload';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { isAcceptedImageValue } from '@/lib/image-data-url';
import { resolveBilingualText } from '@/lib/menu/bilingual-text';
import { useUiLanguage } from '@/hooks/use-ui-language';

type SwatchRow = {
  id?: string;
  name: string;
  title: string;
  priceDelta: string; // stored API field; acts as final swatch price
  imageUrl: string;
};

type Props = {
  categories: MenuCategoryRow[];
  onRefresh: () => Promise<void>;
};

export function SwatchesModule({ categories, onRefresh }: Props) {
  const uiLang = useUiLanguage();
  const products = useMemo(
    () =>
      categories.flatMap((c) =>
        c.items.map((item) => ({
          id: item.id,
          name: item.name,
          categoryName: c.name,
          variations: item.variations ?? [],
        }))
      ),
    [categories]
  );

  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [rows, setRows] = useState<SwatchRow[]>([]);
  const [saving, setSaving] = useState(false);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) ?? null,
    [products, selectedProductId]
  );

  function loadRows(productId: string) {
    const p = products.find((x) => x.id === productId);
    if (!p) {
      setRows([]);
      return;
    }
    setRows(
      (p.variations ?? []).map((v) => ({
        id: v.id,
        name: (v.name ?? '').trim(),
        title: (v.title ?? v.name ?? '').trim(),
        priceDelta: String(v.priceDelta ?? 0),
        imageUrl: v.imageUrl ?? '',
      }))
    );
  }

  function updateRow(index: number, patch: Partial<SwatchRow>) {
    setRows((cur) => cur.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((cur) => [...cur, { name: '', title: '', priceDelta: '0', imageUrl: '' }]);
  }

  function removeRow(index: number) {
    setRows((cur) => cur.filter((_, i) => i !== index));
  }

  async function save() {
    if (!selectedProduct) {
      toast.error('Select a product first.');
      return;
    }
    const variations = rows
      .map((r) => ({
        name: r.name.trim(),
        title: r.title.trim() || r.name.trim(),
        priceDelta: Number(r.priceDelta || '0'),
        imageUrl: r.imageUrl.trim() || null,
      }))
      .filter((r) => r.name.length > 0);

    if (variations.some((v) => Number.isNaN(v.priceDelta))) {
      toast.error('Every swatch price must be a valid number.');
      return;
    }
    if (variations.some((v) => v.imageUrl && !isAcceptedImageValue(v.imageUrl))) {
      toast.error('Swatch image must be a valid URL or base64 image.');
      return;
    }

    setSaving(true);
    try {
      await axios.patch(`/api/restaurant/menu/items/${selectedProduct.id}`, {
        variations,
      });
      toast.success('Swatches saved');
      await onRefresh();
      loadRows(selectedProduct.id);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: unknown } } };
      toast.error(typeof err.response?.data?.error === 'string' ? err.response.data.error : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Swatches</CardTitle>
        <CardDescription>
          Select a product, then add swatches with name, title, final price, and image.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label>Select product</Label>
          <Select
            value={selectedProductId}
            onValueChange={(v) => {
              setSelectedProductId(v);
              loadRows(v);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose product" />
            </SelectTrigger>
            <SelectContent>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {resolveBilingualText(p.name, uiLang)} —{' '}
                  {resolveBilingualText(p.categoryName, uiLang)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!selectedProduct ? (
          <p className="text-sm text-muted-foreground">Choose a product to manage swatches.</p>
        ) : (
          <>
            <div className="space-y-3">
              {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No swatches yet. Add your first one below.</p>
              ) : (
                rows.map((row, index) => (
                  <div key={`${row.id ?? 'new'}-${index}`} className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-[1.1fr,0.8fr,1.6fr,auto]">
                    <div className="grid gap-1">
                      <Label>Name</Label>
                      <Input
                        value={row.name}
                        onChange={(e) => updateRow(index, { name: e.target.value })}
                        placeholder="Small / Red / 500ml"
                      />
                    </div>
                  
                    <div className="grid gap-1">
                      <Label>Price</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={row.priceDelta}
                        onChange={(e) => updateRow(index, { priceDelta: e.target.value })}
                        placeholder="0"
                      />
                    </div>
                    <Base64ImageUploadField
                      label="Image"
                      value={row.imageUrl}
                      onChange={(v) => updateRow(index, { imageUrl: v })}
                    />
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => removeRow(index)}
                        aria-label="Remove swatch"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={addRow}>
                <Plus className="mr-2 h-4 w-4" />
                Add swatch
              </Button>
              <Button type="button" disabled={saving} onClick={() => void save()}>
                {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> <span>Saving...</span></> : <><Save className="h-4 w-4 mr-2" /> <span>Save swatches</span></>}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

