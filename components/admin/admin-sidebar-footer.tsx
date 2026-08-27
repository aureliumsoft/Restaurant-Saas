'use client';

import { useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { Loader2, LogOut } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { LogoutConfirmation } from '@/components/ui/confirmation-dialogs';
import { cn } from '@/lib/utils';

export function AdminSidebarFooter({ className }: { className?: string }) {
  const { data: session, status } = useSession();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const user = session?.user;
  const name = user?.name ?? user?.email ?? 'Admin';
  const email = user?.email ?? '';
  const initial = name.charAt(0).toUpperCase();

  if (status === 'loading') {
    return (
      <div className={cn('flex items-center justify-center rounded-xl bg-muted/50 py-4', className)}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="rounded-2xl bg-white/70 p-3 shadow-sm dark:bg-white/10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fire-400 to-fire-600 text-sm font-semibold text-white shadow-md shadow-fire-500/30">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{name}</p>
            {email ? (
              <p className="truncate text-[11px] text-muted-foreground">{email}</p>
            ) : null}
          </div>
        </div>

      </div>

      <Button
        type="button"
        variant="ghost"
        className="h-10 w-full justify-start rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setLogoutOpen(true)}
      >
        <LogOut className="mr-2 h-4 w-4" />
        Logout
      </Button>

      <LogoutConfirmation
        open={logoutOpen}
        loading={loggingOut}
        title="Sign out of admin?"
        description="You will be signed out of the platform admin area and returned to the home page."
        onCancel={() => setLogoutOpen(false)}
        onConfirm={async () => {
          setLoggingOut(true);
          await signOut({ callbackUrl: '/' });
        }}
      />
    </div>
  );
}
