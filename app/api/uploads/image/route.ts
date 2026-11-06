import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth-options';
import { isHttpImageUrl } from '@/lib/image-data-url';
import { getRestaurantForOwnerRequest } from '@/lib/restaurant/ownerRestaurant';
import {
  allocateMeaningfulImageObjectPath,
  isSupabasePublicObjectUrl,
  normalizeStorageImageKind,
  uploadImageBytesToSupabase,
  type StorageImageKind,
} from '@/lib/supabase/storage';

export const runtime = 'nodejs';

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

function extensionForMime(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/gif') return 'gif';
  return 'jpg';
}

function normalizeContentType(raw: string | null | undefined): string | null {
  const base = (raw ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  if (!base) return null;
  if (base === 'image/jpg') return 'image/jpeg';
  return ALLOWED_TYPES.has(base) ? base : null;
}

type UploadScope =
  | {
      folder: string;
      restaurantName: string;
    }
  | { error: string; status: number };

async function resolveUploadScope(req: NextRequest): Promise<UploadScope> {
  const restaurantAuth = await getRestaurantForOwnerRequest(req, {
    action: 'access',
  });
  if (!('error' in restaurantAuth)) {
    return {
      folder: `restaurants/${restaurantAuth.restaurant.id}`,
      restaurantName: restaurantAuth.restaurant.name,
    };
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id?.trim();
  if (userId) {
    return {
      folder: `users/${userId}`,
      restaurantName: session?.user?.name?.trim() || 'user',
    };
  }

  return { error: 'Unauthorized', status: 401 };
}

async function fetchRemoteImage(
  sourceUrl: string
): Promise<{ bytes: Buffer; contentType: string } | { error: string; status: number }> {
  if (!isHttpImageUrl(sourceUrl)) {
    return { error: 'Invalid image URL', status: 400 };
  }
  if (isSupabasePublicObjectUrl(sourceUrl)) {
    return { error: 'Image is already stored', status: 400 };
  }

  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    return { error: 'Invalid image URL', status: 400 };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { error: 'Invalid image URL', status: 400 };
  }

  let res: Response;
  try {
    res = await fetch(parsed.toString(), {
      redirect: 'follow',
      headers: { Accept: 'image/*,*/*;q=0.8' },
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return { error: 'Could not download image URL', status: 400 };
  }

  if (!res.ok) {
    return { error: `Could not download image (${res.status})`, status: 400 };
  }

  const contentType = normalizeContentType(res.headers.get('content-type'));
  if (!contentType) {
    return { error: 'URL did not return a supported image type', status: 400 };
  }

  const contentLength = Number(res.headers.get('content-length') ?? 0);
  if (contentLength > MAX_BYTES) {
    return { error: 'Image must be between 1 byte and 8MB', status: 400 };
  }

  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length <= 0 || bytes.length > MAX_BYTES) {
    return { error: 'Image must be between 1 byte and 8MB', status: 400 };
  }

  return { bytes, contentType };
}

async function storeImage(params: {
  scope: { folder: string; restaurantName: string };
  kind: StorageImageKind;
  bytes: Buffer;
  contentType: string;
}) {
  const ext = extensionForMime(params.contentType);
  const objectPath = await allocateMeaningfulImageObjectPath({
    restaurantName: params.scope.restaurantName,
    folder: params.scope.folder,
    kind: params.kind,
    ext,
  });
  return uploadImageBytesToSupabase({
    bytes: params.bytes,
    contentType: params.contentType,
    objectPath,
  });
}

/** Upload an image to Supabase Storage; returns a public HTTPS URL (not base64). */
export async function POST(req: NextRequest) {
  const scope = await resolveUploadScope(req);
  if ('error' in scope) {
    return NextResponse.json({ error: scope.error }, { status: scope.status });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const kind: StorageImageKind = normalizeStorageImageKind(
    typeof form.get('kind') === 'string' ? String(form.get('kind')) : 'image'
  );

  const sourceUrlRaw = form.get('sourceUrl');
  const sourceUrl =
    typeof sourceUrlRaw === 'string' ? sourceUrlRaw.trim() : '';

  try {
    if (sourceUrl) {
      if (isSupabasePublicObjectUrl(sourceUrl)) {
        return NextResponse.json({
          data: { url: sourceUrl, path: null },
        });
      }

      const remote = await fetchRemoteImage(sourceUrl);
      if ('error' in remote) {
        return NextResponse.json(
          { error: remote.error },
          { status: remote.status }
        );
      }

      const { publicUrl, path } = await storeImage({
        scope,
        kind,
        bytes: remote.bytes,
        contentType: remote.contentType,
      });

      return NextResponse.json({
        data: { url: publicUrl, path },
      });
    }

    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'Missing file or sourceUrl' },
        { status: 400 }
      );
    }

    const contentType = normalizeContentType(file.type);
    if (!contentType) {
      return NextResponse.json(
        { error: 'Unsupported image type' },
        { status: 400 }
      );
    }

    if (file.size <= 0 || file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: 'Image must be between 1 byte and 8MB' },
        { status: 400 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const { publicUrl, path } = await storeImage({
      scope,
      kind,
      bytes,
      contentType,
    });

    return NextResponse.json({
      data: {
        url: publicUrl,
        path,
      },
    });
  } catch (e) {
    console.error('supabase image upload failed', e);
    const message =
      e instanceof Error ? e.message : 'Failed to upload image';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
