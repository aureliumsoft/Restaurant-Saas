'use client';
import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import { ScrollAreaDemo } from '../scrollarea/scrollarea';
import { SheetContent } from '@/components/ui/sheet';
import { usePathname } from 'next/navigation';
import UserMenu from './UserMenu';
import { isDashboardNavItemActive } from '@/lib/dashboard-nav';
import { useDashboardNavItems } from './use-dashboard-nav-items';

type NavbarSheetProps = {
  /** Called when a nav link is used (e.g. to close the mobile sheet). */
  onNavigate?: () => void;
};

export function NavbarSheet({ onNavigate }: NavbarSheetProps) {
  const pathname = usePathname();
  const navItems = useDashboardNavItems();

  return (
    <SheetContent side="left" className="flex flex-col">
      {/* Navigation container */}
      <nav className="grid gap-2 text-lg font-medium">
        {/* Link for the top section with an icon */}
        <Link
          href="#"
          className="flex items-center gap-2 text-lg font-semibold"
        >
          <TriangleAlert className="h-6 w-6" />
        </Link>

        {/* Map through NAVBAR_ITEMS to create navigation links */}
        {navItems.map((item) => (
          <Link
            key={item.path}
            href={item.path}
            target={
              item.path.startsWith('/pos') || item.path.startsWith('/kds')
                ? '_blank'
                : undefined
            }
            onClick={() =>
              item.path.startsWith('/pos') || item.path.startsWith('/kds')
                ? onNavigate?.()
                : undefined
            }
            className={`mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 ${
              isDashboardNavItemActive(pathname ?? '', item.path)
                ? 'bg-primary/10 text-foreground'
                : 'text-muted-foreground hover:text-foreground bg-primary/10'
            } transition-all hover:text-primary hover:bg-primary/20`}
          >
            {/* Render the icon and title for each navigation item */}
            {item.icon}
            {item.title}
          </Link>
        ))}

        {/* Include ScrollAreaDemo component */}
        <ScrollAreaDemo />
      </nav>

      <div className="mt-auto p-2">
        <UserMenu className="w-full justify-start" />
      </div>
    </SheetContent>
  );
}
