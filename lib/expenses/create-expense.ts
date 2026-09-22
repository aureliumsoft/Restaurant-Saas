import type { Expense, ExpenseType, Prisma } from '@prisma/client';

export type CreateExpenseInput = {
  restaurantId: string;
  branchId?: string | null;
  type: ExpenseType;
  title: string;
  amount: number;
  notes?: string | null;
  occurredAt?: Date;
  ingredientId?: string | null;
  quantity?: number | null;
  createdByUserId?: string | null;
};

type ExpenseWriter = {
  expense: {
    create: (args: {
      data: Prisma.ExpenseUncheckedCreateInput;
    }) => Promise<Expense>;
  };
};

/** Persist a single expense row (manual or inventory restock). */
export async function createExpense(
  tx: ExpenseWriter,
  input: CreateExpenseInput
): Promise<Expense> {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('Expense amount must be zero or greater.');
  }
  const title = input.title.trim();
  if (!title) {
    throw new Error('Expense title is required.');
  }

  return tx.expense.create({
    data: {
      restaurantId: input.restaurantId,
      branchId: input.branchId ?? null,
      type: input.type,
      title,
      amount,
      notes: input.notes?.trim() || null,
      occurredAt: input.occurredAt ?? new Date(),
      ingredientId: input.ingredientId ?? null,
      quantity:
        input.quantity != null && Number.isFinite(input.quantity)
          ? input.quantity
          : null,
      createdByUserId: input.createdByUserId ?? null,
    },
  });
}

/** Build Inventory restock expense when on-hand quantity increases. */
export async function createInventoryRestockExpense(
  tx: ExpenseWriter,
  options: {
    restaurantId: string;
    branchId?: string | null;
    ingredientId: string;
    ingredientName: string;
    deltaQty: number;
    unitCost: number | null | undefined;
    expenseAmount?: number | null;
    createdByUserId?: string | null;
    notes?: string | null;
  }
): Promise<Expense | null> {
  const delta = Number(options.deltaQty);
  if (!Number.isFinite(delta) || delta <= 0) return null;

  const unitCost =
    options.unitCost != null && Number.isFinite(options.unitCost)
      ? Math.max(0, options.unitCost)
      : 0;
  const amount =
    options.expenseAmount != null && Number.isFinite(options.expenseAmount)
      ? Math.max(0, Number(options.expenseAmount))
      : Math.round(delta * unitCost * 100) / 100;

  return createExpense(tx, {
    restaurantId: options.restaurantId,
    branchId: options.branchId,
    type: 'INVENTORY',
    title: `Restock: ${options.ingredientName}`,
    amount,
    quantity: delta,
    ingredientId: options.ingredientId,
    createdByUserId: options.createdByUserId,
    notes: options.notes ?? null,
  });
}
