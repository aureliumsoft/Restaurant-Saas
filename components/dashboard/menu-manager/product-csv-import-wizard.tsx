'use client';

import { useMemo, useRef, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { toast } from 'react-toastify';

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

const STEPS = [
  { id: 1, title: 'Upload' },
  { id: 2, title: 'Map columns' },
  { id: 3, title: 'Preview' },
  { id: 4, title: 'Finish' },
] as const;

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
  const [result, setResult] = useState<ImportResult | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);

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
      toast.error('Please choose a .csv file');
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
        toast.error('CSV has no data rows');
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
      toast.error('Could not read the CSV file');
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
      toast.error('Select a CSV file first');
      return;
    }
    if (step === 2 && !canNextFrom2) {
      toast.error('Map the Product name column before continuing');
      return;
    }
    if (step === 3 && !canNextFrom3) {
      toast.error('No valid product rows to import with current mapping');
      return;
    }
    setStep((s) => Math.min(4, s + 1));
  };

  const goBack = () => setStep((s) => Math.max(1, s - 1));

  const runImport = async () => {
    if (!file) return;
    setImporting(true);
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
            ? `${body.error ?? 'Import failed'}: ${detail}`
            : body.error ?? 'Import failed'
        );
      }
      setResult(body.data ?? null);
      setShowFinishConfirm(false);
      toast.success('Import finished');
      await onImported();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Import failed');
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
            <DialogTitle>Import products</DialogTitle>
            <DialogDescription>
              WordPress-style CSV import — choose a file, map columns, preview,
              then import into the product catalog.
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
                  <Label>CSV file</Label>
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
                      Choose file
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {file ? file.name : 'No file selected'}
                    </span>
                  </div>
                  {totalDataRows > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {totalDataRows} data row(s) detected · {headers.length}{' '}
                      column(s)
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
                      Skip existing products
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      When checked, products with the same name already in the
                      database are not recreated. Extra categories from the file
                      are still assigned to that one product. Uncheck to also
                      update name, price, and description on matches.
                    </span>
                  </span>
                </label>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Match each file column to a product field / table. Product
                  name is required. A sample from the first row is shown under
                  each mapping.
                </p>
                {headers.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    File columns:{' '}
                    {headers.map((h, i) => (
                      <span
                        key={`${i}-${h}`}
                        className="mr-1 inline-block rounded border bg-muted/50 px-1.5 py-0.5 font-medium text-foreground"
                      >
                        {h || `(Column ${i + 1})`}
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
                          <SelectValue placeholder="Do not import" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={SKIP_MAP}>
                            — Do not import —
                          </SelectItem>
                          {headers.map((h, i) => (
                            <SelectItem
                              key={`${i}-${h}`}
                              value={h || `__col_${i}`}
                            >
                              {h || `(Column ${i + 1})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {mapping[field.key] ? (
                        <p
                          className="line-clamp-2 text-xs text-muted-foreground"
                          title={sample || undefined}
                        >
                          {sample || 'Mapped — first row is empty'}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Do not import
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
                  Preview of all{' '}
                  <strong className="text-foreground">
                    {previewParsed?.products.length ?? 0}
                  </strong>{' '}
                  mapped product(s) — scroll the table to view every row.
                  {skipDuplicates
                    ? ' Same names in the file become one product with every listed category. Existing catalog products are reused and extra categories are added.'
                    : ' Same names in the file become one product with every listed category. Existing catalog products are updated.'}{' '}
                  Ingredients:{' '}
                  <strong className="text-foreground">
                    {mapping.ingredients || 'not mapped'}
                  </strong>
                  {previewParsed
                    ? ` · ${
                        previewParsed.products.filter(
                          (p) => p.ingredients.length > 0
                        ).length
                      } with recipes`
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
                          #
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">
                          Name
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">
                          Ingredients
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">
                          Description
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">
                          Price
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">
                          Sale
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">
                          Categories
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">
                          Variations
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">
                          Recommendations
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">
                          Offers
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">
                          Personalize
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
                            No rows to preview. Go back and fix mapping.
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
                {!result ? (
                  <>
                    <p className="text-sm">
                      Ready to import{' '}
                      <strong>
                        {previewParsed?.products.length ?? totalDataRows}
                      </strong>{' '}
                      product row(s) from{' '}
                      <strong>{file?.name ?? 'CSV'}</strong>.
                    </p>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      <li>
                        Duplicates:{' '}
                        {skipDuplicates
                          ? 'reuse existing names and add extra categories'
                          : 'update existing core fields and set categories from the file'}
                      </li>
                      <li>
                        Name column: {mapping.name || '(not mapped)'}
                      </li>
                      <li>
                        Ingredients column:{' '}
                        {mapping.ingredients || '(not mapped)'}
                      </li>
                    </ul>
                    <p className="text-xs text-muted-foreground">
                      Click <strong>Run import</strong> to write to the
                      database. You will be asked to confirm.
                    </p>
                  </>
                ) : (
                  <div className="space-y-2 rounded-lg border border-emerald-600/30 bg-emerald-500/10 p-4 text-sm">
                    <p className="font-medium text-emerald-800 dark:text-emerald-200">
                      Import complete
                    </p>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>Created: {result.createdProducts}</li>
                      <li>Updated: {result.updatedProducts}</li>
                      <li>Skipped: {result.skippedProducts}</li>
                      <li>Variations: {result.variations}</li>
                      <li>Recommendations: {result.recommendations}</li>
                      <li>Offers: {result.offers}</li>
                      <li>
                        Ingredients created: {result.createdIngredients ?? 0}
                      </li>
                      <li>Recipe lines: {result.ingredients ?? 0}</li>
                    </ul>
                  </div>
                )}
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
              {result ? 'Close' : 'Cancel'}
            </Button>
            <div className="flex flex-wrap gap-2">
              {step > 1 && !result ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={importing}
                  onClick={goBack}
                >
                  Back
                </Button>
              ) : null}
              {step < 4 ? (
                <Button type="button" onClick={goNext}>
                  Next
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
                      Importing…
                    </>
                  ) : (
                    'Run import'
                  )}
                </Button>
              ) : null}
              {step === 4 && result ? (
                <Button type="button" onClick={closeWizard}>
                  Done
                </Button>
              ) : null}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SaveConfirmation
        open={showCancelConfirm}
        title="Cancel import"
        description="Leave the import wizard? Your selected file and column mapping will be discarded."
        confirmText="Leave wizard"
        loading={false}
        onConfirm={() => {
          setShowCancelConfirm(false);
          closeWizard();
        }}
        onCancel={() => setShowCancelConfirm(false)}
      />

      <SaveConfirmation
        open={showFinishConfirm}
        title="Finish import"
        description={
          skipDuplicates
            ? `Import products from "${file?.name ?? 'CSV'}"? Existing products with the same name will not be duplicated. Extra categories from the file will still be assigned.`
            : `Import products from "${file?.name ?? 'CSV'}"? Existing products with the same name will be updated, including categories from the file.`
        }
        confirmText="Import now"
        loading={importing}
        onConfirm={() => void runImport()}
        onCancel={() => {
          if (!importing) setShowFinishConfirm(false);
        }}
      />
    </>
  );
}
