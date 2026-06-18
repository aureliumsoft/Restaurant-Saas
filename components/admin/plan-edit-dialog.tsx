'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import axios from 'axios';
import {
  Check,
  Layers,
  Loader2,
  Save,
  Sparkles,
  Tag,
  Type,
} from 'lucide-react';
import { toast } from 'react-toastify';

import { adminInsetClass } from '@/components/admin/admin-surface';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SaveConfirmation } from '@/components/ui/confirmation-dialogs';
import { cn } from '@/lib/utils';

export type CatalogPlan = {
  id: string;
  plan: 'STARTER' | 'GROWTH' | 'SCALE';
  name: string;
  price: number;
  priceLabel: string;
  description: string;
  features: string[] | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: CatalogPlan | null;
  onSaved: () => void;
};

const PLAN_ACCENTS: Record<CatalogPlan['plan'], string> = {
  STARTER: '#64748b',
  GROWTH: '#7c3aed',
  SCALE: '#ed6e40',
};

const fieldInputClass =
  'h-10 rounded-xl border-0 bg-zinc-100/90 shadow-none focus-visible:ring-2 focus-visible:ring-fire-500/30 dark:bg-zinc-800/60';

const textareaClass =
  'flex min-h-[120px] w-full resize-y rounded-xl border-0 bg-zinc-100/90 px-3 py-2.5 text-sm shadow-none placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fire-500/30 dark:bg-zinc-800/60';

