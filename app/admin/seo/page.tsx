'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  ExternalLink,
  Loader2,
  Save,
  Search,
  BarChart3,
  ShieldCheck,
} from 'lucide-react';

import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { adminCardClass } from '@/components/admin/admin-surface';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SaveConfirmation } from '@/components/ui/confirmation-dialogs';
import { SEO_SETTING_KEYS } from '@/lib/platform-settings';

const FIELDS = [
  {
    key: 'seo_google_site_verification' as const,
    label: 'Google site verification',
    description:
      'Paste the content value from Search Console HTML-tag verification (not the full meta tag).',
    placeholder: 'e.g. AbCdEf123…',
    icon: ShieldCheck,
  },
  {
    key: 'seo_ga4_measurement_id' as const,
    label: 'Google Analytics 4 Measurement ID',
    description:
      'GA4 property ID for the Foodluk marketing site (format G-XXXXXXXX).',
    placeholder: 'G-XXXXXXXX',
    icon: BarChart3,
  },
  {
    key: 'seo_gsc_property_url' as const,
    label: 'Search Console property URL',
    description:
      'Verified property URL used for quick links (e.g. https://foodluk.com/).',
    placeholder: 'https://foodluk.com/',
    icon: Search,
  },
] as const;

function gscOpenUrl(propertyUrl: string): string {
  const trimmed = propertyUrl.trim();
  if (!trimmed) return 'https://search.google.com/search-console';
  return `https://search.google.com/search-console/performance/search-analytics?resource_id=${encodeURIComponent(trimmed)}`;
}

function gaOpenUrl(measurementId: string): string {
  const id = measurementId.trim();
  if (!id) return 'https://analytics.google.com/';
  return 'https://analytics.google.com/analytics/web/';
}

export default function AdminSeoPage() {
  const [map, setMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);

  useEffect(() => {
    axios
      .get('/api/admin/settings')
      .then((r) => setMap(r.data.data ?? {}))
      .catch(() => toast.error('Could not load SEO settings'))
      .finally(() => setLoading(false));
  }, []);

  const verificationReady = Boolean(map.seo_google_site_verification?.trim());
  const gaReady = Boolean(map.seo_ga4_measurement_id?.trim());
  const gscReady = Boolean(map.seo_gsc_property_url?.trim());

  const sitemapUrl = useMemo(() => {
    if (typeof window === 'undefined') return '/sitemap.xml';
    return `${window.location.origin}/sitemap.xml`;
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const entries = SEO_SETTING_KEYS.map((key) => ({
        key,
        value: (map[key] ?? '').trim(),
      }));
      const res = await axios.put('/api/admin/settings', { entries });
      setMap(res.data.data ?? {});
      setShowSaveConfirmation(false);
      toast.success('SEO settings saved');
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Loader2 className="text-primary mx-auto animate-spin" />;
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        eyebrow="System"
        title="SEO & analytics"
        description="Connect Google Search Console and Analytics to monitor Foodluk platform search and traffic performance."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <a
                href={gscOpenUrl(map.seo_gsc_property_url ?? '')}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Search Console
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a
                href={gaOpenUrl(map.seo_ga4_measurement_id ?? '')}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Analytics
              </a>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatusCard
          label="Site verification"
          ready={verificationReady}
          hint={
            verificationReady
              ? 'Meta tag will render in the site head'
              : 'Add the verification token below'
          }
        />
        <StatusCard
          label="Google Analytics"
          ready={gaReady}
          hint={
            gaReady
              ? 'GA4 tag loads on marketing & auth pages'
              : 'Add a G- Measurement ID'
          }
        />
        <StatusCard
          label="Search Console link"
          ready={gscReady}
          hint={
            gscReady
              ? 'Quick link uses your property URL'
              : 'Optional — helps open the right property'
          }
        />
      </div>

      <Card className={adminCardClass}>
        <CardHeader>
          <CardTitle>Connection settings</CardTitle>
          <CardDescription>
            Values are stored in PlatformSetting and applied on the public site after
            save. Verify ownership in Search Console once the meta tag is live.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {FIELDS.map(({ key, label, description, placeholder, icon: Icon }) => (
            <div key={key} className="grid gap-2">
              <Label htmlFor={key} className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                {label}
              </Label>
              <p className="text-xs text-muted-foreground">{description}</p>
              <Input
                id={key}
                value={map[key] ?? ''}
                placeholder={placeholder}
                onChange={(e) =>
                  setMap((m) => ({ ...m, [key]: e.target.value }))
                }
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          ))}
          <Button
            type="button"
            disabled={saving}
            onClick={() => setShowSaveConfirmation(true)}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                <span>Saving…</span>
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                <span>Save SEO settings</span>
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card className={adminCardClass}>
        <CardHeader>
          <CardTitle>Setup checklist</CardTitle>
          <CardDescription>
            One-time steps in Google after saving tokens here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-3 pl-5 text-sm text-muted-foreground">
            <li>
              In Search Console, add a URL-prefix property for your production domain
              and choose <strong className="text-foreground">HTML tag</strong>{' '}
              verification. Paste only the <code className="text-foreground">content</code>{' '}
              value above, save, then click Verify.
            </li>
            <li>
              Submit the sitemap:{' '}
              <a
                className="font-medium text-foreground underline-offset-4 hover:underline"
                href={sitemapUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {sitemapUrl}
              </a>
            </li>
            <li>
              Create a GA4 property for Foodluk, copy the Measurement ID (
              <code className="text-foreground">G-…</code>), save it here, then confirm
              realtime hits on the homepage.
            </li>
            <li>
              Optionally link GA4 ↔ Search Console in Google’s product settings for
              richer reports.
            </li>
          </ol>
        </CardContent>
      </Card>

      <SaveConfirmation
        open={showSaveConfirmation}
        title="Save SEO settings"
        description="Verification and Analytics tags will update on the public site. Save now?"
        loading={saving}
        onConfirm={() => void save()}
        onCancel={() => setShowSaveConfirmation(false)}
      />
    </div>
  );
}

function StatusCard({
  label,
  ready,
  hint,
}: {
  label: string;
  ready: boolean;
  hint: string;
}) {
  return (
    <Card className={adminCardClass}>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-base">
          {ready ? (
            <span className="text-emerald-600 dark:text-emerald-400">Configured</span>
          ) : (
            <span className="text-muted-foreground">Not set</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
