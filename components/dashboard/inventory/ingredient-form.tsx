'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Plus, Save, Trash2, X } from 'lucide-react';

import { Base64ImageUploadField } from '@/components/ui/base64-image-upload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { extractApiErrorMessage } from '@/lib/extract-api-error';
import { INGREDIENT_UNIT_VALUES } from '@/lib/inventory/validation';
import { formatIngredientUnit } from '@/lib/inventory/stock';
import { filterDecimalInput } from '@/lib/validation/fields';
import { Textarea } from '@/components/ui/textarea';
import {
  CreateProductSaveConfirmation,
  SaveConfirmation,
} from '@/components/ui/confirmation-dialogs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import { useBranchContext, withBranchQuery } from '@/hooks/use-branch-context';

export type IngredientFormState = {
  name: string;
  description: string;
  quantity: string;
  unit: (typeof INGREDIENT_UNIT_VALUES)[number];
  isMajor: boolean;
  imageUrl: string;
  sku: string;
  minQuantity: string;
  unitCost: string;
  isActive: boolean;
};

export const EMPTY_INGREDIENT_FORM: IngredientFormState = {
  name: '',
  description: '',
  quantity: '0',
  unit: 'PCS',
  isMajor: false,
  imageUrl: '',
  sku: '',
  minQuantity: '',
  unitCost: '',
  isActive: true,
};

function formFingerprint(form: IngredientFormState) {
  return JSON.stringify({
    name: form.name.trim(),
    description: form.description.trim(),
    quantity: form.quantity.trim() || '0',
    unit: form.unit,
    isMajor: form.isMajor,
    imageUrl: form.imageUrl,
    sku: form.sku.trim(),
    minQuantity: form.minQuantity.trim(),
    unitCost: form.unitCost.trim(),
    isActive: form.isActive,
  });
}

