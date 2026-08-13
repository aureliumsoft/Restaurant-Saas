'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Download } from 'lucide-react';
import { toast } from 'react-toastify';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  kioskTableAbsoluteUrl,
  kioskTableDeepLink,
} from '@/lib/kiosk-path';
import { cn } from '@/lib/utils';

export async function downloadTableQrPng(url: string, tableName: string) {
  const qrSize = 280;
  const padding = 24;
  const labelHeight = 48;
  const canvas = document.createElement('canvas');
  canvas.width = qrSize + padding * 2;
  canvas.height = qrSize + padding * 2 + labelHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not create canvas');
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const qrCanvas = document.createElement('canvas');
  await QRCode.toCanvas(qrCanvas, url, { width: qrSize, margin: 1 });
  ctx.drawImage(qrCanvas, padding, padding);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    tableName,
    canvas.width / 2,
    qrSize + padding + labelHeight / 2
  );

  const safeName = tableName.replace(/[^\w\s-]+/g, '').trim() || 'table';
  const link = document.createElement('a');
  link.download = `${safeName.replace(/\s+/g, '-')}-qr.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function useTableQrUrl(
  slug: string,
  branchId: string,
  tableId: string,
  mobile: boolean
) {
  const [origin, setOrigin] = useState('');
  useEffect(() => {
    setOrigin(typeof window !== 'undefined' ? window.location.origin : '');
  }, []);

  const path = kioskTableDeepLink(slug, branchId, tableId, { mobile });
  const absoluteUrl =
    origin.length > 0
      ? kioskTableAbsoluteUrl(origin, slug, branchId, tableId, { mobile })
      : path;

  return { path, absoluteUrl };
}

function QrCanvas({
  url,
  size = 200,
  className,
}: {
  url: string;
  size?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !url) return;
    void QRCode.toCanvas(canvas, url, { width: size, margin: 1 }).catch(() => {
      // ignore render errors
    });
  }, [url, size]);

  return (
    <canvas
      ref={canvasRef}
      aria-label="Table QR code"
      className={cn('rounded-lg border border-border bg-white p-2', className)}
    />
  );
}

export function TableQrCard({
  tableName,
  tableId,
  slug,
  branchId,
  mobile = true,
  className,
}: {
  tableName: string;
  tableId: string;
  slug: string;
  branchId: string;
  mobile?: boolean;
  className?: string;
}) {
  const { absoluteUrl } = useTableQrUrl(slug, branchId, tableId, mobile);

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm',
        className
      )}
    >
      <QrCanvas url={absoluteUrl} size={160} />
      <p className="text-center text-sm font-semibold">{tableName}</p>
    </div>
  );
}

export function TableQrDialog({
  open,
  onOpenChange,
  table,
  slug,
  branchId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table: { id: string; name: string } | null;
  slug: string;
  branchId: string;
}) {
  const [mobile, setMobile] = useState(true);
  const tableId = table?.id ?? '';
  const tableName = table?.name ?? '';
  const { absoluteUrl, path } = useTableQrUrl(
    slug,
    branchId,
    tableId,
    mobile
  );

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      toast.success('QR link copied');
    } catch {
      toast.error('Could not copy link');
    }
  }, [absoluteUrl]);

  const download = useCallback(async () => {
    if (!tableName) return;
    try {
      await downloadTableQrPng(absoluteUrl, tableName);
      toast.success('QR downloaded');
    } catch {
      toast.error('Could not download QR');
    }
  }, [absoluteUrl, tableName]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{table ? `QR — ${table.name}` : 'Table QR'}</DialogTitle>
        </DialogHeader>

        {table ? (
          <div className="space-y-4">
            <Tabs
              value={mobile ? 'mobile' : 'kiosk'}
              onValueChange={(v) => setMobile(v === 'mobile')}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="mobile">Mobile scan</TabsTrigger>
                <TabsTrigger value="kiosk">Fixed kiosk</TabsTrigger>
              </TabsList>
              <TabsContent value="mobile" className="mt-4 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Opens the kiosk optimized for phones ({'`Mobile=true`'}).
                </p>
              </TabsContent>
              <TabsContent value="kiosk" className="mt-4 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Full-screen kiosk layout ({'`Mobile=false`'}).
                </p>
              </TabsContent>
            </Tabs>

            <div className="flex flex-col items-center gap-2 rounded-xl border bg-muted/30 p-4">
              <QrCanvas url={absoluteUrl} size={220} />
              <p className="text-center text-base font-semibold">{tableName}</p>
            </div>

            <p className="break-all text-xs text-muted-foreground">{path}</p>
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => void copyLink()}>
            <Copy className="mr-2 h-4 w-4" />
            Copy link
          </Button>
          <Button type="button" onClick={() => void download()}>
            <Download className="mr-2 h-4 w-4" />
            Download QR
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
