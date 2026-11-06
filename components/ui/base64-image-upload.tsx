'use client';

import { useId, useRef, useState, type ChangeEvent, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageIcon, Upload, X } from 'lucide-react';
import { toast } from 'react-toastify';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  canPreviewImageValue,
  fileToOptimizedImageBlob,
  isDataImageUrl,
  isHttpImageUrl,
} from '@/lib/image-data-url';
import {
  isSupabasePublicObjectUrl,
  type StorageImageKind,
} from '@/lib/supabase/storage';
import { cn } from '@/lib/utils';

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  helperText?: string;
  /** Max original file size before encode (MB). Default 8. */
  maxMb?: number;
  /** Target max encoded size (MB). Default 1.0. */
  maxEncodedMb?: number;
  /**
   * Storage object kind → `{restaurant}-{kind}-{n}.ext`
   * e.g. product | category | banners | logo | variation
   */
  storageKind?: StorageImageKind;
};

async function uploadImageToSupabaseApi(
  file: Blob,
  contentType: string,
  kind: StorageImageKind
) {
  const form = new FormData();
  const ext =
    contentType === 'image/png'
      ? 'png'
      : contentType === 'image/webp'
        ? 'webp'
        : contentType === 'image/gif'
          ? 'gif'
          : 'jpg';
  form.append('file', file, `upload.${ext}`);
  form.append('kind', kind);

  const res = await fetch('/api/uploads/image', {
    method: 'POST',
    body: form,
    credentials: 'include',
  });
  const json = (await res.json().catch(() => null)) as
    | { data?: { url?: string }; error?: string }
    | null;
  if (!res.ok || !json?.data?.url) {
    throw new Error(json?.error || `Upload failed (${res.status})`);
  }
  return json.data.url;
}

async function rehostImageUrlToSupabaseApi(
  sourceUrl: string,
  kind: StorageImageKind
) {
  const form = new FormData();
  form.append('sourceUrl', sourceUrl);
  form.append('kind', kind);

  const res = await fetch('/api/uploads/image', {
    method: 'POST',
    body: form,
    credentials: 'include',
  });
  const json = (await res.json().catch(() => null)) as
    | { data?: { url?: string }; error?: string }
    | null;
  if (!res.ok || !json?.data?.url) {
    throw new Error(json?.error || `Upload failed (${res.status})`);
  }
  return json.data.url;
}

