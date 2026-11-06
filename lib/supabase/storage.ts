import { createClient as createSupabaseJsClient } from '@supabase/supabase-js';

export const SUPABASE_IMAGES_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET?.trim() || 'foodluk-images';

/** Semantic image kinds used in object names: `{restaurant}-product-12.webp`. */
export type StorageImageKind =
  | 'product'
  | 'category'
  | 'banners'
  | 'logo'
  | 'ingredient'
  | 'variation'
  | 'personalize'
  | 'blogs'
  | 'image';

const STORAGE_IMAGE_KINDS = new Set<string>([
  'product',
  'category',
  'banners',
  'logo',
  'ingredient',
  'variation',
  'personalize',
  'blogs',
  'image',
]);

/** Accept legacy `blog` → `blogs`. */
const KIND_ALIASES: Record<string, StorageImageKind> = {
  blog: 'blogs',
  banner: 'banners',
  products: 'product',
  categories: 'category',
  variations: 'variation',
};

export function normalizeStorageImageKind(
  value: string | null | undefined
): StorageImageKind {
  const k = (value ?? '').trim().toLowerCase();
  if (KIND_ALIASES[k]) return KIND_ALIASES[k];
  return STORAGE_IMAGE_KINDS.has(k) ? (k as StorageImageKind) : 'image';
}

/** Safe segment for filenames from a restaurant display name. */
export function slugifyRestaurantNameForStorage(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || 'restaurant';
}

function kindFilePrefix(restaurantSlug: string, kind: StorageImageKind): string {
  return `${restaurantSlug}-${kind}-`;
}

/**
 * Next free number for `{restaurant}-{kind}-{n}.ext` inside a folder
 * (lists existing objects once; callers can pass a shared counter map).
 */
export async function allocateMeaningfulImageObjectPath(params: {
  restaurantName: string;
  /** Optional tenant folder, e.g. restaurants/{id}. Empty = bucket root. */
  folder?: string;
  kind: StorageImageKind;
  ext: string;
  /** In-memory counters to keep numbers unique within one migration batch. */
  counters?: Map<string, number>;
}): Promise<string> {
  const restaurantSlug = slugifyRestaurantNameForStorage(params.restaurantName);
  const kind = normalizeStorageImageKind(params.kind);
  const prefix = kindFilePrefix(restaurantSlug, kind);
  const folder = (params.folder ?? '').replace(/^\/+|\/+$/g, '');
  const counterKey = `${folder}|${prefix}`;

  let next = params.counters?.get(counterKey);
  if (next == null) {
    const supabase = createSupabaseStorageClient();
    const { data: files } = await supabase.storage
      .from(SUPABASE_IMAGES_BUCKET)
      .list(folder || undefined, {
        limit: 1000,
        sortBy: { column: 'name', order: 'asc' },
      });

    let max = 0;
    const re = new RegExp(
      `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)\\.`,
      'i'
    );
    for (const file of files ?? []) {
      const m = file.name.match(re);
      if (!m?.[1]) continue;
      const n = Number.parseInt(m[1], 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
    next = max + 1;
  }

  params.counters?.set(counterKey, next + 1);
  const fileName = `${prefix}${next}.${params.ext.replace(/^\./, '')}`;
  return folder ? `${folder}/${fileName}` : fileName;
}

function requireSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured');
  }
  return url;
}

/** Prefer service role for server uploads; fall back to publishable key. */
function storageAccessKey(): string {
  const service =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim();
  if (service) return service;
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (publishable) return publishable;
  throw new Error('Supabase key is not configured');
}

export function createSupabaseStorageClient() {
  return createSupabaseJsClient(requireSupabaseUrl(), storageAccessKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function isSupabasePublicObjectUrl(url: string): boolean {
  try {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()?.replace(/\/$/, '');
    if (!base) {
      return /\/storage\/v1\/object\/(public|sign)\//.test(url);
    }
    const u = new URL(url.trim());
    return (
      u.href.startsWith(`${base}/storage/v1/object/public/`) ||
      u.href.startsWith(`${base}/storage/v1/object/sign/`)
    );
  } catch {
    return false;
  }
}

function hasServiceRoleKey(): boolean {
  return Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
      process.env.SUPABASE_SECRET_KEY?.trim()
  );
}

const BUCKET_IMAGE_OPTIONS = {
  public: true,
  fileSizeLimit: '8MB' as const,
  allowedMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
  ],
};

