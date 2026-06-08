'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getCategoryDisplayImageUrl } from '@/lib/menu/category-display-image';
import { cn } from '@/lib/utils';

export type CategoryPickerItem = {
  id: string;
  name: string;
  imageUrl?: string | null;
  items?: Array<{ imageUrl?: string | null }>;
  showInFront?: boolean;
};

type Props = {
  categories: CategoryPickerItem[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  emptyMessage?: string;
};

export function CategoryPickerStrip({
  categories,
  selectedIds,
  onChange,
  emptyMessage = 'Add a category first, then assign this product.',
}: Props) {
  const stripRef = useRef<HTMLDivElement>(null);
  const [stripScroll, setStripScroll] = useState({ back: false, forward: false });
  const [search, setSearch] = useState('');

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((category) =>
      category.name.toLowerCase().includes(q)
    );
  }, [categories, search]);

  const visibleIdsKey = filteredCategories.map((c) => c.id).join(',');

  const syncStripScroll = useCallback(() => {
    const el = stripRef.current;
    if (!el) {
      setStripScroll({ back: false, forward: false });
      return;
    }
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const max = Math.max(0, scrollWidth - clientWidth);
    setStripScroll({
      back: scrollLeft > 4,
      forward: max > 4 && scrollLeft < max - 4,
    });
  }, []);

  useLayoutEffect(() => {
    syncStripScroll();
  }, [visibleIdsKey, selectedIds.join(','), syncStripScroll]);

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => syncStripScroll());
    ro.observe(el);
    return () => ro.disconnect();
  }, [syncStripScroll]);

  const scrollStrip = useCallback((direction: 'back' | 'forward') => {
    const el = stripRef.current;
    if (!el) return;
    const amount = Math.min(Math.max(el.clientWidth * 0.65, 140), 280);
    el.scrollBy({
      left: direction === 'forward' ? amount : -amount,
      behavior: 'smooth',
    });
  }, []);

  const toggleCategory = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id]
    );
  };

  if (categories.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{emptyMessage}</p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search categories…"
          className="bg-background pl-9"
          aria-label="Search categories"
        />
      </div>
      <div className="relative isolate w-full min-w-0 max-w-full overflow-hidden rounded-lg border border-border/60 bg-background/50">
        <div className="grid w-full min-w-0 max-w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1.5 px-1 py-1 sm:gap-2 sm:px-1.5 sm:py-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full border-border bg-background shadow-sm"
            disabled={!stripScroll.back}
            aria-label="Scroll categories back"
            onClick={() => scrollStrip('back')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div
            ref={stripRef}
            onScroll={syncStripScroll}
            className="min-h-0 min-w-0 max-w-full touch-pan-x overflow-x-auto overflow-y-hidden overscroll-x-contain scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {filteredCategories.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">
                No categories match your search.
              </p>
            ) : (
              <div className="flex w-max items-stretch gap-3 py-1 pe-1 ps-1">
                {filteredCategories.map((category) => {
                  const isActive = selectedIds.includes(category.id);
                  const displayImage = getCategoryDisplayImageUrl(category);
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => toggleCategory(category.id)}
                      className={cn(
                        'group relative w-[9.5rem] shrink-0 overflow-hidden rounded-xl border bg-card text-left shadow-sm outline-none ring-offset-background transition sm:w-[10.5rem]',
                        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                        'hover:border-primary/40 hover:shadow-md active:scale-[0.98]',
                        isActive
                          ? 'border-primary ring-2 ring-primary/25'
                          : 'border-border'
                      )}
                    >
                      <div className="relative aspect-[4/3] w-full bg-muted">
                        {displayImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={displayImage}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                            No photo
                          </div>
                        )}
                        <span
                          className={cn(
                            'absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border-2 bg-background/90 text-xs font-bold shadow-sm backdrop-blur-sm transition',
                            isActive
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border text-transparent group-hover:border-primary/50'
                          )}
                          aria-hidden
                        >
                          ✓
                        </span>
                      </div>
                      <div className="space-y-0.5 p-2.5">
                        <p className="line-clamp-2 text-sm font-semibold leading-snug">
                          {category.name}
                        </p>
                        {category.showInFront === false ? (
                          <p className="truncate text-[11px] text-muted-foreground">
                            Configuration only
                          </p>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full border-border bg-background shadow-sm"
            disabled={!stripScroll.forward}
            aria-label="Scroll categories forward"
            onClick={() => scrollStrip('forward')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
