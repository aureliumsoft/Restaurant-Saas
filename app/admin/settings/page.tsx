'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

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
    label: 'Default trial length (days)',
    description: 'Shown to operators as guidance; enforce in billing when integrated.',
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
  const [map, setMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);

  useEffect(() => {
    axios
      .get('/api/admin/settings')
      .then((r) => setMap(r.data.data ?? {}))
      .catch(() => toast.error('Could not load settings'))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const entries = KEYS.map(({ key }) => ({ key, value: map[key] ?? '' }));
      const res = await axios.put('/api/admin/settings', { entries });
      setMap(res.data.data ?? {});
      setShowSaveConfirmation(false);
      toast.success('Settings saved');
    } catch {
      toast.error('Save failed');
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
        eyebrow="System"
        title="Platform settings"
        description="Key–value configuration for the whole SaaS product."
      />

      <Card className={adminCardClass}>
        <CardHeader>
          <CardTitle>Globals</CardTitle>
          <CardDescription>Stored in the database; safe to change anytime.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {KEYS.map(({ key, label, description }) => (
            <div key={key} className="grid gap-2">
              <Label htmlFor={key}>{label}</Label>
              <p className="text-xs text-muted-foreground">{description}</p>
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
            <span>Saving...</span>
              </> : <>
              <Save className="h-4 w-4 mr-2" />
              <span>Save changes</span>
              </>}
          </Button>
        </CardContent>
      </Card>

      <SaveConfirmation
        open={showSaveConfirmation}
        title="Save platform settings"
        description="These values apply across the whole product. Save now?"
        loading={saving}
        onConfirm={() => void save()}
        onCancel={() => setShowSaveConfirmation(false)}
      />
    </div>
  );
}
