'use client';

import type { ConfigurationSummaryLine } from '@/lib/menu/configuration-selection-summary';

type Props = {
  lines: ConfigurationSummaryLine[];
  placeholder: string;
};

function extraLines(line: ConfigurationSummaryLine): ConfigurationSummaryLine[] {
  return [...line.nested, ...line.personalize];
}

export function ConfigurationSelectSummary({ lines, placeholder }: Props) {
  if (lines.length === 0) {
    return (
      <span className="truncate text-xs font-normal text-[#757575]">
        {placeholder}
      </span>
    );
  }

  return (
    <span className="min-w-0 flex-1 text-left">
      {lines.map((line, index) => {
        const extras = extraLines(line);
        return (
          <span key={`${line.name}-${index}`} className="block">
            <span className="block text-[13px] font-semibold uppercase leading-snug text-[#333]">
              {line.name.trim()}
              {line.priceLabel ? (
                <span className="font-medium normal-case text-[#333]">
                  {' '}
                  {line.priceLabel}
                </span>
              ) : null}
            </span>
            {extras.map((extra, extraIndex) => (
              <span
                key={`${extra.name}-${extraIndex}`}
                className="block text-xs font-normal leading-5 text-[#5f5f5f]"
              >
                - {extra.name.trim()}
                {extra.priceLabel ? ` ${extra.priceLabel}` : ''}
              </span>
            ))}
          </span>
        );
      })}
    </span>
  );
}
