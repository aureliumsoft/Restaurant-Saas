'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { Loader2, LogIn, LogOut, User } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { LogoutConfirmation } from '@/components/ui/confirmation-dialogs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function UserMenu({
  className,
  confirmLogout = false,
}: {
  className?: string;
  confirmLogout?: boolean;
}) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [logoutOpen, setLogoutOpen] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);

  const user = session?.user as any | undefined;
  const name = user?.name ?? user?.email ?? 'User';
  const role = user?.role ?? 'UNKNOW';
  const email = user?.email ?? '';

  if (status === 'loading') {
    return (
      <Button disabled variant="secondary" className={className}>
        <Loader2 className="h-4 w-4 mr-2 animate-spin text-primary" />
      </Button>
    );
  }

  if (!session) {
    return (
      <Button
        variant="secondary"
        className={className}
        onClick={() => router.push('/login')}
      >
        <>
          <LogIn className="h-4 w-4 mr-2" />
          <span>Sign in</span>
        </>
      </Button>
    );
  }

  const handleLogout = async () => {
    setLoggingOut(true);
    await signOut({ callbackUrl: '/' });
  };

  const requestLogout = () => {
    if (confirmLogout) {
      setMenuOpen(false);
      setLogoutOpen(true);
      return;
    }
    void handleLogout();
  };

  return (
    <>
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="default" className={className}>
          <User className="mr-2 h-4 w-4" />
          <span className="truncate">{name}</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[260px]">
        <div className="flex flex-col gap-1 px-2 py-1.5 text-sm font-semibold">
          <span className="truncate">{name}</span>
          <span className="truncate text-xs font-normal opacity-60">
            {email || '—'}
          </span>
        </div>
        <div className="-mx-1 my-1 h-px bg-muted" />
        <div className="relative flex items-center rounded-sm px-2 py-1.5 text-sm opacity-80">
          <span className="mr-2 text-xs opacity-60">Role</span>
          <span className="text-sm">{role}</span>
        </div>
        <div className="-mx-1 my-1 h-px bg-muted" />
        <button
          type="button"
          className="relative flex w-full items-center rounded-sm px-2 py-1.5 text-sm text-red-500 outline-none transition-colors hover:bg-accent"
          onClick={requestLogout}
        >
          <>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Logout</span>
          </>
        </button>
      </DropdownMenuContent>
    </DropdownMenu>

    {confirmLogout ? (
      <LogoutConfirmation
        open={logoutOpen}
        loading={loggingOut}
        title="Sign out of admin?"
        description="You will be signed out of the platform admin area and returned to the home page."
        onCancel={() => setLogoutOpen(false)}
        onConfirm={handleLogout}
      />
    ) : null}
    </>
  );
}
