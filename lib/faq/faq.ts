import { z } from 'zod';

export const FAQ_STATUSES = ['DRAFT', 'PUBLISHED'] as const;
export type FaqStatus = (typeof FAQ_STATUSES)[number];

export const faqWriteSchema = z.object({
  question: z.string().trim().min(1, 'Question is required').max(500),
  answer: z.string().trim().min(1, 'Answer is required').max(10_000),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
  status: z.enum(FAQ_STATUSES).optional(),
});

export type FaqWriteInput = z.infer<typeof faqWriteSchema>;
