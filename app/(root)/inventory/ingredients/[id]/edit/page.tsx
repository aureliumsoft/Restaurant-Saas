'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Loader2 } from 'lucide-react';

import { resolveBilingualText } from '@/lib/menu/bilingual-text';
import { useUiLanguage } from '@/hooks/use-ui-language';

import {
  EMPTY_INGREDIENT_FORM,
  IngredientForm,
  type IngredientFormState,
} from '@/components/dashboard/inventory/ingredient-form';
import { MenuPageShell } from '@/components/dashboard/menu-manager/menu-page-shell';
import ErrorBoundary from '@/components/toaster/toaster';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { INGREDIENT_UNIT_VALUES } from '@/lib/inventory/validation';
import { useBranchContext, withBranchQuery } from '@/hooks/use-branch-context';

type IngredientDetail = {
  id: string;
  name: string;
  description: string | null;
  quantity: number;
  unit: (typeof INGREDIENT_UNIT_VALUES)[number];
  isMajor: boolean;
  sku: string | null;
  minQuantity: number | null;
  unitCost: number | null;
  isActive: boolean;
  imageData: string | null;
};

export default function EditIngredientPage() {
  const { t } = useTranslation();
  const uiLang = useUiLanguage();
  const params = useParams();
  const ingredientId = typeof params.id === 'string' ? params.id : '';
  const { activeBranchId, activeBranchUrlId } = useBranchContext();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [initial, setInitial] = useState<IngredientFormState | null>(null);
  const [name, setName] = useState('');

  useEffect(() => {
    if (!ingredientId) {
      setLoading(false);
      setNotFound(true);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setNotFound(false);

    void axios
      .get<{ data: IngredientDetail }>(
        withBranchQuery(
          `/api/restaurant/inventory/ingredients/${ingredientId}`,
          activeBranchId,
          activeBranchUrlId
        )
      )
      .then((res) => {
        if (cancelled) return;
        const row = res.data.data;
        const unit = INGREDIENT_UNIT_VALUES.includes(row.unit)
          ? row.unit
          : 'PCS';
        setName(resolveBilingualText(row.name, uiLang) || row.name);
        setInitial({
          ...EMPTY_INGREDIENT_FORM,
          name: row.name,
          description: row.description ?? '',
          quantity: String(row.quantity),
          unit,
          isMajor: row.isMajor,
          imageUrl: row.imageData ?? '',
          sku: row.sku ?? '',
          minQuantity:
            row.minQuantity != null ? String(row.minQuantity) : '',
          unitCost: row.unitCost != null ? String(row.unitCost) : '',
          isActive: row.isActive,
        });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const err = e as { response?: { status?: number } };
        if (err.response?.status !== 404) {
          toast.error(t('dashboard.inventory.loadFailed'));
        }
        setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ingredientId, activeBranchId, activeBranchUrlId, t, uiLang]);

  return (
    <div className="w-full">
      <ErrorBoundary>
        <MenuPageShell
          title={t('dashboard.inventory.editIngredientTitle')}
          description={t('dashboard.inventory.editIngredientDescription')}
          loading={false}
        >
          {notFound ? (
            <Card>
              <CardContent className="flex flex-col gap-3 p-6">
                <p className="text-sm text-muted-foreground">
                  {t('dashboard.inventory.notFound')}
                </p>
                <Button type="button" asChild className="w-fit">
                  <Link href="/inventory">
                    {t('dashboard.inventory.backToInventory')}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
                <CardTitle>
                  {name || t('dashboard.inventory.editIngredientTitle')}
                </CardTitle>
               
              </CardHeader>
              <CardContent>
                {loading || !initial ? (
                  <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                ) : (
                  <IngredientForm
                    key={ingredientId}
                    initial={initial}
                    ingredientId={ingredientId}
                  />
                )}
              </CardContent>
            </Card>
          )}
        </MenuPageShell>
      </ErrorBoundary>
    </div>
  );
}
