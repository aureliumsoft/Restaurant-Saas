'use client';

import { IconBrandGoogleFilled } from '@tabler/icons-react';
import { Loader2, QrCode, ShieldCheck, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export function KioskQrSignInDialog({
  open,
  slug,
  branchId,
  loading,
}: {
  open: boolean;
  slug: string;
  branchId: string;
  loading?: boolean;
}) {
  function startGoogleSignIn() {
    const returnTo = `${window.location.pathname}${window.location.search}`;
    const params = new URLSearchParams({
      restaurantSlug: slug,
      returnTo,
    });
    window.location.assign(
      `/api/customer-auth/google/start?${params.toString()}`
    );
  }

  return (
    <Dialog open={open} onOpenChange={() => undefined}>
      <DialogContent
        className={cn(
          'max-w-[min(100vw-2rem,24rem)] gap-0 overflow-hidden border-0 p-0',
          'rounded-3xl bg-transparent shadow-none',
          '[&>button]:hidden'
        )}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="relative overflow-hidden rounded-3xl border border-white/70 bg-white shadow-[0_24px_80px_-24px_rgba(15,23,42,0.45)]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-primary/10 blur-2xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-[#ea4335]/10 blur-2xl"
          />

          <div className="relative px-6 pb-6 pt-8">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25">
              <QrCode className="h-8 w-8" strokeWidth={1.75} />
            </div>

            <div className="space-y-2 text-center">
              <DialogTitle className="text-2xl font-bold tracking-tight text-[#0f172a]">
                Sign in to order
              </DialogTitle>
              <DialogDescription className="mx-auto max-w-[18rem] text-sm leading-relaxed text-[#64748b]">
                Table QR ordering needs your Google account so we can attach your
                name and email before you browse the menu.
              </DialogDescription>
            </div>

            <ul className="mt-6 space-y-3">
              {[
                {
                  icon: ShieldCheck,
                  title: 'Secure checkout',
                  text: 'Your details stay linked to this table order.',
                },
                {
                  icon: Sparkles,
                  title: 'One tap to start',
                  text: 'Sign in once, then add items and pay at the counter.',
                },
              ].map(({ icon: Icon, title, text }) => (
                <li
                  key={title}
                  className="flex items-start gap-3 rounded-2xl border border-[#e2e8f0]/80 bg-[#f8fafc]/90 px-3.5 py-3"
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-primary shadow-sm ring-1 ring-[#e2e8f0]">
                    <Icon className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <span className="min-w-0 text-left">
                    <span className="block text-sm font-semibold text-[#0f172a]">
                      {title}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-[#64748b]">
                      {text}
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-6 space-y-3">
              <Button
                type="button"
                disabled={loading}
                onClick={startGoogleSignIn}
                className={cn(
                  'group h-14 w-full rounded-2xl border border-[#dadce0] bg-white',
                  'text-base font-semibold text-[#3c4043] shadow-sm',
                  'transition hover:border-[#c6c9cc] hover:bg-[#f8f9fa] hover:shadow-md',
                  'active:scale-[0.99]'
                )}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-3 h-5 w-5 animate-spin text-primary" />
                    Checking session…
                  </>
                ) : (
                  <>
                    <span className="mr-3 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-[#e8eaed] transition group-hover:shadow">
                      <IconBrandGoogleFilled className="h-5 w-5 text-[#ea4335]" />
                    </span>
                    Continue with Google
                  </>
                )}
              </Button>

              <p className="text-center text-xs leading-relaxed text-[#94a3b8]">
                Required for mobile table orders. We only use your name and email
                for this visit.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