function FormField({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
      {hint ? <p className="text-[11px] leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function SectionPanel({
  icon: Icon,
  title,
  description,
  children,
  accent,
}: {
  icon: typeof Tag;
  title: string;
  description?: string;
  children: ReactNode;
  accent: string;
}) {
  return (
    <section className={cn('overflow-hidden rounded-2xl p-4 sm:p-5', adminInsetClass)}>
      <div className="mb-4 flex items-start gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${accent}18`, color: accent }}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export function PlanEditDialog({ open, onOpenChange, plan, onSaved }: Props) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [priceLabel, setPriceLabel] = useState('');
  const [description, setDescription] = useState('');
  const [featuresText, setFeaturesText] = useState('');
  const [saving, setSaving] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const accent = plan ? PLAN_ACCENTS[plan.plan] : '#7c3aed';

  useEffect(() => {
    if (!open || !plan) return;
    setName(plan.name);
    setAmount(String(plan.price ?? 0));
    setPriceLabel(plan.priceLabel);
    setDescription(plan.description);
    setFeaturesText((plan.features ?? []).join('\n'));
  }, [open, plan]);

  const featureLines = useMemo(
    () =>
      featuresText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    [featuresText]
  );

  const save = async () => {
    if (!plan) return;
    setSaving(true);
    try {
      await axios.patch('/api/admin/pricing-plans', {
        plan: plan.plan,
        name: name.trim(),
        price: Math.max(0, Math.floor(Number(amount) || 0)),
        priceLabel: priceLabel.trim(),
        description: description.trim(),
        features: featureLines,
      });
      toast.success('Pricing catalog updated');
      setShowConfirmation(false);
      onOpenChange(false);
      onSaved();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: unknown } } };
      const msg =
        typeof err.response?.data?.error === 'string'
          ? err.response.data.error
          : 'Could not update plan';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!plan) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-2xl flex-col gap-0 overflow-hidden rounded-2xl border-0 p-0 shadow-2xl">
        <DialogHeader className="space-y-4 border-0 px-6 pb-4 pt-6 text-left">
          <div className="flex items-start gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-bold"
              style={{ backgroundColor: `${accent}18`, color: accent }}
            >
              {plan.plan.charAt(0)}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <DialogTitle className="text-xl font-bold tracking-tight">
                Edit {plan.name}
              </DialogTitle>
              <DialogDescription className="text-sm">
                Update how this plan appears on the public pricing page.
              </DialogDescription>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Badge
                  variant="secondary"
                  className="rounded-md font-mono text-[11px]"
                  style={{ backgroundColor: `${accent}18`, color: accent }}
                >
                  {plan.plan}
                </Badge>
                {priceLabel ? (
                  <Badge variant="secondary" className="rounded-md font-medium">
                    {priceLabel}
                  </Badge>
                ) : null}
                <Badge variant="secondary" className="rounded-md">
                  {featureLines.length} feature{featureLines.length === 1 ? '' : 's'}
                </Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-4">
          <div className="grid gap-4">
            <SectionPanel
              icon={Tag}
              title="Plan identity"
              description="Display name shown to customers"
              accent={accent}
            >
              <FormField label="Plan name" hint="e.g. Growth, Pro, Enterprise">
                <Input
                  className={fieldInputClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Plan name"
                />
              </FormField>
            </SectionPanel>

            <SectionPanel
              icon={Sparkles}
              title="Pricing"
              description="Amount and label on the marketing site"
              accent="#10b981"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Price (integer)" hint="Stored as whole number (e.g. 49)">
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      €
                    </span>
                    <Input
                      inputMode="numeric"
                      className={cn(fieldInputClass, 'pl-7 tabular-nums')}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </FormField>
                <FormField
                  label="Price label"
                  hint='Shown on cards, e.g. "€49/mo" or "Contact us"'
                >
                  <Input
                    className={fieldInputClass}
                    value={priceLabel}
                    onChange={(e) => setPriceLabel(e.target.value)}
                    placeholder="€49/mo"
                  />
                </FormField>
              </div>

              {(name || priceLabel) && (
                <div
                  className="mt-4 rounded-xl px-4 py-3"
                  style={{ backgroundColor: `${accent}0c` }}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Preview
                  </p>
                  <p className="mt-1 text-base font-semibold">{name || 'Plan name'}</p>
                  <p className="text-2xl font-bold tabular-nums" style={{ color: accent }}>
                    {priceLabel || '—'}
                  </p>
                </div>
              )}
            </SectionPanel>

            <SectionPanel
              icon={Type}
              title="Marketing copy"
              description="Short description under the plan title"
              accent="#3b82f6"
            >
              <FormField label="Description">
                <textarea
                  className={cn(textareaClass, 'min-h-[72px]')}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="What's included at a glance…"
                />
              </FormField>
            </SectionPanel>

            <SectionPanel
              icon={Layers}
              title="Feature list"
              description="One feature per line — shown as bullet points"
              accent="#8b5cf6"
            >
              <FormField
                label={`Features (${featureLines.length})`}
                hint="Each line becomes a bullet on the pricing page"
              >
                <textarea
                  className={textareaClass}
                  value={featuresText}
                  onChange={(e) => setFeaturesText(e.target.value)}
                  placeholder={'Unlimited menu items\nPOS & KDS\nPriority support'}
                />
              </FormField>

              {featureLines.length > 0 ? (
                <ul className="mt-4 space-y-1.5">
                  {featureLines.map((line) => (
                    <li
                      key={line}
                      className="flex items-start gap-2 rounded-lg bg-white/70 px-3 py-2 text-sm dark:bg-zinc-900/50"
                    >
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0"
                        style={{ color: accent }}
                        aria-hidden
                      />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Add features above to see a live preview.
                </p>
              )}
            </SectionPanel>
          </div>
        </div>

        <DialogFooter className="gap-2 border-0 bg-zinc-50/80 px-6 py-4 dark:bg-zinc-900/50 sm:gap-3">
          <Button
            variant="ghost"
            type="button"
            className="rounded-xl"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="rounded-xl"
            disabled={saving || !name.trim()}
            onClick={() => setShowConfirmation(true)}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save plan
              </>
            )}
          </Button>
        </DialogFooter>

        <SaveConfirmation
          open={showConfirmation}
          title="Save pricing plan"
          description="Apply these changes to the public plan name, price, description, and features?"
          itemName={plan.plan}
          loading={saving}
          onConfirm={() => void save()}
          onCancel={() => setShowConfirmation(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
