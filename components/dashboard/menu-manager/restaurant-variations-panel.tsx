'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { SearchField } from '@/components/ui/search-field';
import { TablePagination } from '@/components/ui/table-pagination';
import { apiErrorMessage } from '@/lib/api-error-message';
import {
  bilingualInputFromStored,
  parseBilingualInput,
  resolveBilingualText,
  serializeBilingualInput,
} from '@/lib/menu/bilingual-text';
import { filterNameTextInput } from '@/lib/validation/fields';
import { useUiLanguage } from '@/hooks/use-ui-language';

import type { RestaurantVariationRow } from './types';

const PAGE_SIZE = 12;

export function RestaurantVariationsPanel() {
  const { t } = useTranslation();
  const uiLang = useUiLanguage();
  const [rows, setRows] = useState<RestaurantVariationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [searchDraft, setSearchDraft] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

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

  const applySearch = () => {
    setAppliedSearch(searchDraft.trim());
    setPage(1);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get<{
        data: RestaurantVariationRow[];
        pagination?: {
          page: number;
          pageSize: number;
          total: number;
          totalPages: number;
        };
      }>('/api/restaurant/variations', {
        params: {
          page,
          limit: PAGE_SIZE,
          q: appliedSearch || undefined,
        },
      });
      setRows(res.data.data ?? []);
      if (res.data.pagination) setPagination(res.data.pagination);
    } catch {
      toast.error('Could not load variations.');
    } finally {
      setLoading(false);
    }
  }, [page, appliedSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  const canAdd = Boolean(name.trim()) && !adding;

  const add = async () => {
    if (!name.trim() || adding) return;
    if (!parseBilingualInput(name).en) {
      toast.error(t('dashboard.menuManager.variation.nameRequired'));
      return;
    }
    setAdding(true);
    try {
      await axios.post('/api/restaurant/variations', {
        name: serializeBilingualInput(name),
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
    if (!parseBilingualInput(pendingSave.name).en) {
      toast.error(t('dashboard.menuManager.variation.nameRequired'));
      return;
    }
    setSaving(true);
    try {
      await axios.patch(`/api/restaurant/variations/${pendingSave.id}`, {
        name: serializeBilingualInput(pendingSave.name),
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
      toast.success(t('dashboard.menuManager.variation.deleted'));
      await load();
    } catch (e: unknown) {
      toast.error(
        apiErrorMessage(e, t('dashboard.menuManager.variation.deleteFailed'))
      );
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
          <CardTitle>
            {t('dashboard.menuManager.variation.createTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 items-end justify-end">
              <div className="grid gap-1.5">
                <Label htmlFor="new-variation-name">
                  {t('dashboard.common.name')}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t('dashboard.menuManager.bilingual.hint')}
                </p>
                <Input
                  id="new-variation-name"
                  placeholder={t(
                    'dashboard.menuManager.bilingual.namePlaceholder'
                  )}
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
                <Label htmlFor="new-variation-short">
                  {t('dashboard.menuManager.variation.shortLabelOptional')}
                </Label>
                <Input
                  id="new-variation-short"
                  placeholder={t(
                    'dashboard.menuManager.variation.shortLabelPlaceholder'
                  )}
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
              {adding
                ? t('dashboard.menuManager.adding')
                : t('dashboard.menuManager.variation.add')}
            </Button>
            </div>
           
          </div>
          <SearchField
            value={searchDraft}
            onChange={setSearchDraft}
            onSearch={applySearch}
            onClear={() => {
              setSearchDraft('');
              setAppliedSearch('');
              setPage(1);
            }}
            appliedValue={appliedSearch}
            placeholder={t('dashboard.variations.searchPlaceholder')}
          />
          {loading ? (
            <p className="text-sm text-muted-foreground">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
            </p>
          ) : (
            <div className="space-y-4">
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
              <TablePagination
                pagination={pagination}
                page={page}
                onPageChange={setPage}
                loading={loading}
              />
            </div>
          )}

          {!loading && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {appliedSearch
                ? t('dashboard.variations.emptySearch')
                : t('dashboard.variations.empty')}
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
        title={t('dashboard.menuManager.variation.save')}
        description={t('dashboard.menuManager.variation.saveDescription')}
        itemName={
          pendingSave?.name
            ? resolveBilingualText(pendingSave.name, 'en')
            : undefined
        }
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
        title={t('dashboard.menuManager.variation.delete')}
        description={t('dashboard.menuManager.variation.deleteDescription')}
        itemName={resolveBilingualText(deletingRow?.name, uiLang)}
        loading={deleting}
        onConfirm={() => {
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
  const [editName, setEditName] = useState(() =>
    bilingualInputFromStored(variation.name)
  );
  const { t } = useTranslation();
  const uiLang = useUiLanguage();
  const [editShortLabel, setEditShortLabel] = useState(
    variation.shortLabel ?? ''
  );
  const displayName = resolveBilingualText(variation.name, uiLang);

  useEffect(() => {
    setEditName(bilingualInputFromStored(variation.name));
    setEditShortLabel(variation.shortLabel ?? '');
    setEditing(false);
  }, [variation.id, variation.name, variation.shortLabel]);

  const cancelEdit = () => {
    setEditName(bilingualInputFromStored(variation.name));
    setEditShortLabel(variation.shortLabel ?? '');
    setEditing(false);
  };

  const requestSave = () => {
    const nextName = editName.trim();
    if (!nextName) return;
    const nextShort = editShortLabel.trim();
    if (
      nextName === bilingualInputFromStored(variation.name) &&
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
            aria-label={t('dashboard.menuManager.variation.deleteAria')}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {editing ? (
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label>{t('dashboard.common.name')}</Label>
              <Input
                value={editName}
                placeholder={t(
                  'dashboard.menuManager.bilingual.namePlaceholder'
                )}
                onChange={(e) =>
                  setEditName(filterNameTextInput(e.target.value))
                }
                autoFocus
                aria-label={t('dashboard.menuManager.variation.nameAria')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') requestSave();
                  if (e.key === 'Escape') cancelEdit();
                }}
              />
              <p className="text-xs text-muted-foreground">
                {t('dashboard.menuManager.bilingual.hint')}
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label>
                {t('dashboard.menuManager.variation.shortLabel')}
              </Label>
              <Input
                value={editShortLabel}
                onChange={(e) => setEditShortLabel(e.target.value)}
                placeholder={t(
                  'dashboard.menuManager.variation.shortLabelPlaceholder'
                )}
                maxLength={20}
                aria-label={t('dashboard.menuManager.variation.shortLabel')}
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                className="flex-1"
                disabled={!editName.trim()}
                onClick={requestSave}
              >
                {t('dashboard.common.save')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={cancelEdit}
                aria-label={t('dashboard.common.cancel')}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base leading-snug">
              {displayName}
            </CardTitle>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0"
              onClick={() => setEditing(true)}
              aria-label={t('dashboard.menuManager.variation.editAria')}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardHeader>
      {!editing && variation.shortLabel ? (
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground">
            {t('dashboard.menuManager.variation.shortLabelHint')}
          </p>
        </CardContent>
      ) : null}
    </Card>
  );
}
