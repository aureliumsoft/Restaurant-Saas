import { z } from 'zod';

import { plainTextFromHtml, sanitizeBlogHtml } from '@/lib/blog/blog';

export const newsletterSendSchema = z
  .object({
    subject: z.string().trim().min(3).max(200),
    htmlBody: z.string().trim().min(1).max(50_000),
    textBody: z.string().trim().max(50_000).optional().nullable(),
    buttonTitle: z.string().trim().max(120).optional().or(z.literal('')),
    buttonLink: z.string().trim().max(2048).optional().or(z.literal('')),
  })
  .superRefine((val, ctx) => {
    const plain = plainTextFromHtml(val.htmlBody);
    if (plain.length < 10) {
      ctx.addIssue({
        code: 'custom',
        message: 'Message must be at least 10 characters.',
        path: ['htmlBody'],
      });
    }
    const title = (val.buttonTitle ?? '').trim();
    const link = (val.buttonLink ?? '').trim();
    if (title && !link) {
      ctx.addIssue({
        code: 'custom',
        message: 'Button link is required when button title is set.',
        path: ['buttonLink'],
      });
    }
    if (link && !title) {
      ctx.addIssue({
        code: 'custom',
        message: 'Button title is required when button link is set.',
        path: ['buttonTitle'],
      });
    }
    if (link && !/^https?:\/\//i.test(link)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Button link must start with http:// or https://',
        path: ['buttonLink'],
      });
    }
  });

export type NewsletterSendInput = z.infer<typeof newsletterSendSchema>;

export function sanitizeNewsletterHtml(html: string): string {
  return sanitizeBlogHtml(html.trim());
}

export function newsletterPlainText(html: string): string {
  return plainTextFromHtml(html);
}

export function normalizeNewsletterSendInput(input: NewsletterSendInput) {
  const buttonTitle = (input.buttonTitle ?? '').trim();
  const buttonLink = (input.buttonLink ?? '').trim();
  const htmlBody = sanitizeNewsletterHtml(input.htmlBody);
  const textBody =
    (input.textBody ?? '').trim() || newsletterPlainText(htmlBody) || null;

  return {
    subject: input.subject.trim(),
    htmlBody,
    textBody,
    buttonTitle: buttonTitle || null,
    buttonLink: buttonLink || null,
  };
}