async function ensurePublicImagesBucket(
  supabase: ReturnType<typeof createSupabaseStorageClient>
): Promise<void> {
  const { data: buckets, error: listError } =
    await supabase.storage.listBuckets();
  if (listError) {
    // Publishable keys often cannot list buckets; skip ensure.
    return;
  }

  const existing = buckets?.find((b) => b.name === SUPABASE_IMAGES_BUCKET);
  if (existing) {
    // Private buckets break <img src={getPublicUrl()}> — force public.
    if (!existing.public && hasServiceRoleKey()) {
      const { error: updateError } = await supabase.storage.updateBucket(
        SUPABASE_IMAGES_BUCKET,
        BUCKET_IMAGE_OPTIONS
      );
      if (updateError) {
        throw new Error(
          `Supabase bucket "${SUPABASE_IMAGES_BUCKET}" is private (${updateError.message}). Open Storage → ${SUPABASE_IMAGES_BUCKET} → make it Public.`
        );
      }
    } else if (!existing.public) {
      throw new Error(
        `Supabase bucket "${SUPABASE_IMAGES_BUCKET}" is private. Make it Public in Supabase → Storage so images can display.`
      );
    }
    return;
  }

  if (!hasServiceRoleKey()) {
    throw new Error(
      `Supabase bucket "${SUPABASE_IMAGES_BUCKET}" not found. Create a public bucket with that exact name in Supabase → Storage (or set SUPABASE_SERVICE_ROLE_KEY so the server can create it).`
    );
  }

  const { error: createError } = await supabase.storage.createBucket(
    SUPABASE_IMAGES_BUCKET,
    BUCKET_IMAGE_OPTIONS
  );
  if (
    createError &&
    !/already exists|duplicate|resource already/i.test(createError.message)
  ) {
    throw new Error(
      `Could not create Supabase bucket "${SUPABASE_IMAGES_BUCKET}": ${createError.message}`
    );
  }
}

export async function uploadImageBytesToSupabase(params: {
  bytes: Buffer | Uint8Array | ArrayBuffer;
  contentType: string;
  /** Path inside the bucket, e.g. `restaurants/abc/171.png`. */
  objectPath: string;
}): Promise<{ publicUrl: string; path: string }> {
  const supabase = createSupabaseStorageClient();
  const path = params.objectPath.replace(/^\/+/, '');
  const body =
    params.bytes instanceof ArrayBuffer
      ? new Uint8Array(params.bytes)
      : params.bytes;

  // Always ensure the bucket is public before upload/return URL.
  await ensurePublicImagesBucket(supabase);

  const uploadOnce = () =>
    supabase.storage.from(SUPABASE_IMAGES_BUCKET).upload(path, body, {
      contentType: params.contentType || 'image/jpeg',
      cacheControl: '31536000',
      upsert: false,
    });

  let { error } = await uploadOnce();

  if (error && /bucket not found/i.test(error.message)) {
    await ensurePublicImagesBucket(supabase);
    ({ error } = await uploadOnce());
  }

  if (error) {
    if (/bucket not found/i.test(error.message)) {
      throw new Error(
        `Supabase bucket "${SUPABASE_IMAGES_BUCKET}" not found. Create a public bucket named "${SUPABASE_IMAGES_BUCKET}" in Supabase Dashboard → Storage.`
      );
    }
    throw new Error(error.message || 'Supabase upload failed');
  }

  const { data } = supabase.storage
    .from(SUPABASE_IMAGES_BUCKET)
    .getPublicUrl(path);

  if (!data?.publicUrl) {
    throw new Error('Could not resolve Supabase public URL');
  }

  return { publicUrl: data.publicUrl, path };
}
