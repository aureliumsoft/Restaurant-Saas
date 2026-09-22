'use client';

import { useTranslation } from 'react-i18next';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { LanguageSwitcher } from '@/components/main/language-switcher';

export function UiLanguagePreferenceCard() {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.uiLanguage.title')}</CardTitle>
        <CardDescription>
          {t('settings.uiLanguage.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="max-w-sm">
        <p className="mb-2 text-sm font-medium text-foreground">
          {t('settings.uiLanguage.label')}
        </p>
        <LanguageSwitcher variant="toggle" />
      </CardContent>
    </Card>
  );
}
