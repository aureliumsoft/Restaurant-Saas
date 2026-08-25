'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type SearchableSelectOption = {
  value: string;
  label: string;
  hint?: string;
};

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'No results.',
  allowClear = false,
  disabled,
  onSearchChange,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  allowClear?: boolean;
  disabled?: boolean;
  onSearchChange?: (query: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [cached, setCached] = useState<SearchableSelectOption | null>(null);

  useEffect(() => {
    const match = options.find((o) => o.value === value);
    if (match) setCached(match);
    if (!value) setCached(null);
  }, [options, value]);

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? cached,
    [options, value, cached]
  );

  const mergedOptions = useMemo(() => {
    if (selected && !options.some((o) => o.value === selected.value)) {
      return [selected, ...options];
    }
    return options;
  }, [options, selected]);

  const choose = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-10 w-full justify-between font-normal"
        >
          <span className="truncate">
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        onWheel={(e) => e.stopPropagation()}
      >
        <Command shouldFilter={!onSearchChange}>
          <CommandInput
            placeholder={searchPlaceholder}
            onValueChange={onSearchChange}
          />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {allowClear && value ? (
                <CommandItem
                  value="__clear"
                  onMouseDown={(e) => e.preventDefault()}
                  onSelect={() => choose('')}
                >
                  Clear selection
                </CommandItem>
              ) : null}
              {mergedOptions.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={`${opt.label} ${opt.hint ?? ''} ${opt.value}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onSelect={() => choose(opt.value)}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === opt.value ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                  {opt.hint ? (
                    <span className="ml-2 truncate text-xs text-muted-foreground">
                      {opt.hint}
                    </span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
