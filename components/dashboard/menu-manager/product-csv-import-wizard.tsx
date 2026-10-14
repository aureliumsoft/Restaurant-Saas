'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SaveConfirmation } from '@/components/ui/confirmation-dialogs';
import { cn } from '@/lib/utils';
import {
  PRODUCT_IMPORT_FIELDS,
  emptyColumnMapping,
  guessColumnMapping,
  parseCsvHeadersAndSample,
  formatIngredientsPreview,
  parseProductsCsvImport,
  type ColumnMapping,
  type ProductImportFieldKey,
} from '@/lib/menu/import-products-csv';

const SKIP_MAP = '__skip__';

type ImportResult = {
  products: number;
  createdProducts: number;
  updatedProducts: number;
  skippedProducts: number;
  variations: number;
  recommendations: number;
  offers: number;
  personalizeGroups: number;
  personalizeOptions: number;
  ingredients?: number;
  createdIngredients?: number;
  warnings?: string[];
};

type ProductCsvImportWizardProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void | Promise<void>;
};

export function ProductCsvImportWizard({
  open,
  onOpenChange,
  onImported,
}: ProductCsvImportWizardProps) {
  const { t } = useTranslation();
  const STEPS = [
    { id: 1, title: t('dashboard.menuManager.csvImport.stepUpload') },
    { id: 2, title: t('dashboard.menuManager.csvImport.stepMap') },
    { id: 3, title: t('dashboard.menuManager.csvImport.stepPreview') },
    { id: 4, title: t('dashboard.menuManager.csvImport.stepFinish') },
  ] as const;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [sampleRow, setSampleRow] = useState<string[]>([]);
  const [totalDataRows, setTotalDataRows] = useState(0);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [mapping, setMapping] = useState<ColumnMapping>(emptyColumnMapping());
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);

  // Soft progress while the server processes the CSV (no streamed %).
  useEffect(() => {
    if (!importing) return;
    setImportProgress(4);
    const started = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - started;
      // Ease toward ~92% over ~45s so long imports still feel active.
      const next = Math.min(92, Math.round(4 + (1 - Math.exp(-elapsed / 18000)) * 88));
      setImportProgress(next);
    }, 250);
    return () => window.clearInterval(timer);
  }, [importing]);

  const reset = () => {
    setStep(1);
    setFile(null);
    setCsvText('');
    setHeaders([]);
    setSampleRow([]);
    setTotalDataRows(0);
    setSkipDuplicates(true);
    setMapping(emptyColumnMapping());
    setImporting(false);
    setImportProgress(0);
    setResult(null);
    setShowCancelConfirm(false);
    setShowFinishConfirm(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const closeWizard = () => {
    reset();
    onOpenChange(false);
  };

  const requestCancel = () => {
    if (importing) return;
    if (result) {
      closeWizard();
      return;
    }
    setShowCancelConfirm(true);
  };

  const onPickFile = async (picked: File | null) => {
    if (!picked) return;
    if (!picked.name.toLowerCase().endsWith('.csv')) {
      toast.error(t('dashboard.menuManager.csvImport.pleaseChooseCsv'));
      return;
    }
    try {
      const text = await picked.text();
      const {
        headers: hdrs,
        dataRows,
        totalDataRows: total,
      } = parseCsvHeadersAndSample(text, 8);
      if (hdrs.length === 0 || total === 0) {
        toast.error(t('dashboard.menuManager.csvImport.csvNoDataRows'));
        return;
      }
      setFile(picked);
      setCsvText(text);
      setHeaders(hdrs);
      setSampleRow(dataRows[0] ?? []);
      setTotalDataRows(total);
      setMapping(guessColumnMapping(hdrs));
      setResult(null);
    } catch {
      toast.error(t('dashboard.menuManager.csvImport.couldNotReadCsv'));
    }
  };

  const nameMapped = Boolean(mapping.name?.trim());

  const previewParsed = useMemo(() => {
    if (!csvText || step < 3) return null;
    return parseProductsCsvImport(csvText, { columnMapping: mapping });
  }, [csvText, mapping, step]);

  const canNextFrom1 = Boolean(file && csvText);
  const canNextFrom2 = nameMapped;
  const canNextFrom3 = (previewParsed?.products.length ?? 0) > 0;

  const goNext = () => {
    if (step === 1 && !canNextFrom1) {
      toast.error(t('dashboard.menuManager.csvImport.selectCsvFirst'));
      return;
    }
    if (step === 2 && !canNextFrom2) {
      toast.error(t('dashboard.menuManager.csvImport.mapNameColumnFirst'));
      return;
    }
    if (step === 3 && !canNextFrom3) {
      toast.error(t('dashboard.menuManager.csvImport.noValidRows'));
      return;
    }
    setStep((s) => Math.min(4, s + 1));
  };

  const goBack = () => setStep((s) => Math.max(1, s - 1));

  const runImport = async () => {
    if (!file) return;
    setShowFinishConfirm(false);
    setImporting(true);
    setImportProgress(4);
    setResult(null);
    try {
      const formData = new FormData();
      formData.set('file', file);
      formData.set('skipDuplicates', skipDuplicates ? 'true' : 'false');
      formData.set('columnMapping', JSON.stringify(mapping));
      const res = await fetch('/api/restaurant/menu/products/import', {
        method: 'POST',
        body: formData,
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        details?: string[];
        data?: ImportResult;
      };
      if (!res.ok) {
        const detail = body.details?.slice(0, 5).join(' | ');
        throw new Error(
          detail
            ? `${body.error ?? t('dashboard.menuManager.csvImport.importFailed')}: ${detail}`
            : body.error ?? t('dashboard.menuManager.csvImport.importFailed')
        );
      }
      setImportProgress(100);
      setResult(body.data ?? null);
      toast.success(t('dashboard.menuManager.csvImport.importFinished'));
      await onImported();
    } catch (e: unknown) {
      setImportProgress(0);
      toast.error(
        e instanceof Error ? e.message : t('dashboard.menuManager.csvImport.importFailed')
      );
    } finally {
      setImporting(false);
    }
  };

  const setFieldMapping = (field: ProductImportFieldKey, value: string) => {
    setMapping((m) => ({
      ...m,
      [field]: value === SKIP_MAP ? '' : value,
    }));
  };

  const sampleForField = (field: ProductImportFieldKey): string => {
    const header = mapping[field];
    if (!header) return '';
    const colRef = header.match(/^__col_(\d+)$/);
    const idx = colRef
      ? Number(colRef[1])
      : headers.findIndex((h) => h === header);
    if (idx == null || idx < 0) return '';
    return (sampleRow[idx] ?? '').trim();
  };

  const columnLabel = (h: string, i: number) =>
    h || t('dashboard.menuManager.csvImport.columnFallback', { n: i + 1 });

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          // Only allow programmatic close via Cancel / success Done.
          if (!next) {
            requestCancel();
            return;
          }
          onOpenChange(true);
        }}
      >
        <DialogContent
          className="flex h-[min(90vh,880px)] w-full max-w-4xl flex-col gap-0 overflow-hidden p-0"
          onInteractOutside={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            requestCancel();
          }}
        >
          <DialogHeader className="border-b px-6 py-4 text-left">
            <DialogTitle>{t('dashboard.menuManager.csvImport.title')}</DialogTitle>
            <DialogDescription>
              {t('dashboard.menuManager.csvImport.description')}
            </DialogDescription>
          </DialogHeader>

          <ol className="flex flex-wrap gap-2 border-b bg-muted/30 px-6 py-3 text-xs">
            {STEPS.map((s) => (
              <li
                key={s.id}
                className={cn(
                  'rounded-full border px-3 py-1 font-medium',
                  step === s.id
                    ? 'border-primary bg-primary text-primary-foreground'
                    : step > s.id
                      ? 'border-emerald-600/40 text-emerald-700 dark:text-emerald-400'
                      : 'border-border text-muted-foreground'
                )}
              >
                {s.id}. {s.title}
              </li>
            ))}
          </ol>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {step === 1 ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label>{t('dashboard.menuManager.csvImport.csvFileLabel')}</Label>
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={(e) => {
                        void onPickFile(e.target.files?.[0] ?? null);
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      {t('dashboard.menuManager.csvImport.chooseFile')}
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {file ? file.name : t('dashboard.menuManager.csvImport.noFileSelected')}
                    </span>
                  </div>
                  {totalDataRows > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {t('dashboard.menuManager.csvImport.rowsDetected', {
                        count: totalDataRows,
                        columns: headers.length,
                      })}
                    </p>
                  ) : null}
                </div>

                <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-primary"
                    checked={skipDuplicates}
                    onChange={(e) => setSkipDuplicates(e.target.checked)}
                  />
                  <span>
                    <span className="block text-sm font-medium">
                      {t('dashboard.menuManager.csvImport.skipExisting')}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {t('dashboard.menuManager.csvImport.skipExistingHint')}
                    </span>
                  </span>
                </label>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t('dashboard.menuManager.csvImport.mapColumnsHint')}
                </p>
                {headers.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {t('dashboard.menuManager.csvImport.fileColumnsLabel')}{' '}
                    {headers.map((h, i) => (
                      <span
                        key={`${i}-${h}`}
                        className="mr-1 inline-block rounded border bg-muted/50 px-1.5 py-0.5 font-medium text-foreground"
                      >
                        {columnLabel(h, i)}
                      </span>
                    ))}
                  </p>
                ) : null}
                <div className="space-y-3">
                  {PRODUCT_IMPORT_FIELDS.map((field) => {
                    const sample = sampleForField(field.key);
                    return (
                    <div
                      key={field.key}
                      className="grid gap-2 sm:grid-cols-[1fr_minmax(0,1.2fr)] sm:items-start"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {field.label}
                          {field.required ? (
                            <span className="text-destructive"> *</span>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {field.table}
                        </p>
                      </div>
                      <div className="space-y-1">
                      <Select
                        value={mapping[field.key] || SKIP_MAP}
                        onValueChange={(v) => setFieldMapping(field.key, v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('dashboard.menuManager.csvImport.doNotImportShort')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={SKIP_MAP}>
                            {t('dashboard.menuManager.csvImport.doNotImport')}
                          </SelectItem>
                          {headers.map((h, i) => (
                            <SelectItem
                              key={`${i}-${h}`}
                              value={h || `__col_${i}`}
                            >
                              {columnLabel(h, i)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {mapping[field.key] ? (
                        <p
                          className="line-clamp-2 text-xs text-muted-foreground"
                          title={sample || undefined}
                        >
                          {sample || t('dashboard.menuManager.csvImport.mappedEmptyRow')}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {t('dashboard.menuManager.csvImport.doNotImportShort')}
                        </p>
                      )}
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="flex min-h-0 flex-col space-y-3">
                <p className="shrink-0 text-sm text-muted-foreground">
                  {t('dashboard.menuManager.csvImport.previewLine', {
                    count: previewParsed?.products.length ?? 0,
                  })}{' '}
                  {skipDuplicates
                    ? t('dashboard.menuManager.csvImport.skipDuplicatesNote')
                    : t('dashboard.menuManager.csvImport.updateDuplicatesNote')}{' '}
                  {t('dashboard.menuManager.csvImport.ingredientsMappedLine', {
                    value: mapping.ingredients || t('dashboard.menuManager.csvImport.notMapped'),
                  })}
                  {previewParsed
                    ? t('dashboard.menuManager.csvImport.withRecipesSuffix', {
                        count: previewParsed.products.filter(
                          (p) => p.ingredients.length > 0
                        ).length,
                      })
                    : ''}
                  .
                </p>
                {previewParsed && previewParsed.errors.length > 0 ? (
                  <div className="max-h-28 shrink-0 overflow-y-auto rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
                    {previewParsed.errors.map((e) => (
                      <p key={e}>{e}</p>
                    ))}
                  </div>
                ) : null}
                <div className="max-h-[min(50vh,420px)] min-h-[200px] overflow-auto rounded-lg border">
                  <table className="w-full min-w-[960px] border-collapse text-left text-xs">
                    <thead className="sticky top-0 z-10 bg-muted shadow-sm">
                      <tr>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">
                          {t('dashboard.menuManager.csvImport.colIndex')}
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">
                          {t('dashboard.menuManager.csvImport.colName')}
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">
                          {t('dashboard.menuManager.csvImport.colIngredients')}
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">
                          {t('dashboard.menuManager.csvImport.colDescription')}
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">
                          {t('dashboard.menuManager.csvImport.colPrice')}
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">
                          {t('dashboard.menuManager.csvImport.colSale')}
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">
                          {t('dashboard.menuManager.csvImport.colCategories')}
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">
                          {t('dashboard.menuManager.csvImport.colVariations')}
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">
                          {t('dashboard.menuManager.csvImport.colRecommendations')}
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">
                          {t('dashboard.menuManager.csvImport.colOffers')}
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">
                          {t('dashboard.menuManager.csvImport.colPersonalize')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(previewParsed?.products ?? []).map((p, idx) => (
                        <tr
                          key={`${p.name}-${idx}`}
                          className="border-t border-border/60 even:bg-muted/20"
                        >
                          <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">
                            {idx + 1}
                          </td>
                          <td className="max-w-[160px] whitespace-normal break-words px-3 py-2 font-medium">
                            {p.name}
                          </td>
                          <td className="max-w-[220px] whitespace-normal break-words px-3 py-2">
                            {formatIngredientsPreview(p.ingredients) || '—'}
                          </td>
                          <td className="max-w-[200px] whitespace-normal break-words px-3 py-2 text-muted-foreground">
                            {p.description || '—'}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                            {p.price}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                            {p.salePrice ?? '—'}
                          </td>
                          <td className="max-w-[180px] whitespace-normal break-words px-3 py-2">
                            {p.categoryNames.join('; ') || '—'}
                          </td>
                          <td className="max-w-[200px] whitespace-normal break-words px-3 py-2">
                            {p.variations.map((v) => v.title).join('; ') ||
                              '—'}
                          </td>
                          <td className="max-w-[200px] whitespace-normal break-words px-3 py-2">
                            {p.recommendations.map((g) => g.name).join('; ') ||
                              '—'}
                          </td>
                          <td className="max-w-[160px] whitespace-normal break-words px-3 py-2">
                            {p.offerProductNames.join('; ') || '—'}
                          </td>
                          <td className="max-w-[180px] whitespace-normal break-words px-3 py-2">
                            {p.personalizeGroups
                              .map(
                                (g) =>
                                  `${g.parentName}: ${g.options.join(', ') || '—'}`
                              )
                              .join(' | ') || '—'}
                          </td>
                        </tr>
                      ))}
                      {(previewParsed?.products.length ?? 0) === 0 ? (
                        <tr>
                          <td
                            colSpan={11}
                            className="px-3 py-6 text-center text-muted-foreground"
                          >
                            {t('dashboard.menuManager.csvImport.noRowsToPreview')}
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {step === 4 ? (
              <div className="space-y-4">
                {importing ? (
                  <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <p className="font-medium">
                        {t('dashboard.menuManager.csvImport.importingProducts')}
                      </p>
                      <span className="tabular-nums text-muted-foreground">
                        {importProgress}%
                      </span>
                    </div>
                    <Progress value={importProgress} className="h-2.5" />
                    <p className="text-xs text-muted-foreground">
                      {t('dashboard.menuManager.csvImport.writingProductsLine', {
                        count: previewParsed?.products.length ?? totalDataRows,
                        file: file?.name ?? 'CSV',
                      })}
                    </p>
                  </div>
                ) : null}
                {!result && !importing ? (
                  <>
                    <p className="text-sm">
                      {t('dashboard.menuManager.csvImport.readyToImportLine', {
                        count: previewParsed?.products.length ?? totalDataRows,
                        file: file?.name ?? 'CSV',
                      })}
                    </p>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      <li>
                        {skipDuplicates
                          ? t('dashboard.menuManager.csvImport.duplicatesReuse')
                          : t('dashboard.menuManager.csvImport.duplicatesUpdate')}
                      </li>
                      <li>
                        {t('dashboard.menuManager.csvImport.nameColumnLine', {
                          value:
                            mapping.name ||
                            t('dashboard.menuManager.csvImport.notMappedParen'),
                        })}
                      </li>
                      <li>
                        {t('dashboard.menuManager.csvImport.ingredientsColumnLine', {
                          value:
                            mapping.ingredients ||
                            t('dashboard.menuManager.csvImport.notMappedParen'),
                        })}
                      </li>
                    </ul>
                    <p className="text-xs text-muted-foreground">
                      {t('dashboard.menuManager.csvImport.runImportHint')}
                    </p>
                  </>
                ) : null}
                {result ? (
                  <div className="space-y-2 rounded-lg border border-emerald-600/30 bg-emerald-500/10 p-4 text-sm">
                    <p className="font-medium text-emerald-800 dark:text-emerald-200">
                      {t('dashboard.menuManager.csvImport.importComplete')}
                    </p>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>{t('dashboard.menuManager.csvImport.created', { count: result.createdProducts })}</li>
                      <li>{t('dashboard.menuManager.csvImport.updated', { count: result.updatedProducts })}</li>
                      <li>{t('dashboard.menuManager.csvImport.skipped', { count: result.skippedProducts })}</li>
                      <li>{t('dashboard.menuManager.csvImport.variationsCount', { count: result.variations })}</li>
                      <li>{t('dashboard.menuManager.csvImport.recommendationsCount', { count: result.recommendations })}</li>
                      <li>{t('dashboard.menuManager.csvImport.offersCount', { count: result.offers })}</li>
                      <li>
                        {t('dashboard.menuManager.csvImport.ingredientsCreated', {
                          count: result.createdIngredients ?? 0,
                        })}
                      </li>
                      <li>{t('dashboard.menuManager.csvImport.recipeLines', { count: result.ingredients ?? 0 })}</li>
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <DialogFooter className="gap-2 border-t px-6 py-4 sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              disabled={importing}
              onClick={requestCancel}
            >
              {result
                ? t('dashboard.menuManager.csvImport.close')
                : t('dashboard.menuManager.csvImport.cancel')}
            </Button>
            <div className="flex flex-wrap gap-2">
              {step > 1 && !result ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={importing}
                  onClick={goBack}
                >
                  {t('dashboard.menuManager.csvImport.back')}
                </Button>
              ) : null}
              {step < 4 ? (
                <Button type="button" onClick={goNext}>
                  {t('dashboard.menuManager.csvImport.next')}
                </Button>
              ) : null}
              {step === 4 && !result ? (
                <Button
                  type="button"
                  disabled={importing || !canNextFrom3}
                  onClick={() => setShowFinishConfirm(true)}
                >
                  {importing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('dashboard.menuManager.csvImport.importingEllipsis')}
                    </>
                  ) : (
                    t('dashboard.menuManager.csvImport.runImportButton')
                  )}
                </Button>
              ) : null}
              {step === 4 && result ? (
                <Button type="button" onClick={closeWizard}>
                  {t('dashboard.menuManager.csvImport.done')}
                </Button>
              ) : null}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SaveConfirmation
        open={showCancelConfirm}
        title={t('dashboard.menuManager.csvImport.cancelImportTitle')}
        description={t('dashboard.menuManager.csvImport.cancelImportDescription')}
        confirmText={t('dashboard.menuManager.csvImport.leaveWizard')}
        loading={false}
        onConfirm={() => {
          setShowCancelConfirm(false);
          closeWizard();
        }}
        onCancel={() => setShowCancelConfirm(false)}
      />

      <SaveConfirmation
        open={showFinishConfirm}
        title={t('dashboard.menuManager.csvImport.finishImportTitle')}
        description={
          skipDuplicates
            ? t('dashboard.menuManager.csvImport.finishImportSkipDesc', {
                file: file?.name ?? 'CSV',
              })
            : t('dashboard.menuManager.csvImport.finishImportUpdateDesc', {
                file: file?.name ?? 'CSV',
              })
        }
        confirmText={t('dashboard.menuManager.csvImport.importNow')}
        loading={importing}
        onConfirm={() => void runImport()}
        onCancel={() => {
          if (!importing) setShowFinishConfirm(false);
        }}
      />
    </>
  );
}
