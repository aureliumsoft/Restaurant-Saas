'use client';

import { useEffect, useMemo, useState, type ComponentType } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const [map, setMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);

  useEffect(() => {
    axios
      .get('/api/admin/settings')
      .then((r) => setMap(r.data.data ?? {}))
      .catch(() => toast.error(t('admin.seoPage.loadError')))
      .finally(() => setLoading(false));
  }, [t]);

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
  const analyticsViaGtm = gtmReady && !gaReady;

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
      toast.success(t('admin.seoPage.savedToast'));
    } catch {
      toast.error(t('admin.seoPage.saveFailed'));
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
        eyebrow={t('admin.seoPage.eyebrow')}
        title={t('admin.seoPage.title')}
        description={t('admin.seoPage.description')}
        actions={
          <div className="flex flex-wrap gap-2">
            
            <Button variant="outline" asChild>
              <a
                href={gscOpenUrl(map.seo_gsc_property_url ?? '')}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                {t('admin.traffic.searchConsole')}
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a
                href={gaOpenUrl(map.seo_ga4_measurement_id ?? '')}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                {t('admin.seoPage.analytics')}
              </a>
            </Button>
          </div>
        }
      />

      <AdminTrafficMetrics />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatusCard
          label={t('admin.seoPage.statusVerification')}
          ready={verificationReady}
          readyLabel={t('admin.seoPage.statusConfigured')}
          notReadyLabel={t('admin.seoPage.statusNotSet')}
          hint={
            verificationReady
              ? t('admin.seoPage.hintVerificationReady')
              : t('admin.seoPage.hintVerificationMissing')
          }
        />
        <StatusCard
          label={t('admin.seoPage.statusGtm')}
          ready={gtmReady}
          readyLabel={t('admin.seoPage.statusConfigured')}
          notReadyLabel={t('admin.seoPage.statusNotSet')}
          hint={
            gtmReady
              ? t('admin.seoPage.hintGtmReady')
              : t('admin.seoPage.hintGtmMissing')
          }
        />
        <StatusCard
          label={t('admin.seoPage.statusGa')}
          ready={analyticsViaGtm || gaReady}
          readyLabel={t('admin.seoPage.statusConfigured')}
          notReadyLabel={t('admin.seoPage.statusNotSet')}
          hint={
            gaReady
              ? t('admin.seoPage.hintGaDirect')
              : analyticsViaGtm
                ? t('admin.seoPage.hintGaViaGtm')
                : t('admin.seoPage.hintGaMissing')
          }
        />
        <StatusCard
          label={t('admin.seoPage.statusReportingAuth')}
          ready={reportingSaReady || reportingOauthReady}
          readyLabel={t('admin.seoPage.statusConfigured')}
          notReadyLabel={t('admin.seoPage.statusNotSet')}
          hint={
            reportingSaReady
              ? t('admin.seoPage.hintReportingSa')
              : reportingOauthReady
                ? t('admin.seoPage.hintReportingOauth')
                : t('admin.seoPage.hintReportingMissing')
          }
        />
      </div>

      {/* 1 — Site tracking */}
      <Card className={adminCardClass}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tags className="h-5 w-5 text-muted-foreground" />
            {t('admin.seoPage.siteTrackingTitle')}
          </CardTitle>
          <CardDescription>
            {t('admin.seoPage.siteTrackingDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Field
            id="seo_google_site_verification"
            label={t('admin.seoPage.verificationLabel')}
            icon={ShieldCheck}
            description={t('admin.seoPage.verificationDescription')}
            placeholder="e.g. AbCdEf123…"
            value={map.seo_google_site_verification ?? ''}
            onChange={(v) => setField('seo_google_site_verification', v)}
          />
          <Field
            id="seo_gtm_container_id"
            label={t('admin.seoPage.gtmLabel')}
            icon={Tags}
            description={t('admin.seoPage.gtmDescription')}
            placeholder="GTM-XXXXXXX"
            value={map.seo_gtm_container_id ?? ''}
            onChange={(v) => setField('seo_gtm_container_id', v)}
          />
          <Field
            id="seo_ga4_measurement_id"
            label={t('admin.seoPage.gaMeasurementLabel')}
            icon={BarChart3}
            description={t('admin.seoPage.gaMeasurementDescription')}
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
            {t('admin.seoPage.dashboardPropertiesTitle')}
          </CardTitle>
          <CardDescription>
            {t('admin.seoPage.dashboardPropertiesDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Field
            id="seo_gsc_property_url"
            label={t('admin.seoPage.gscUrlLabel')}
            icon={Search}
            description={t('admin.seoPage.gscUrlDescription')}
            placeholder="https://foodluk.com/"
            value={map.seo_gsc_property_url ?? ''}
            onChange={(v) => setField('seo_gsc_property_url', v)}
          />
          <Field
            id="seo_ga4_property_id"
            label={t('admin.seoPage.gaPropertyIdLabel')}
            icon={BarChart3}
            description={t('admin.seoPage.gaPropertyIdDescription')}
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
            {t('admin.seoPage.serviceAccountTitle')}
          </CardTitle>
          <CardDescription>
            {t('admin.seoPage.serviceAccountDescriptionPrefix')}{' '}
            <code className="text-foreground">GOOGLE_REPORTING_SERVICE_ACCOUNT_JSON</code>{' '}
            {t('admin.seoPage.serviceAccountDescriptionSuffix')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="seo_google_reporting_service_account_json">
            {t('admin.seoPage.serviceAccountJsonLabel')}
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
            {t('admin.seoPage.serviceAccountOauthNote')}
          </p>
        </CardContent>
      </Card>

      {/* 4 — OAuth */}
      <Card className={adminCardClass}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-muted-foreground" />
            {t('admin.seoPage.oauthTitle')}
          </CardTitle>
          <CardDescription>
            {t('admin.seoPage.oauthDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Field
            id="seo_google_client_id"
            label={t('admin.seoPage.clientIdLabel')}
            icon={KeyRound}
            description={t('admin.seoPage.clientIdDescription')}
            placeholder="….apps.googleusercontent.com"
            value={map.seo_google_client_id ?? ''}
            onChange={(v) => setField('seo_google_client_id', v)}
          />
          <Field
            id="seo_google_client_secret"
            label={t('admin.seoPage.clientSecretLabel')}
            icon={KeyRound}
            description={t('admin.seoPage.clientSecretDescription')}
            placeholder="GOCSPX-…"
            value={map.seo_google_client_secret ?? ''}
            onChange={(v) => setField('seo_google_client_secret', v)}
            inputType="password"
          />
          <Field
            id="seo_google_reporting_refresh_token"
            label={t('admin.seoPage.refreshTokenLabel')}
            icon={KeyRound}
            description={t('admin.seoPage.refreshTokenDescription')}
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
              <span>{t('admin.docsForm.saving')}</span>
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              <span>{t('admin.seoPage.saveSeoSettings')}</span>
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground">
          {t('admin.seoPage.credentialsStoredNote')}
        </p>
      </div>

      <Card className={adminCardClass}>
        <CardHeader>
          <CardTitle>{t('admin.seoPage.checklistTitle')}</CardTitle>
          <CardDescription>
            {t('admin.seoPage.checklistDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-3 pl-5 text-sm text-muted-foreground">
            <li>
              {t('admin.seoPage.checklistStep1Prefix')}{' '}
              <strong className="text-foreground">{t('admin.seoPage.siteTrackingTitle')}</strong>
              {t('admin.seoPage.checklistStep1Middle')}{' '}
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
              {t('admin.seoPage.checklistStep2')}
            </li>
            <li>
              {t('admin.seoPage.checklistStep3Prefix')} <strong className="text-foreground">{t('admin.seoPage.dashboardPropertiesTitle')}</strong>
              {t('admin.seoPage.checklistStep3Suffix')}
            </li>
            <li>
              {t('admin.seoPage.checklistStep4Prefix')}{' '}
              <strong className="text-foreground">{t('admin.seoPage.serviceAccountTitle')}</strong>
              {t('admin.seoPage.checklistStep4Suffix')}
            </li>
          </ol>
        </CardContent>
      </Card>

      <SaveConfirmation
        open={showSaveConfirmation}
        title={t('admin.seoPage.saveDialogTitle')}
        description={t('admin.seoPage.saveDialogDescription')}
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
  readyLabel,
  notReadyLabel,
}: {
  label: string;
  ready: boolean;
  hint: string;
  readyLabel: string;
  notReadyLabel: string;
}) {
  return (
    <Card className={adminCardClass}>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-base">
          {ready ? (
            <span className="text-emerald-600 dark:text-emerald-400">
              {readyLabel}
            </span>
          ) : (
            <span className="text-muted-foreground">{notReadyLabel}</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
