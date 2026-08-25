'use client';

import { useId, useRef, useState, type ChangeEvent, useEffect } from 'react';
import { ImageIcon, Upload, X } from 'lucide-react';
import { toast } from 'react-toastify';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  canPreviewImageValue,
  estimateDataUrlBytes,
  fileToOptimizedDataUrl,
  isDataImageUrl,
  isHttpImageUrl,
} from '@/lib/image-data-url';
import { cn } from '@/lib/utils';

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  helperText?: string;
  /** Max original file size before encode (MB). Default 8. */
  maxMb?: number;
  /** Target max encoded size (MB). Default 1.5. */
  maxEncodedMb?: number;
};

export function Base64ImageUploadField({
  label,
  value,
  onChange,
  placeholder = 'https://example.com/image.jpg',
  helperText,
  maxMb = 8,
  maxEncodedMb = 1.5,
}: Props) {
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const previewOk = canPreviewImageValue(value);
  const isData =
    isDataImageUrl(value) || value.trim().startsWith('data:image/');

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
      toast.error('Please choose an image file (PNG, JPEG, WebP, GIF).');
      return;
    }

    const limitBytes = Math.floor(maxMb * 1024 * 1024);
    if (file.size > limitBytes) {
      toast.error(`Image too large. Max file size is ${maxMb} MB.`);
      return;
    }

    setBusy(true);
    setLocalError(null);
    try {
      const dataUrl = await fileToOptimizedDataUrl(file, {
        maxEdge: 1600,
        quality: 0.85,
        maxBytes: Math.floor(maxEncodedMb * 1024 * 1024),
      });

      if (!dataUrl.startsWith('data:image/')) {
        toast.error('Could not encode image.');
        setLocalError('Encode failed');
        return;
      }

      const bytes = estimateDataUrlBytes(dataUrl);
      if (bytes > Math.floor(maxEncodedMb * 1024 * 1024) * 1.05) {
        toast.error(
          `Image is still too large after compression (max ~${maxEncodedMb} MB). Try a smaller photo.`
        );
        setLocalError('Image too large');
        return;
      }

      onChange(dataUrl);
      setUrlDraft('');
      toast.success('Image uploaded');
    } catch (err) {
      console.error('image upload', err);
      toast.error(
        'Could not process image. Try a different file or paste an image URL.'
      );
      setLocalError('Process failed');
    } finally {
      setBusy(false);
    }
  }

  function applyUrl() {
    const t = urlDraft.trim();
    if (!t) {
      toast.error('Paste an image URL first.');
      return;
    }
    if (!isHttpImageUrl(t)) {
      toast.error('Use an http(s) image URL.');
      return;
    }
    onChange(t);
    setLocalError(null);
    toast.success('Image URL set');
  }

  function clearImage() {
    onChange('');
    setUrlDraft('');
    setLocalError(null);
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
          {busy ? 'Processing…' : 'Upload image'}
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
            Remove
          </Button>
        ) : null}
        {isData && value.trim() ? (
          <span className="text-xs text-muted-foreground">
            Image ready (
            {Math.max(1, Math.round(estimateDataUrlBytes(value) / 1024))} KB)
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id={id}
          value={isData ? '' : value.startsWith('http') ? value : urlDraft}
          placeholder={
            isData
              ? 'Using uploaded image — or remove to set a URL'
              : placeholder
          }
          onChange={(e) => {
            const v = e.target.value;
            if (v.startsWith('data:')) return;
            setUrlDraft(v);
            if (v.trim() && isHttpImageUrl(v.trim())) {
              onChange(v.trim());
              setLocalError(null);
            } else if (!v.trim() && !isData) {
              onChange('');
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
        // eslint-disable-next-line @next/next/no-img-element -- data URLs + external
        <img
          key={value.slice(0, 64)}
          src={value}
          alt={`${label} preview`}
          className={cn(
            'mt-1 max-h-48 w-full max-w-md rounded-md border border-border object-cover bg-muted'
          )}
          onError={() => {
            setLocalError('Preview failed to load. Try another image.');
          }}
        />
      ) : (
        <div className="mt-1 flex h-28 max-w-md flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border text-muted-foreground">
          <ImageIcon className="h-8 w-8 opacity-40" />
          <span className="text-xs">No image selected</span>
        </div>
      )}
    </div>
  );
}
