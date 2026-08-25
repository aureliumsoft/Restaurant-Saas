import {
  Home,
  Package,
  ShoppingCart,
  ScanLine,
  Monitor,
  Tv,
  Store,
  Archive,
  Settings,
  FolderTree,
  LayoutGrid,
  SlidersHorizontal,
  type LucideIcon,
  GalleryVerticalEnd,
  Boxes,
} from 'lucide-react';
import { DASHBOARD_MODULES } from '@/constant/dashboardModules';
import { NavItem } from '@/types/Navbar';

export const MODULE_ICONS: Record<
  (typeof DASHBOARD_MODULES)[number]['moduleKey'],
  LucideIcon
> = {
  dashboard: Home,
  sales: ShoppingCart,
  pos: ScanLine,
  kds: Monitor,
  'order-display': Tv,
  branched: Store,
  categories: FolderTree,
  product: Package,
  inventory: Boxes,
  variations: GalleryVerticalEnd,
  tables: LayoutGrid,
  recommendations: SlidersHorizontal,
  records: Archive,
  settings: Settings,
};

export const NAVBAR_ITEMS: NavItem[] = DASHBOARD_MODULES.map((m) => {
  const Icon = MODULE_ICONS[m.moduleKey];
  return {
    title: m.title,
    path: m.path,
    moduleKey: m.moduleKey,
    icon: <Icon className="h-4 w-4" />,
  };
});
