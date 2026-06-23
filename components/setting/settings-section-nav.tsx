'use client';

import { cn } from '@/lib/utils';
import {
  SETTINGS_SECTIONS,
  type SettingsSectionId,
} from '@/constant/settingsNav';

type Props = {
  active: SettingsSectionId;
  onSelect: (id: SettingsSectionId) => void;
  accessAllowed?: boolean;
};

export function SettingsSectionNav({
  active,
  onSelect,
  accessAllowed = true,
}: Props) {
  const sections = SETTINGS_SECTIONS.filter(
    (section) => section.id !== 'access' || accessAllowed
  );

  return (
    <nav
      className="flex max-w-full flex-row gap-1 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0"
      aria-label="Settings sections"
    >
      {sections.map((section) => {
        const Icon = section.icon;
        const selected = active === section.id;
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onSelect(section.id)}
            className={cn(
              'flex min-w-[10.5rem] shrink-0 items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors lg:min-w-0 lg:w-full lg:border-transparent',
              selected
                ? 'border-primary/20 bg-primary/10 text-foreground shadow-sm lg:border-transparent'
                : 'border-transparent bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground lg:bg-transparent'
            )}
          >
            <Icon
              className={cn(
                'mt-0.5 h-4 w-4 shrink-0',
                selected ? 'text-primary' : 'text-muted-foreground'
              )}
              aria-hidden
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium leading-snug">
                {section.title}
              </span>
              <span className="mt-0.5 hidden text-xs leading-snug text-muted-foreground lg:block">
                {section.description}
              </span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
