'use client';

import { useEffect, useMemo, useState, type ComponentType } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  ExternalLink,
  Loader2,
  Save,
  Search,
  BarChart3,
  ShieldCheck,
  Tags,
  KeyRound,
  FileJson,
} from 'lucide-react';

import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminTrafficMetrics } from '@/components/admin/admin-traffic-metrics';
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
import { Textarea } from '@/components/ui/textarea';
import { SaveConfirmation } from '@/components/ui/confirmation-dialogs';
import { SEO_SETTING_KEYS } from '@/lib/platform-settings';

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
  const gtmReady = Boolean(map.seo_gtm_container_id?.trim());
  const gaReady = Boolean(map.seo_ga4_measurement_id?.trim());
  const gscReady = Boolean(map.seo_gsc_property_url?.trim());
  const reportingSaReady = Boolean(
    map.seo_google_reporting_service_account_json?.trim()
  );
  const reportingOauthReady = Boolean(
    map.seo_google_client_id?.trim() &&
      map.seo_google_client_secret?.trim() &&
      map.seo_google_reporting_refresh_token?.trim()
  );
  const analyticsViaGtm = gtmReady;

  const sitemapUrl = useMemo(() => {
    if (typeof window === 'undefined') return '/sitemap.xml';
    return `${window.location.origin}/sitemap.xml`;
  }, []);

  function setField(key: string, value: string) {
    setMap((m) => ({ ...m, [key]: value }));
  }

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
        description="Public tracking tags, dashboard property IDs, and Google API credentials for reporting."
        actions={
          <div className="flex flex-wrap gap-2">
            
            <Button variant="outline" asChild>
              <a
                href={gscOpenUrl(map.seo_gsc_property_url ?? '')}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Search Console
              </a>
            </Button>
            <Button variant="outline" asChild>
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

      <AdminTrafficMetrics />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          label="Google Tag Manager"
          ready={gtmReady}
          hint={
            gtmReady
              ? 'Official GTM snippet on marketing & auth pages'
              : 'Add a GTM- container ID'
          }
        />
        <StatusCard
          label="Google Analytics"
          ready={analyticsViaGtm || gaReady}
          hint={
            analyticsViaGtm
              ? 'Configure GA4 inside GTM (direct G- tag is skipped)'
              : gaReady
                ? 'Direct GA4 gtag loads on marketing & auth pages'
                : 'Add GTM or a G- Measurement ID'
          }
        />
        <StatusCard
          label="Reporting API auth"
          ready={reportingSaReady || reportingOauthReady}
          hint={
            reportingSaReady
              ? 'Service account JSON configured'
              : reportingOauthReady
                ? 'OAuth client + refresh token configured'
                : 'Add service account or OAuth credentials below'
          }
        />
      </div>

      {/* 1 — Site tracking */}
      <Card className={adminCardClass}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tags className="h-5 w-5 text-muted-foreground" />
            Site tracking
          </CardTitle>
          <CardDescription>
            Public tags for Foodluk marketing pages (saved to PlatformSetting).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Field
            id="seo_google_site_verification"
            label="Google site verification"
            icon={ShieldCheck}
            description="Paste the content value from Search Console HTML-tag verification (not the full meta tag)."
            placeholder="e.g. AbCdEf123…"
            value={map.seo_google_site_verification ?? ''}
            onChange={(v) => setField('seo_google_site_verification', v)}
          />
          <Field
            id="seo_gtm_container_id"
            label="Google Tag Manager container ID"
            icon={Tags}
            description="Web container (GTM-XXXXXXX). When set, GTM is installed and the direct GA4 gtag below is skipped."
            placeholder="GTM-XXXXXXX"
            value={map.seo_gtm_container_id ?? ''}
            onChange={(v) => setField('seo_gtm_container_id', v)}
          />
          <Field
            id="seo_ga4_measurement_id"
            label="GA4 Measurement ID"
            icon={BarChart3}
            description="Used only when GTM is empty (browser tag: G-…)."
            placeholder="G-XXXXXXXX"
            value={map.seo_ga4_measurement_id ?? ''}
            onChange={(v) => setField('seo_ga4_measurement_id', v)}
          />
        </CardContent>
      </Card>

      {/* 2 — Dashboard properties */}
      <Card className={adminCardClass}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-muted-foreground" />
            Dashboard properties
          </CardTitle>
          <CardDescription>
            Which Search Console / GA4 properties to pull for admin metrics.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Field
            id="seo_gsc_property_url"
            label="Search Console property URL"
            icon={Search}
            description="Exact property as in GSC (e.g. https://foodluk.com/ or sc-domain:foodluk.com)."
            placeholder="https://foodluk.com/"
            value={map.seo_gsc_property_url ?? ''}
            onChange={(v) => setField('seo_gsc_property_url', v)}
          />
          <Field
            id="seo_ga4_property_id"
            label="GA4 property ID (reporting)"
            icon={BarChart3}
            description="Numeric ID under Analytics Admin → Property settings. Not the G- Measurement ID."
            placeholder="123456789"
            value={map.seo_ga4_property_id ?? ''}
            onChange={(v) => setField('seo_ga4_property_id', v)}
          />
        </CardContent>
      </Card>

      {/* 3 — Service account */}
      <Card className={adminCardClass}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5 text-muted-foreground" />
            Google service account
          </CardTitle>
          <CardDescription>
            Preferred for dashboard metrics. Paste the full JSON key. Grant this
            account access on Search Console and Viewer on GA4. Env{' '}
            <code className="text-foreground">GOOGLE_REPORTING_SERVICE_ACCOUNT_JSON</code>{' '}
            is still used if this field is empty.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="seo_google_reporting_service_account_json">
            Service account JSON
          </Label>
          <Textarea
            id="seo_google_reporting_service_account_json"
            value={map.seo_google_reporting_service_account_json ?? ''}
            onChange={(e) =>
              setField('seo_google_reporting_service_account_json', e.target.value)
            }
            placeholder='{"type":"service_account","project_id":"…","private_key":"…","client_email":"…@….iam.gserviceaccount.com",…}'
            className="min-h-[160px] font-mono text-xs"
            autoComplete="off"
            spellCheck={false}
          />
          <p className="text-xs text-muted-foreground">
            If set, OAuth credentials below are ignored for API calls.
          </p>
        </CardContent>
      </Card>

      {/* 4 — OAuth */}
      <Card className={adminCardClass}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-muted-foreground" />
            Google OAuth (reporting)
          </CardTitle>
          <CardDescription>
            Used only when service account JSON is empty. Separate from next-auth
            Google login env unless you intentionally reuse the same client.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Field
            id="seo_google_client_id"
            label="Client ID"
            icon={KeyRound}
            description="OAuth 2.0 Client ID from Google Cloud Console."
            placeholder="….apps.googleusercontent.com"
            value={map.seo_google_client_id ?? ''}
            onChange={(v) => setField('seo_google_client_id', v)}
          />
          <Field
            id="seo_google_client_secret"
            label="Client secret"
            icon={KeyRound}
            description="OAuth client secret. Falls back to GOOGLE_CLIENT_SECRET if empty."
            placeholder="GOCSPX-…"
            value={map.seo_google_client_secret ?? ''}
            onChange={(v) => setField('seo_google_client_secret', v)}
            inputType="password"
          />
          <Field
            id="seo_google_reporting_refresh_token"
            label="Refresh token"
            icon={KeyRound}
            description="Offline refresh token with webmasters.readonly + analytics.readonly scopes."
            placeholder="1//0…"
            value={map.seo_google_reporting_refresh_token ?? ''}
            onChange={(v) => setField('seo_google_reporting_refresh_token', v)}
            inputType="password"
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
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
        <p className="text-xs text-muted-foreground">
          Credentials are stored server-side and never exposed to the public site.
        </p>
      </div>

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
              In Search Console, verify the site with the HTML tag token from{' '}
              <strong className="text-foreground">Site tracking</strong>, then
              submit the sitemap:{' '}
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
              Add GTM or a Measurement ID under Site tracking for browser analytics.
            </li>
            <li>
              Under <strong className="text-foreground">Dashboard properties</strong>
              , set GSC URL and numeric GA4 property ID.
            </li>
            <li>
              Prefer a service account JSON under{' '}
              <strong className="text-foreground">Google service account</strong>
              ; invite that email to GSC + GA4, enable Search Console API and
              Analytics Data API. Or use OAuth client + refresh token instead.
            </li>
          </ol>
        </CardContent>
      </Card>

      <SaveConfirmation
        open={showSaveConfirmation}
        title="Save SEO settings"
        description="Tracking tags, property IDs, and API credentials will be updated. Save now?"
        loading={saving}
        onConfirm={() => void save()}
        onCancel={() => setShowSaveConfirmation(false)}
      />
    </div>
  );
}

function Field({
  id,
  label,
  icon: Icon,
  description,
  placeholder,
  value,
  onChange,
  inputType = 'text',
}: {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  description: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  inputType?: 'text' | 'password';
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id} className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {label}
      </Label>
      <p className="text-xs text-muted-foreground">{description}</p>
      <Input
        id={id}
        type={inputType}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        spellCheck={false}
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
            <span className="text-emerald-600 dark:text-emerald-400">
              Configured
            </span>
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
