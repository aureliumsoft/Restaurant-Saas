'use client';

import { cn } from '@/lib/utils';
import {
  cartLineTitle,
  cartModifierDisplayTree,
  orderModifierDisplayTree,
  type ModifierDisplayLine,
} from '@/lib/cart-line-display';

type OrderModifierLike = {
  name: string;
  menuItemId?: string | null;
  groupName?: string | null;
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
  /** @deprecated Unused — labels render as ↳ lines. */
  sectionLabelClassName?: string;
};

function renderModifierTree(
  lines: ModifierDisplayLine[],
  opts: {
    showPrices: boolean;
    formatMoney?: (amount: number) => string;
    lineClassName: string;
    showQuantityOnModifiers: boolean;
  }
) {
  const { showPrices, formatMoney, lineClassName, showQuantityOnModifiers } =
    opts;

  return lines.map((line, index) => {
    if (line.style === 'branch') {
      return (
        <p
          key={`branch-${line.name}-${index}`}
          className={cn(lineClassName, 'font-medium text-foreground/80')}
        >
          ↳ {line.name}
        </p>
      );
    }

    const qty =
      showQuantityOnModifiers && line.quantity != null && line.quantity > 1
        ? `${line.quantity}× `
        : '';
    const priceSuffix =
      showPrices &&
      formatMoney &&
      line.unitPrice != null &&
      line.unitPrice > 0
        ? ` (+${formatMoney(line.unitPrice)})`
        : '';

    if (line.style === 'plain') {
      return (
        <p key={`plain-${line.name}-${index}`} className={lineClassName}>
          {qty}
          {line.name}
          {priceSuffix}
        </p>
      );
    }

    return (
      <p
        key={`dash-${line.name}-${index}`}
        className={cn(lineClassName, 'pl-3')}
      >
        - {qty}
        {line.name}
        {priceSuffix}
      </p>
    );
  });
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
  const lines =
    modifiers != null
      ? cartModifierDisplayTree(modifiers)
      : orderModifierDisplayTree(orderModifiers ?? []);

  return (
    <div className="space-y-1">
      <p className={titleClassName}>{displayTitle}</p>
      {lines.length > 0 ? (
        <div className="mt-1 space-y-0.5">
          {renderModifierTree(lines, {
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
