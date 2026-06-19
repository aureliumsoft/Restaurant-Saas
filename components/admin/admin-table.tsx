import * as React from 'react';

import { cn } from '@/lib/utils';

type AdminTableProps = React.HTMLAttributes<HTMLTableElement> & {
  /** Minimum table width before horizontal scroll kicks in on narrow viewports */
  minWidth?: number;
};

const AdminTable = React.forwardRef<HTMLTableElement, AdminTableProps>(
  ({ className, minWidth, ...props }, ref) => (
    <div className="relative w-full min-w-0 max-w-full">
      <div
        className={cn(
          'admin-table-scroll overflow-x-auto overscroll-x-contain',
          'scroll-smooth [-webkit-overflow-scrolling:touch]',
          'rounded-xl pb-1'
        )}
        tabIndex={0}
        role="region"
        aria-label="Scrollable table"
      >
        <table
          ref={ref}
          style={
            minWidth
              ? { width: '100%', minWidth: `max(100%, ${minWidth}px)` }
              : { width: '100%' }
          }
          className={cn(
            'w-full border-separate border-spacing-y-2 text-sm',
            className
          )}
          {...props}
        />
      </div>
      <p className="mt-2 text-center text-[10px] text-muted-foreground lg:hidden">
        Swipe sideways to view all columns
      </p>
    </div>
  )
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
      '[&_tr:hover_td]:bg-white [&_tr:hover_td]:shadow-sm dark:[&_tr:hover_td]:bg-zinc-800/80',
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
      'h-9 whitespace-nowrap px-4 pb-1 text-left align-middle text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 first:pl-5 last:pr-5',
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
      'whitespace-nowrap bg-white/70 px-4 py-3.5 align-middle transition-all duration-150 first:rounded-xl first:pl-5 last:rounded-r-xl last:pr-5 dark:bg-zinc-900/40',
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
