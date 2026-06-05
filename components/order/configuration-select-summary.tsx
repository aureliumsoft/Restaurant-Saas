'use client';

import type { ConfigurationSummaryLine } from '@/lib/menu/configuration-selection-summary';

type Props = {
  lines: ConfigurationSummaryLine[];
  placeholder: string;
};

function SummaryLine({
  line,
  nested,
}: {
  line: ConfigurationSummaryLine;
  nested?: boolean;
}) {
  return (
    <p
      className={
        nested
          ? 'truncate text-sm font-medium text-foreground/85'
          : 'truncate text-sm font-bold uppercase leading-snug text-foreground'
      }
    >
      {nested ? '- ' : null}
      {line.name}
      {line.priceLabel ? (
        <span className="font-medium normal-case">{line.priceLabel}</span>
      ) : null}
    </p>
  );
}

export function ConfigurationSelectSummary({ lines, placeholder }: Props) {
  if (lines.length === 0) {
    return (
      <span className="truncate text-sm text-muted-foreground">{placeholder}</span>
    );
  }

  return (
    <div className="min-w-0 flex-1 space-y-1 py-0.5">
      {lines.map((line, index) => (
        <div key={`${line.name}-${index}`} className="min-w-0">
          <SummaryLine line={line} />
          {line.nested.length > 0 ? (
            <div className="mt-0.5 space-y-0.5 pl-1">
              {line.nested.map((nestedLine, nestedIndex) => (
                <SummaryLine
                  key={`${nestedLine.name}-${nestedIndex}`}
                  line={nestedLine}
                  nested
                />
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