export function IngredientForm({
  initial,
  ingredientId,
}: {
  initial?: IngredientFormState;
  ingredientId?: string;
}) {
  const router = useRouter();
  const { activeBranchId, activeBranchUrlId } = useBranchContext();
  const [form, setForm] = useState<IngredientFormState>(
    initial ?? EMPTY_INGREDIENT_FORM
  );
  const [saving, setSaving] = useState<'close' | 'new' | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [imageFileKey, setImageFileKey] = useState<number>(0);
  const [baseline, setBaseline] = useState<IngredientFormState>(
    initial ?? EMPTY_INGREDIENT_FORM
  );
  const isEdit = Boolean(ingredientId);
  const isDirty = formFingerprint(form) !== formFingerprint(baseline);
  const {
    leaveOpen,
    leaveMessage,
    requestLeave,
    confirmLeave,
    cancelLeave,
    allowNextNavigation,
  } = useUnsavedChangesGuard(isDirty, {
    message:
      'You have unsaved ingredient changes. Leave this page without saving?',
  });

  const canSave = useMemo(() => {
    if (!form.name.trim()) return false;
    const qty = Number(form.quantity);
    if (!Number.isFinite(qty) || qty < 0) return false;
    if (form.minQuantity.trim()) {
      const min = Number(form.minQuantity);
      if (!Number.isFinite(min) || min < 0) return false;
    }
    if (form.unitCost.trim()) {
      const cost = Number(form.unitCost);
      if (!Number.isFinite(cost) || cost < 0) return false;
    }
    return true;
  }, [form]);

  const save = async (mode: 'close' | 'new') => {
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      quantity: Number(form.quantity),
      unit: form.unit,
      isMajor: form.isMajor,
      imageUrl: form.imageUrl.trim() || null,
      sku: form.sku.trim() || null,
      minQuantity: form.minQuantity.trim() ? Number(form.minQuantity) : null,
      unitCost: form.unitCost.trim() ? Number(form.unitCost) : null,
      ...(isEdit ? { isActive: form.isActive } : {}),
    };
    setSaving(mode);
    try {
      if (isEdit && ingredientId) {
        await axios.patch(
          withBranchQuery(
            `/api/restaurant/inventory/ingredients/${ingredientId}`,
            activeBranchId,
            activeBranchUrlId
          ),
          payload
        );
        toast.success('Ingredient updated');
        setConfirmOpen(false);
        allowNextNavigation();
        router.push('/inventory');
        return;
      }

      await axios.post(
        withBranchQuery(
          '/api/restaurant/inventory/ingredients',
          activeBranchId,
          activeBranchUrlId
        ),
        payload
      );
      toast.success('Ingredient created');
      setConfirmOpen(false);

      if (mode === 'new') {
        const empty = { ...EMPTY_INGREDIENT_FORM };
        setForm(empty);
        setBaseline(empty);
        setImageFileKey((k) => k + 1);
      } else {
        allowNextNavigation();
        router.push('/inventory');
      }
    } catch (e) {
      toast.error(extractApiErrorMessage(e, 'Could not save ingredient.'));
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="grid w-full gap-4">
      <div className="grid gap-2">
        <Label>
          Name <span className="text-destructive">*</span>
        </Label>
        <Input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Chicken"
        />
      </div>
      <div className="grid gap-2">
        <Label>Description</Label>
        <Textarea
          value={form.description}
          rows={3}
          onChange={(e) =>
            setForm((f) => ({ ...f, description: e.target.value }))
          }
          placeholder="Optional notes"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>
            Quantity <span className="text-destructive">*</span>
          </Label>
          <Input
            value={form.quantity}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                quantity: filterDecimalInput(e.target.value),
              }))
            }
            inputMode="decimal"
          />
        </div>
        <div className="grid gap-2">
          <Label>Unit</Label>
          <Select
            value={form.unit}
            onValueChange={(v) =>
              setForm((f) => ({
                ...f,
                unit: v as IngredientFormState['unit'],
              }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INGREDIENT_UNIT_VALUES.map((u) => (
                <SelectItem key={u} value={u}>
                  {formatIngredientUnit(u)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>SKU</Label>
          <Input
            value={form.sku}
            onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
            placeholder="Optional"
          />
        </div>
        <div className="grid gap-2">
          <Label>Low-stock alert quantity</Label>
          <Input
            value={form.minQuantity}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                minQuantity: filterDecimalInput(e.target.value),
              }))
            }
            inputMode="decimal"
            placeholder="Optional"
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label>Unit cost</Label>
        <Input
          value={form.unitCost}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              unitCost: filterDecimalInput(e.target.value),
            }))
          }
          inputMode="decimal"
          placeholder={`Cost per ${formatIngredientUnit(form.unit)}`}
        />
        <p className="text-xs text-muted-foreground">
          Used to calculate inventory value and usage expenses.
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 accent-primary"
          checked={form.isMajor}
          onChange={(e) =>
            setForm((f) => ({ ...f, isMajor: e.target.checked }))
          }
        />
        Major ingredient (highlighted on inventory)
      </label>
      {isEdit ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={form.isActive}
            onChange={(e) =>
              setForm((f) => ({ ...f, isActive: e.target.checked }))
            }
          />
          Active (available on product recipes)
        </label>
      ) : null}
      <Base64ImageUploadField
        key={imageFileKey}
        label="Photo"
        value={form.imageUrl}
        onChange={(imageUrl) => setForm((f) => ({ ...f, imageUrl }))}
      />

      <div className="flex flex-wrap gap-2 border-t pt-4">
        {isEdit ? (
          <Button
            type="button"
            disabled={Boolean(saving) || !canSave}
            onClick={() => setConfirmOpen(true)}
          >
            <Save className="mr-2 h-4 w-4" />
            Save ingredient
          </Button>
        ) : (
          <Button
            type="button"
            disabled={Boolean(saving) || !canSave}
            onClick={() => setConfirmOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create ingredient
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          disabled={Boolean(saving)}
          onClick={() => requestLeave(() => router.push('/inventory'))}
        >
          <X className="mr-2 h-4 w-4" />
          Cancel
        </Button>
      </div>

      {isEdit ? (
        <SaveConfirmation
          open={confirmOpen}
          title="Update ingredient"
          description="Save changes to this ingredient?"
          itemName={form.name.trim() || 'Ingredient'}
          loading={Boolean(saving)}
          onConfirm={() => void save('close')}
          onCancel={() => setConfirmOpen(false)}
        />
      ) : (
        <CreateProductSaveConfirmation
          open={confirmOpen}
          itemName={form.name.trim() || undefined}
          title={
            form.name.trim()
              ? `Create "${form.name.trim()}"?`
              : 'Create ingredient?'
          }
          description="Choose how you want to save this ingredient."
          saveAndAddNewText="Create & add new"
          saveAndCloseText="Create & Close"
          loading={Boolean(saving)}
          onCancel={() => setConfirmOpen(false)}
          onSaveAndClose={() => void save('close')}
          onSaveAndAddNew={() => void save('new')}
        />
      )}

      <AlertDialog
        open={leaveOpen}
        onOpenChange={(open) => {
          if (!open) cancelLeave();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>{leaveMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">
              <X className="h-4 w-4 mr-2" />
              <span>Keep editing</span>
            </AlertDialogCancel>
            <AlertDialogAction type="button" onClick={confirmLeave}>
              <Trash2 className="h-4 w-4 mr-2" />
              <span>Leave without saving</span>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
