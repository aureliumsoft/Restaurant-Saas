import { db } from '@/lib/db';
import { isDataImageUrl, isHttpImageUrl } from '@/lib/image-data-url';
import {
  allocateMeaningfulImageObjectPath,
  uploadImageBytesToSupabase,
  type StorageImageKind,
} from '@/lib/supabase/storage';

export type MigrateImagesResult = {
  restaurantId: string;
  restaurantName: string;
  dryRun: boolean;
  scanned: number;
  migrated: number;
  skipped: number;
  failed: number;
  details: Array<{
    table: string;
    id: string;
    field: string;
    status: 'migrated' | 'would_migrate' | 'skipped' | 'failed';
    message?: string;
    url?: string;
  }>;
};

type DecodeResult = {
  bytes: Buffer;
  contentType: string;
  ext: string;
};

const RAW_BASE64_RE = /^[A-Za-z0-9+/=\s]+$/;

/** True when the DB value is a data URL or raw base64 blob (not http/https). */
export function looksLikeBase64Image(value: string | null | undefined): boolean {
  if (!value) return false;
  const t = value.trim();
  if (!t) return false;
  if (isHttpImageUrl(t)) return false;
  if (isDataImageUrl(t) || t.startsWith('data:image/')) return true;
  // Legacy raw base64 rows (no data: prefix) — require enough payload to avoid false positives.
  if (t.length < 256) return false;
  return RAW_BASE64_RE.test(t);
}

function sniffExt(buffer: Buffer, fallback: string): string {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpg';
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'png';
  }
  if (buffer.length >= 6 && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return 'gif';
  }
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'webp';
  }
  return fallback;
}

function decodeStoredImage(raw: string): DecodeResult | null {
  const value = raw.trim();
  let contentType = 'image/jpeg';
  let b64 = value;

  if (/^data:/i.test(value)) {
    const commaIdx = value.indexOf(',');
    if (commaIdx <= 0) return null;
    const meta = value.slice(0, commaIdx);
    contentType = meta.match(/^data:([^;]+)/i)?.[1]?.trim() || 'image/jpeg';
    b64 = value.slice(commaIdx + 1);
  }

  const normalized = b64
    .replace(/\s+/g, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  if (!normalized) return null;
  const padded =
    normalized.length % 4 === 0
      ? normalized
      : `${normalized}${'='.repeat(4 - (normalized.length % 4))}`;

  let bytes: Buffer;
  try {
    bytes = Buffer.from(padded, 'base64');
  } catch {
    return null;
  }
  if (bytes.length < 24) return null;

  const ext = sniffExt(
    bytes,
    contentType.includes('png')
      ? 'png'
      : contentType.includes('webp')
        ? 'webp'
        : contentType.includes('gif')
          ? 'gif'
          : 'jpg'
  );
  const resolvedType =
    ext === 'png'
      ? 'image/png'
      : ext === 'webp'
        ? 'image/webp'
        : ext === 'gif'
          ? 'image/gif'
          : 'image/jpeg';

  return { bytes, contentType: resolvedType, ext };
}

type PendingImage = {
  table: string;
  id: string;
  field: string;
  kind: StorageImageKind;
  value: string;
  apply: (publicUrl: string) => Promise<void>;
};

async function collectPendingImages(
  restaurantId: string
): Promise<{ restaurantName: string; pending: PendingImage[] }> {
  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      id: true,
      name: true,
      logoUrl: true,
      mainBannerUrl: true,
      menuBannerUrls: true,
    },
  });
  if (!restaurant) {
    throw new Error(`Restaurant not found: ${restaurantId}`);
  }

  const pending: PendingImage[] = [];

  const pushScalar = (
    table: string,
    id: string,
    field: string,
    kind: StorageImageKind,
    value: string | null | undefined,
    apply: (publicUrl: string) => Promise<void>
  ) => {
    if (!looksLikeBase64Image(value)) return;
    pending.push({ table, id, field, kind, value: value!.trim(), apply });
  };

  pushScalar(
    'Restaurant',
    restaurant.id,
    'logoUrl',
    'logo',
    restaurant.logoUrl,
    async (url) => {
      await db.restaurant.update({
        where: { id: restaurant.id },
        data: { logoUrl: url },
      });
    }
  );
  pushScalar(
    'Restaurant',
    restaurant.id,
    'mainBannerUrl',
    'banners',
    restaurant.mainBannerUrl,
    async (url) => {
      await db.restaurant.update({
        where: { id: restaurant.id },
        data: { mainBannerUrl: url },
      });
    }
  );

  const banners = restaurant.menuBannerUrls ?? [];
  banners.forEach((banner, index) => {
    if (!looksLikeBase64Image(banner)) return;
    pending.push({
      table: 'Restaurant',
      id: restaurant.id,
      field: `menuBannerUrls[${index}]`,
      kind: 'banners',
      value: banner.trim(),
      apply: async (url) => {
        const current = await db.restaurant.findUnique({
          where: { id: restaurant.id },
          select: { menuBannerUrls: true },
        });
        const next = [...(current?.menuBannerUrls ?? [])];
        next[index] = url;
        await db.restaurant.update({
          where: { id: restaurant.id },
          data: { menuBannerUrls: next },
        });
      },
    });
  });

  const categories = await db.menuCategory.findMany({
    where: { restaurantId },
    select: { id: true, imageUrl: true },
  });
  for (const row of categories) {
    pushScalar(
      'MenuCategory',
      row.id,
      'imageUrl',
      'category',
      row.imageUrl,
      async (url) => {
        await db.menuCategory.update({
          where: { id: row.id },
          data: { imageUrl: url },
        });
      }
    );
  }

  const items = await db.menuItem.findMany({
    where: { restaurantId },
    select: { id: true, imageUrl: true },
  });
  for (const row of items) {
    pushScalar('MenuItem', row.id, 'imageUrl', 'product', row.imageUrl, async (url) => {
      await db.menuItem.update({
        where: { id: row.id },
        data: { imageUrl: url },
      });
    });
  }

  const variations = await db.menuItemVariation.findMany({
    where: { menuItem: { restaurantId } },
    select: { id: true, imageUrl: true },
  });
  for (const row of variations) {
    pushScalar(
      'MenuItemVariation',
      row.id,
      'imageUrl',
      'variation',
      row.imageUrl,
      async (url) => {
        await db.menuItemVariation.update({
          where: { id: row.id },
          data: { imageUrl: url },
        });
      }
    );
  }

  const personalizeOptions = await db.menuItemPersonalizeOption.findMany({
    where: { group: { menuItem: { restaurantId } } },
    select: { id: true, imageUrl: true },
  });
  for (const row of personalizeOptions) {
    pushScalar(
      'MenuItemPersonalizeOption',
      row.id,
      'imageUrl',
      'personalize',
      row.imageUrl,
      async (url) => {
        await db.menuItemPersonalizeOption.update({
          where: { id: row.id },
          data: { imageUrl: url },
        });
      }
    );
  }

  const ingredients = await db.ingredient.findMany({
    where: { restaurantId },
    select: { id: true, imageUrl: true },
  });
  for (const row of ingredients) {
    pushScalar(
      'Ingredient',
      row.id,
      'imageUrl',
      'ingredient',
      row.imageUrl,
      async (url) => {
        await db.ingredient.update({
          where: { id: row.id },
          data: { imageUrl: url },
        });
      }
    );
  }

  return { restaurantName: restaurant.name, pending };
}

