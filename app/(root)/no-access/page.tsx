'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BanIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function NoAccessPage() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-col items-center justify-center">
          <BanIcon className="w-10 h-10 text-destructive text-center" />
          <CardTitle className="flex items-center gap-2 justify-center text-xl font-bold text-destructive">
            {t('dashboard.noAccess.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            {t('dashboard.noAccess.message')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
