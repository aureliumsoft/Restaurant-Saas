'use client';

import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

type AdminTableProps = React.HTMLAttributes<HTMLTableElement> & {
  /** Minimum table width before horizontal scroll kicks in on narrow viewports */
  minWidth?: number;
};

const AdminTable = React.forwardRef<HTMLTableElement, AdminTableProps>(
  ({ className, minWidth, ...props }, ref) => {
    const { t } = useTranslation();
    return (
      <div className="relative w-full min-w-0 max-w-full">
        <div
          className={cn(
            'admin-table-scroll overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950',
            className
          )}
        >
          <div
            className="overflow-x-auto overscroll-x-contain scroll-smooth [-webkit-overflow-scrolling:touch]"
            tabIndex={0}
            role="region"
            aria-label={t('admin.table.scrollableRegion')}
          >
            <table
              ref={ref}
              style={
                minWidth
                  ? { width: '100%', minWidth: `max(100%, ${minWidth}px)` }
                  : { width: '100%' }
              }
              className="w-full border-collapse text-left text-sm"
              {...props}
            />
          </div>
        </div>
      </div>
    );
  }
);
AdminTable.displayName = 'AdminTable';

const AdminTableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn('[&_tr]:border-0', className)} {...props} />
));
AdminTableHeader.displayName = 'AdminTableHeader';

const AdminTableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn(
      '[&_tr:last-child_td]:border-b-0 [&_tr:hover_td]:bg-[#fff4ed] dark:[&_tr:hover_td]:bg-zinc-800/70',
      className
    )}
    {...props}
  />
));
AdminTableBody.displayName = 'AdminTableBody';

const AdminTableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr ref={ref} className={cn('group', className)} {...props} />
));
AdminTableRow.displayName = 'AdminTableRow';

const AdminTableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      'h-11 whitespace-nowrap border-b border-zinc-200 bg-zinc-50 px-4 text-left align-middle text-xs font-semibold text-zinc-500 first:pl-4 last:pr-4 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-400',
      className
    )}
    {...props}
  />
));
AdminTableHead.displayName = 'AdminTableHead';

const AdminTableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      'whitespace-nowrap border-b border-zinc-200 px-4 py-3 align-middle text-zinc-900 dark:border-zinc-800 dark:text-zinc-100',
      className
    )}
    {...props}
  />
));
AdminTableCell.displayName = 'AdminTableCell';

type AdminTableLeadProps = {
  title: string;
  subtitle?: string;
  accent?: string;
};

function AdminTableLead({ title, subtitle, accent = '#ed6e40' }: AdminTableLeadProps) {
  return (
    <div className="flex min-w-0 max-w-[14rem] items-center gap-2 sm:min-w-[12rem] sm:max-w-none sm:gap-3 lg:max-w-none">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold sm:h-9 sm:w-9"
        style={{ backgroundColor: `${accent}18`, color: accent }}
      >
        {title.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{title}</p>
        {subtitle ? (
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

function AdminTableChip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex max-w-[8rem] items-center truncate rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-[11px] text-muted-foreground lg:max-w-none dark:bg-zinc-800/80',
        className
      )}
    >
      {children}
    </span>
  );
}

function AdminTableMuted({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('text-sm text-muted-foreground', className)}>{children}</span>;
}

function AdminTableNumeric({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('font-semibold tabular-nums text-foreground', className)}>{children}</span>
  );
}

function AdminTableEmpty({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl bg-white/50 py-12 text-center dark:bg-zinc-900/30',
        className
      )}
    >
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

/** Wrap tables inside cards — enables horizontal scroll without clipping */
function AdminTableWrapper({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0 max-w-full overflow-hidden px-1 pb-1 sm:px-2', className)}>
      {children}
    </div>
  );
}

export {
  AdminTable,
  AdminTableHeader,
  AdminTableBody,
  AdminTableRow,
  AdminTableHead,
  AdminTableCell,
  AdminTableLead,
  AdminTableChip,
  AdminTableMuted,
  AdminTableNumeric,
  AdminTableEmpty,
  AdminTableWrapper,
};
