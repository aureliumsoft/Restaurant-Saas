'use client';

import { cn } from '@/lib/utils';
import {
  cartLineTitle,
  cartModifierDisplaySections,
  orderModifierDisplaySections,
  type ModifierDisplaySection,
} from '@/lib/cart-line-display';

type OrderModifierLike = {
  name: string;
  menuItemId?: string | null;
  unitPrice?: number;
  quantity?: number;
};

type Props = {
  productName: string;
  variationName?: string | null;
  quantity?: number;
  modifiers?: unknown;
  orderModifiers?: OrderModifierLike[];
  showPrices?: boolean;
  formatMoney?: (amount: number) => string;
  titleClassName?: string;
  lineClassName?: string;
  showQuantityOnModifiers?: boolean;
  sectionLabelClassName?: string;
};

function renderModifierLines(
  sections: ModifierDisplaySection[],
  opts: {
    showPrices: boolean;
    formatMoney?: (amount: number) => string;
    lineClassName: string;
    showQuantityOnModifiers: boolean;
  }
) {
  const { showPrices, formatMoney, lineClassName, showQuantityOnModifiers } =
    opts;

  return sections.flatMap((section) =>
    section.lines.map((line, index) => {
      const qty =
        showQuantityOnModifiers && line.quantity != null && line.quantity > 1
          ? `${line.quantity}× `
          : '';
      const prefix = section.kind === 'personalize' ? '↳ ' : '- ';
      const priceSuffix =
        showPrices &&
        formatMoney &&
        line.unitPrice != null &&
        line.unitPrice > 0
          ? ` (+${formatMoney(line.unitPrice)})`
          : '';
      return (
        <p
          key={`${section.kind}-${line.name}-${index}`}
          className={cn(
            lineClassName,
            section.kind === 'recommendation' && 'pl-3'
          )}
        >
          {prefix}
          {qty}
          {line.name}
          {priceSuffix}
        </p>
      );
    })
  );
}

export function ProductLineDetails({
  productName,
  variationName,
  quantity,
  modifiers,
  orderModifiers,
  showPrices = false,
  formatMoney,
  titleClassName = 'font-medium leading-snug',
  lineClassName = 'text-xs leading-relaxed text-muted-foreground',
  showQuantityOnModifiers = false,
}: Props) {
  const title = cartLineTitle(productName, variationName);
  const displayTitle =
    quantity != null && quantity > 0 ? `${quantity}× ${title}` : title;
  const sections =
    modifiers != null
      ? cartModifierDisplaySections(modifiers)
      : orderModifierDisplaySections(orderModifiers ?? []);

  return (
    <div className="space-y-1">
      <p className={titleClassName}>{displayTitle}</p>
      {sections.length > 0 ? (
        <div className="mt-1 space-y-0.5">
          {renderModifierLines(sections, {
            showPrices,
            formatMoney,
            lineClassName,
            showQuantityOnModifiers,
          })}
        </div>
      ) : null}
    </div>
  );
}
