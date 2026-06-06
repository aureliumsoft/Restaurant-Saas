'use client';
import React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ScrollAreaDemo } from '../scrollarea/scrollarea';
import { useDashboardNavItems } from './use-dashboard-nav-items';

function Navbar() {
  const pathname = usePathname();
  const navItems = useDashboardNavItems();

  return (
    <>
      <div className="flex-1">
        {/* Navigation bar container */}
        <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
          {navItems.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                pathname === item.path
                  ? 'bg-primary/10 font-medium text-primary'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              } transition-all`}
            >
              {/* Render the icon and title for each navigation item */}
              {item.icon}
              {item.title}
            </Link>
          ))}
          {/* Include ScrollAreaDemo component */}
          <ScrollAreaDemo />
        </nav>
      </div>
    </>
  );
}

export default Navbar;
