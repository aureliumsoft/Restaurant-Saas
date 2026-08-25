'use client';

import { IngredientForm } from '@/components/dashboard/inventory/ingredient-form';
import { MenuPageShell } from '@/components/dashboard/menu-manager/menu-page-shell';
import ErrorBoundary from '@/components/toaster/toaster';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function CreateIngredientPage() {
  return (
    <div className="w-full">
      <ErrorBoundary>
        <MenuPageShell
          title="Add ingredient"
          description="Create an ingredient to track stock and attach to product recipes."
          loading={false}
        >
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
              <CardTitle>Create ingredient</CardTitle>
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
