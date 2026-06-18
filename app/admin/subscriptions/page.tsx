'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Loader2, Pencil, Save, X } from 'lucide-react';
import { toast } from 'react-toastify';

import { SubscriptionEditDialog } from '@/components/admin/subscription-edit-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SaveConfirmation } from '@/components/ui/confirmation-dialogs';
import {
  formatInTimezone,
  getClientSubscriptionAdminTimezone,
} from '@/lib/subscription-timezone-client';

type Subscription = {
  id: string;
  plan: string;
  status: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  notes: string | null;
} | null;

type Row = {
  id: string;
  name: string;
  subdomain: string;
  owner: { email: string | null };
  subscription: Subscription;
};

type CatalogPlan = {
  id: string;
  plan: 'STARTER' | 'GROWTH' | 'SCALE';
  name: string;
  price: number;
  priceLabel: string;
  description: string;
  features: string[] | null;
};

const ADMIN_TZ = getClientSubscriptionAdminTimezone();

function formatPeriodEnd(iso: string | null | undefined): string {
  return formatInTimezone(iso, ADMIN_TZ);
}

export default function AdminSubscriptionsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<Row | null>(null);
  const [catalogPlans, setCatalogPlans] = useState<CatalogPlan[]>([]);
  const [editingPlan, setEditingPlan] = useState<CatalogPlan | null>(null);
  const [planName, setPlanName] = useState('');
  const [planAmount, setPlanAmount] = useState('');
  const [planPriceLabel, setPlanPriceLabel] = useState('');
  const [planDescription, setPlanDescription] = useState('');
  const [planFeaturesText, setPlanFeaturesText] = useState('');
  const [savingPlan, setSavingPlan] = useState(false);
  const [showCatalogSaveConfirmation, setShowCatalogSaveConfirmation] =
    useState(false);

  const load = useCallback(() => {
    setLoading(true);
    axios
      .get('/api/admin/restaurants')
      .then((r) => setRows(r.data.data ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  const loadCatalog = useCallback(() => {
    axios
      .get<{ data: CatalogPlan[] }>('/api/admin/pricing-plans')
      .then((r) => setCatalogPlans(r.data.data ?? []))
      .catch(() => setCatalogPlans([]));
  }, []);

  useEffect(() => {
    load();
    loadCatalog();
  }, [load, loadCatalog]);

  useEffect(() => {
    if (!editingPlan) return;
    setPlanName(editingPlan.name);
    setPlanAmount(String(editingPlan.price ?? 0));
    setPlanPriceLabel(editingPlan.priceLabel);
    setPlanDescription(editingPlan.description);
    setPlanFeaturesText((editingPlan.features ?? []).join('\n'));
  }, [editingPlan]);

  const saveCatalogPlan = async () => {
    if (!editingPlan) return;
    setSavingPlan(true);
    try {
      await axios.patch('/api/admin/pricing-plans', {
        plan: editingPlan.plan,
        name: planName.trim(),
        price: Math.max(0, Math.floor(Number(planAmount) || 0)),
        priceLabel: planPriceLabel.trim(),
        description: planDescription.trim(),
        features: planFeaturesText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
      });
      toast.success('Pricing catalog updated');
      setShowCatalogSaveConfirmation(false);
      setEditingPlan(null);
      loadCatalog();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: unknown } } };
      const msg =
        typeof err.response?.data?.error === 'string'
          ? err.response.data.error
          : 'Could not update plan';
      toast.error(msg);
    } finally {
      setSavingPlan(false);
    }
  };

  const handleCatalogSaveClick = () => {
    setShowCatalogSaveConfirmation(true);
  };

  if (loading) {
    return (
      <Loader2 className="text-primary animate-spin text-center mx-auto" />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Subscription Management
        </h1>
        <p className="text-sm text-muted-foreground">
          Plans, trial periods, expiry dates, and payment logs per restaurant.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Plans &amp; status</CardTitle>
          <CardDescription>
            Edit trial windows and plan tiers for each tenant.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Restaurant</TableHead>
                <TableHead>Subdomain</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Period ends</TableHead>
                <TableHead className="w-24 text-right">Edit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>
                    <code className="rounded bg-muted px-1 text-xs">
                      {r.subdomain}
                    </code>
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate text-muted-foreground">
                    {r.owner.email ?? '—'}
                  </TableCell>
                  <TableCell>
                    {r.subscription ? (
                      <Badge variant="outline">{r.subscription.plan}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Not set
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.subscription ? (
                      <Badge
                        variant={
                          r.subscription.status === 'ACTIVE'
                            ? 'default'
                            : r.subscription.status === 'TRIAL'
                              ? 'secondary'
                              : 'destructive'
                        }
                      >
                        {r.subscription.status}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.subscription?.status === 'TRIAL'
                      ? formatPeriodEnd(r.subscription.trialEndsAt)
                      : formatPeriodEnd(r.subscription?.currentPeriodEnd ?? null)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => setEdit(r)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {rows.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No restaurants yet.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pricing catalog (3 fixed plans)</CardTitle>
          <CardDescription>
            Admin can update name, price, description, and features for Starter,
            Growth, and Scale.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan Key</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-24 text-right">Edit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {catalogPlans.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Badge variant="outline">{p.plan}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.priceLabel}</TableCell>
                  <TableCell className="max-w-[320px] truncate text-muted-foreground">
                    {p.description}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => setEditingPlan(p)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {catalogPlans.length === 0 && (
            <p className="py-6 text-sm text-muted-foreground">
              No pricing plans found.
            </p>
          )}
        </CardContent>
      </Card>

      {edit && (
        <SubscriptionEditDialog
          open={!!edit}
          onOpenChange={(o) => {
            if (!o) setEdit(null);
          }}
          restaurantId={edit.id}
          restaurantName={edit.name}
          subscription={edit.subscription}
          onSaved={load}
        />
      )}

      <Dialog
        open={!!editingPlan}
        onOpenChange={(o) => {
          if (!o) {
            setEditingPlan(null);
            setShowCatalogSaveConfirmation(false);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit plan {editingPlan?.plan ?? ''}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1">
              <Label>Name</Label>
              <Input
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label>Price (int)</Label>
              <Input
                inputMode="numeric"
                value={planAmount}
                onChange={(e) => setPlanAmount(e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label>Price label</Label>
              <Input
                value={planPriceLabel}
                onChange={(e) => setPlanPriceLabel(e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label>Description</Label>
              <Input
                value={planDescription}
                onChange={(e) => setPlanDescription(e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label>Features (one per line)</Label>
              <textarea
                className="min-h-[140px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={planFeaturesText}
                onChange={(e) => setPlanFeaturesText(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              disabled={savingPlan}
              onClick={() => setEditingPlan(null)}
            >
              <X className="h-4 w-4 mr-2" /> <span>Cancel</span>
            </Button>
            <Button
              type="button"
              disabled={savingPlan}
              onClick={handleCatalogSaveClick}
            >
              {savingPlan ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />{' '}
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" /> <span>Save</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SaveConfirmation
        open={showCatalogSaveConfirmation}
        title="Save pricing catalog"
        description="Apply these changes to the public plan name, price, description, and features?"
        itemName={editingPlan?.plan}
        loading={savingPlan}
        onConfirm={() => void saveCatalogPlan()}
        onCancel={() => setShowCatalogSaveConfirmation(false)}
      />
    </div>
  );
}
