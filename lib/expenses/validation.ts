import { z } from 'zod';

export const expenseManualCreateSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  amount: z.number().finite().min(0, 'Amount must be zero or greater'),
  notes: z.string().trim().max(2000).optional().nullable(),
  occurredAt: z.coerce.date().optional(),
});

export const expenseManualPatchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  amount: z.number().finite().min(0).optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
  occurredAt: z.coerce.date().optional(),
});
