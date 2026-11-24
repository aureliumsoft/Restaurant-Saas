import { db } from '@/lib/db';

type ClaimResult =
  | { state: 'missing' }
  | { state: 'invalid' }
  | { state: 'completed'; parsed: Record<string, unknown> }
  | { state: 'claimed'; parsed: Record<string, unknown> };

/**
 * One payment callback must create one order. The success page and the
 * provider webhook both read the same intent row. The row lock makes the
 * second caller wait, then see that the first already claimed it.
 */
export async function claimPlatformOrderIntent(key: string): Promise<ClaimResult> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const result = await db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ value: string }>>`
        SELECT value FROM "PlatformSetting" WHERE key = ${key} FOR UPDATE
      `;
      const row = rows[0];
      if (!row) return { state: 'missing' as const };
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(row.value) as Record<string, unknown>;
      } catch {
        return { state: 'invalid' as const };
      }
      if (parsed.status === 'completed') {
        return { state: 'completed' as const, parsed };
      }
      if (parsed.status === 'creating') {
        return { state: 'busy' as const };
      }
      await tx.platformSetting.update({
        where: { key },
        data: { value: JSON.stringify({ ...parsed, status: 'creating' }) },
      });
      return { state: 'claimed' as const, parsed };
    });
    if (result.state !== 'busy') return result;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return { state: 'invalid' };
}
