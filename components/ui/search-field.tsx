'use client';

import { Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export type SearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  /** Runs search (Search button / Enter). */
  onSearch: () => void;
  /**
   * Clears the input. If omitted, clears local value via onChange('') only.
   * Prefer clearing draft + applied search in the parent.
   */
  onClear?: () => void;
  placeholder?: string;
  /** Accessible / button label for Search. Defaults to dashboard.common.search */
  searchLabel?: string;
  /** Accessible label for Clear. Defaults to dashboard.common.clearSearch */
  clearLabel?: string;
  /** Applied query — clear stays available while a filter is active. */
  appliedValue?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  id?: string;
};

/**
 * Shared page search: left search icon, input, clear (X), and Search button.
 */
export function SearchField({
  value,
  onChange,
  onSearch,
  onClear,
  placeholder,
  searchLabel,
  clearLabel,
  appliedValue,
  disabled,
  className,
  inputClassName,
  id,
}: SearchFieldProps) {
  const { t } = useTranslation();
  const searchText = searchLabel ?? t('dashboard.common.search');
  const clearText = clearLabel ?? t('dashboard.common.clearSearch');
  const showClear = Boolean(value.trim() || appliedValue?.trim());

  const handleClear = () => {
    onChange('');
    onClear?.();
  };

  return (
    <div
      className={cn(
        'flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center',
        className
      )}
    >
      <div className="relative min-w-0 flex-1">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          id={id}
          type="search"
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          aria-label={placeholder ?? searchText}
          className={cn(
            'h-10 bg-background pl-9 [&::-webkit-search-cancel-button]:hidden',
            showClear ? 'pr-10' : 'pr-3',
            inputClassName
          )}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onSearch();
            }
          }}
        />
        {showClear ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            className="absolute right-[105px] top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={clearText}
            onClick={handleClear}
          >
            <X className="h-4 w-4" />
          </Button>
        ) : (
          null
        )}
        <Button
            type="button"
            variant="secondary"
            disabled={disabled}
            className="shrink-0 absolute right-0 top-1/2 -translate-y-1/2"
            onClick={onSearch}
          >
            <Search className="mr-2 h-4 w-4" aria-hidden />
            {searchText}
          </Button>
      </div>
    </div>
  );
}