export function Base64ImageUploadField({
  label,
  value,
  onChange,
  placeholder = 'https://example.com/image.jpg',
  helperText,
  maxMb = 8,
  maxEncodedMb = 1,
  storageKind = 'image',
}: Props) {
  const { t } = useTranslation();
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const rehostSeq = useRef(0);
  const [busy, setBusy] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const previewOk = canPreviewImageValue(value);
  const isData =
    isDataImageUrl(value) || value.trim().startsWith('data:image/');
  const isRemoteHttp = isHttpImageUrl(value);

  useEffect(() => {
    if (value.trim()) return;
    setUrlDraft('');
    setLocalError(null);
    if (fileRef.current) fileRef.current.value = '';
  }, [value]);

  async function onFilePicked(e: ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];
    // Reset so the same file can be re-selected
    input.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(t('dashboard.common.chooseImageFileError'));
      return;
    }

    const limitBytes = Math.floor(maxMb * 1024 * 1024);
    if (file.size > limitBytes) {
      toast.error(t('dashboard.common.imageTooLargeMax', { maxMb }));
      return;
    }

    setBusy(true);
    setLocalError(null);
    try {
      const { blob, contentType } = await fileToOptimizedImageBlob(file, {
        maxEdge: 1200,
        quality: 0.8,
        maxBytes: Math.floor(maxEncodedMb * 1024 * 1024),
      });

      if (blob.size > Math.floor(maxEncodedMb * 1024 * 1024) * 1.05) {
        toast.error(
          t('dashboard.common.imageTooLargeAfterCompression', { maxEncodedMb })
        );
        setLocalError('Image too large');
        return;
      }

      const publicUrl = await uploadImageToSupabaseApi(
        blob,
        contentType,
        storageKind
      );
      onChange(publicUrl);
      setUrlDraft('');
      toast.success(t('dashboard.common.imageUploaded'));
    } catch (err) {
      console.error('image upload', err);
      toast.error(
        err instanceof Error && err.message
          ? err.message
          : t('dashboard.common.imageProcessFailed')
      );
      setLocalError('Upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function applyManualUrl(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) {
      onChange('');
      setLocalError(null);
      return;
    }
    if (!isHttpImageUrl(trimmed)) {
      setUrlDraft(raw);
      return;
    }
    if (isSupabasePublicObjectUrl(trimmed)) {
      onChange(trimmed);
      setUrlDraft('');
      setLocalError(null);
      return;
    }

    const seq = ++rehostSeq.current;
    setBusy(true);
    setLocalError(null);
    setUrlDraft(trimmed);
    try {
      const publicUrl = await rehostImageUrlToSupabaseApi(trimmed, storageKind);
      if (seq !== rehostSeq.current) return;
      onChange(publicUrl);
      setUrlDraft('');
      toast.success(t('dashboard.common.imageUploaded'));
    } catch (err) {
      if (seq !== rehostSeq.current) return;
      console.error('image rehost', err);
      toast.error(
        err instanceof Error && err.message
          ? err.message
          : t('dashboard.common.imageProcessFailed')
      );
      setLocalError('Upload failed');
    } finally {
      if (seq === rehostSeq.current) setBusy(false);
    }
  }

  function clearImage() {
    rehostSeq.current += 1;
    onChange('');
    setUrlDraft('');
    setLocalError(null);
    setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/*"
          className="hidden"
          onChange={(e) => void onFilePicked(e)}
          disabled={busy}
        />
        <Button
          type="button"
          variant="secondary"
          className="gap-2"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-4 w-4" aria-hidden />
          {busy
            ? t('dashboard.common.processing')
            : t('dashboard.common.uploadImage')}
        </Button>
        {value.trim() ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={clearImage}
            disabled={busy}
          >
            <X className="mr-1 h-4 w-4" />
            {t('dashboard.common.remove')}
          </Button>
        ) : null}
        {isRemoteHttp ? (
          <span className="text-xs text-muted-foreground">
            {t('dashboard.common.usingUploadedImage')}
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id={id}
          value={isData ? '' : value.startsWith('http') ? value : urlDraft}
          placeholder={
            isData
              ? t('dashboard.common.usingUploadedImage')
              : placeholder
          }
          onChange={(e) => {
            const v = e.target.value;
            if (v.startsWith('data:')) return;
            setUrlDraft(v);
            if (!v.trim()) {
              onChange('');
              setLocalError(null);
              return;
            }
            if (isHttpImageUrl(v.trim())) {
              void applyManualUrl(v);
            }
          }}
          onBlur={() => {
            const draft = urlDraft.trim();
            if (draft && isHttpImageUrl(draft) && draft !== value.trim()) {
              void applyManualUrl(draft);
            }
          }}
          disabled={busy || isData}
          autoComplete="off"
          className="w-full flex-1"
        />
      </div>

      {helperText ? (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      ) : null}
      {localError ? (
        <p className="text-xs text-destructive">{localError}</p>
      ) : null}

      {previewOk ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote URLs + legacy data
        <img
          key={value.slice(0, 64)}
          src={value}
          alt={`${label} preview`}
          className={cn(
            'mt-1 max-h-48 w-full max-w-md rounded-md border border-border object-contain',
            'bg-[length:16px_16px] bg-[linear-gradient(45deg,#d4d4d8_25%,transparent_25%),linear-gradient(-45deg,#d4d4d8_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#d4d4d8_75%),linear-gradient(-45deg,transparent_75%,#d4d4d8_75%)] bg-[position:0_0,0_8px,8px_-8px,-8px_0]'
          )}
          onError={() => {
            setLocalError(t('dashboard.common.previewFailed'));
          }}
        />
      ) : (
        <div className="mt-1 flex h-28 max-w-md flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border text-muted-foreground">
          <ImageIcon className="h-8 w-8 opacity-40" />
          <span className="text-xs">
            {t('dashboard.common.noImageSelected')}
          </span>
        </div>
      )}
    </div>
  );
}
