'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';

import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { adminCardClass } from '@/components/admin/admin-surface';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SaveConfirmation } from '@/components/ui/confirmation-dialogs';
import { Loader2, Save } from 'lucide-react';

const KEYS = [
  {
    key: 'default_trial_days',
    labelKey: 'admin.settingsPage.trialDaysLabel',
    descriptionKey: 'admin.settingsPage.trialDaysDescription',
  },
  // {
  //   key: 'support_email',
  //   label: 'Platform support email',
  //   description: 'Contact for billing and account issues.',
  // },
  // {
  //   key: 'billing_notice',
  //   label: 'Billing notice',
  //   description: 'Optional message shown in owner dashboards or invoices later.',
  // },
] as const;

export default function AdminSettingsPage() {
  const { t } = useTranslation();
  const [map, setMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);

  useEffect(() => {
    axios
      .get('/api/admin/settings')
      .then((r) => setMap(r.data.data ?? {}))
      .catch(() => toast.error(t('admin.settingsPage.loadError')))
      .finally(() => setLoading(false));
  }, [t]);

  const save = async () => {
    setSaving(true);
    try {
      const entries = KEYS.map(({ key }) => ({ key, value: map[key] ?? '' }));
      const res = await axios.put('/api/admin/settings', { entries });
      setMap(res.data.data ?? {});
      setShowSaveConfirmation(false);
      toast.success(t('admin.settingsPage.saveSuccess'));
    } catch {
      toast.error(t('admin.settingsPage.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Loader2 className="text-primary animate-spin text-center mx-auto" />;
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        eyebrow={t('admin.settingsPage.eyebrow')}
        title={t('admin.settingsPage.title')}
        description={t('admin.settingsPage.description')}
      />

      <Card className={adminCardClass}>
        <CardHeader>
          <CardTitle>{t('admin.settingsPage.globalsTitle')}</CardTitle>
          <CardDescription>{t('admin.settingsPage.globalsDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {KEYS.map(({ key, labelKey, descriptionKey }) => (
            <div key={key} className="grid gap-2">
              <Label htmlFor={key}>{t(labelKey)}</Label>
              <p className="text-xs text-muted-foreground">{t(descriptionKey)}</p>
              <Input
                id={key}
                value={map[key] ?? ''}
                onChange={(e) => setMap((m) => ({ ...m, [key]: e.target.value }))}
              />
            </div>
          ))}
          <Button type="button" disabled={saving} onClick={() => setShowSaveConfirmation(true)}>
            {saving ? <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span>{t('admin.settingsPage.saving')}</span>
              </> : <>
              <Save className="h-4 w-4 mr-2" />
              <span>{t('admin.settingsPage.saveChanges')}</span>
              </>}
          </Button>
        </CardContent>
      </Card>

      <SaveConfirmation
        open={showSaveConfirmation}
        title={t('admin.settingsPage.saveDialogTitle')}
        description={t('admin.settingsPage.saveDialogDescription')}
        loading={saving}
        onConfirm={() => void save()}
        onCancel={() => setShowSaveConfirmation(false)}
      />
    </div>
  );
}
