'use client';

import { useId, useState, type ChangeEvent } from 'react';
import { Upload } from 'lucide-react';
import { toast } from 'react-toastify';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { estimateDataUrlBytes, isAcceptedImageValue } from '@/lib/image-data-url';

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  helperText?: string;
  maxMb?: number;
};

const DEFAULT_MAX_MB = 2;

export function Base64ImageUploadField({
  label,
  value,
  onChange,
  placeholder = 'Paste image URL or use Upload image',
  helperText,
  maxMb = DEFAULT_MAX_MB,
}: Props) {
  const id = useId();
  const [busy, setBusy] = useState(false);

  async function onFilePicked(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.');
      return;
    }
    const limitBytes = Math.floor(maxMb * 1024 * 1024);
    if (file.size > limitBytes) {
      toast.error(`Image too large. Max size is ${maxMb} MB.`);
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(new Error('Could not read image'));
        reader.readAsDataURL(file);
      });
      const bytes = estimateDataUrlBytes(dataUrl);
      if (bytes > limitBytes) {
        toast.error(`Image too large after encoding. Max size is ${maxMb} MB.`);
        return;
      }
      onChange(dataUrl);
      toast.success('Image uploaded');
    } catch {
      toast.error('Could not encode image.');
    } finally {
      setBusy(false);
    }
  }

  const showPreview = Boolean(value.trim()) && isAcceptedImageValue(value);

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Input
          id={id}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
          className="w-full"
        />
        <label>
          <input
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => void onFilePicked(e)}
            disabled={busy}
          />
          <Button type="button" variant="outline" className="gap-2" asChild>
            <span>
              <Upload className="h-4 w-4" aria-hidden />
              {busy ? 'Uploading…' : 'Upload image'}
            </span>
          </Button>
        </label>
      </div>
      {helperText ? <p className="text-xs text-muted-foreground">{helperText}</p> : null}
      {showPreview ? (
        // eslint-disable-next-line @next/next/no-img-element -- supports base64 and external URLs
        <img
          src={value}
          alt={`${label} preview`}
          className="mt-1 h-20 w-20 rounded-md border border-border object-cover"
        />
      ) : null}
    </div>
  );
}