export async function migrateRestaurantBase64ImagesToSupabase(options: {
  restaurantId: string;
  dryRun?: boolean;
  onProgress?: (message: string) => void;
}): Promise<MigrateImagesResult> {
  const restaurantId = options.restaurantId.trim();
  const dryRun = Boolean(options.dryRun);
  const log = options.onProgress ?? (() => undefined);

  const { restaurantName, pending } = await collectPendingImages(restaurantId);
  log(
    `Found ${pending.length} base64 image field(s) for ${restaurantName} (${restaurantId})`
  );

  const result: MigrateImagesResult = {
    restaurantId,
    restaurantName,
    dryRun,
    scanned: pending.length,
    migrated: 0,
    skipped: 0,
    failed: 0,
    details: [],
  };

  const counters = new Map<string, number>();
  const folder = `restaurants/${restaurantId}`;

  for (const item of pending) {
    const label = `${item.table}.${item.field} (${item.id})`;
    try {
      const decoded = decodeStoredImage(item.value);
      if (!decoded) {
        result.failed += 1;
        result.details.push({
          table: item.table,
          id: item.id,
          field: item.field,
          status: 'failed',
          message: 'Could not decode base64 image',
        });
        log(`FAIL ${label}: decode`);
        continue;
      }

      if (dryRun) {
        result.migrated += 1;
        result.details.push({
          table: item.table,
          id: item.id,
          field: item.field,
          status: 'would_migrate',
          message: `${item.kind}, ${decoded.contentType}, ${decoded.bytes.length} bytes`,
        });
        log(`DRY ${label}: ${item.kind} ${decoded.bytes.length} bytes`);
        continue;
      }

      const objectPath = await allocateMeaningfulImageObjectPath({
        restaurantName,
        folder,
        kind: item.kind,
        ext: decoded.ext,
        counters,
      });
      const { publicUrl } = await uploadImageBytesToSupabase({
        bytes: decoded.bytes,
        contentType: decoded.contentType,
        objectPath,
      });
      await item.apply(publicUrl);
      result.migrated += 1;
      result.details.push({
        table: item.table,
        id: item.id,
        field: item.field,
        status: 'migrated',
        url: publicUrl,
      });
      log(`OK ${label} → ${objectPath}`);
    } catch (e) {
      result.failed += 1;
      const message = e instanceof Error ? e.message : 'Unknown error';
      result.details.push({
        table: item.table,
        id: item.id,
        field: item.field,
        status: 'failed',
        message,
      });
      log(`FAIL ${label}: ${message}`);
    }
  }

  return result;
}
