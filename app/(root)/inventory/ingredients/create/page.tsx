'use client';

import { useTranslation } from 'react-i18next';

import { IngredientForm } from '@/components/dashboard/inventory/ingredient-form';
import { MenuPageShell } from '@/components/dashboard/menu-manager/menu-page-shell';
import ErrorBoundary from '@/components/toaster/toaster';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function CreateIngredientPage() {
  const { t } = useTranslation();

  return (
    <div className="w-full">
      <ErrorBoundary>
        <MenuPageShell
          title={t('dashboard.inventory.addIngredientTitle')}
          description={t('dashboard.inventory.addIngredientDescription')}
          loading={false}
        >
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
              <CardTitle>
                {t('dashboard.inventory.createIngredientTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <IngredientForm />
            </CardContent>
          </Card>
        </MenuPageShell>
      </ErrorBoundary>
    </div>
  );
}
