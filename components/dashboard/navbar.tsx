'use client';

import { DashboardSidebarNav } from '@/components/dashboard/dashboard-sidebar-nav';
import { ScrollAreaDemo } from '@/components/scrollarea/scrollarea';

function Navbar() {
  return (
    <div className="space-y-4">
      <DashboardSidebarNav />
      <ScrollAreaDemo />
    </div>
  );
}

export default Navbar;
