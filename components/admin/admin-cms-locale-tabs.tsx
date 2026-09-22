'use client';

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Props = {
  english: ReactNode;
  spanish: ReactNode;
  /** i18n key prefix, e.g. `admin.blog` */
  labelsNs: 'admin.blog' | 'admin.docs';
};

export function AdminCmsLocaleTabs({ english, spanish, labelsNs }: Props) {
  const { t } = useTranslation();
  const englishLabel = t(`${labelsNs}.english`);
  const spanishLabel = t(`${labelsNs}.spanish`);

  return (
    <Tabs defaultValue="en" className="space-y-4">
      <TabsList className="grid h-10 w-full max-w-md grid-cols-2">
        <TabsTrigger value="en">{englishLabel}</TabsTrigger>
        <TabsTrigger value="es">{spanishLabel}</TabsTrigger>
      </TabsList>
      <TabsContent value="en" className="mt-0 space-y-4">
        {english}
      </TabsContent>
      <TabsContent value="es" className="mt-0 space-y-4">
        {spanish}
      </TabsContent>
    </Tabs>
  );
}
